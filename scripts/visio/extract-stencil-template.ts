/*
  Trækker skabelonen til Visio-eksporten ud af den referencefil, som
  build-stencil-template.ps1 har gemt:

    npx tsx scripts/visio/extract-stencil-template.ts "<sti>\stencil-ref.vsdx"

  Skriver til src/lib/visio/stencil:
  - document.xml            stilarkene fra stencilet
  - masters/…               masterne (med relationer), som figurerne bygger på
  - instances.json          én færdig figur pr. variant (REF_START, REF_TASK_76, …)
                            præcis som Visio gemte den, plus sidens lag

  Stencilets valgliste over systemer på Activity (Prop.System.Format) er en
  bestemt kundes systemer og fjernes, så den ikke følger med ud i andre
  kunders filer.
*/
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";

const src = process.argv[2];
if (!src) throw new Error("Angiv stien til stencil-ref.vsdx");
const outDir = path.join(process.cwd(), "src", "lib", "visio", "stencil");

// Minimal unzip (Visio gemmer med deflate).
function unzip(buf: Buffer) {
  const files = new Map<string, Buffer>();
  let eocd = buf.length - 22;
  while (eocd >= 0 && buf.readUInt32LE(eocd) !== 0x06054b50) eocd--;
  const count = buf.readUInt16LE(eocd + 10);
  let p = buf.readUInt32LE(eocd + 16);
  for (let i = 0; i < count; i++) {
    const method = buf.readUInt16LE(p + 10);
    const size = buf.readUInt32LE(p + 20);
    const nameLen = buf.readUInt16LE(p + 28);
    const extraLen = buf.readUInt16LE(p + 30);
    const commentLen = buf.readUInt16LE(p + 32);
    const local = buf.readUInt32LE(p + 42);
    const name = buf.toString("utf8", p + 46, p + 46 + nameLen);
    const lNameLen = buf.readUInt16LE(local + 26);
    const lExtraLen = buf.readUInt16LE(local + 28);
    const data = buf.subarray(local + 30 + lNameLen + lExtraLen, local + 30 + lNameLen + lExtraLen + size);
    files.set(name, method === 8 ? zlib.inflateRawSync(data) : Buffer.from(data));
    p += 46 + nameLen + extraLen + commentLen;
  }
  return files;
}

// Finder <Shape …>…</Shape> med indlejrede figurer (balanceret).
function shapeXml(xml: string, start: number) {
  const tag = /<Shape\b[^>]*?(\/?)>|<\/Shape>/g;
  tag.lastIndex = start;
  let depth = 0;
  for (let m = tag.exec(xml); m; m = tag.exec(xml)) {
    if (m[0].startsWith("</")) depth--;
    else if (m[1] !== "/") depth++;
    if (depth === 0) return xml.slice(start, tag.lastIndex);
  }
  throw new Error("Ubalanceret <Shape>");
}

const files = unzip(fs.readFileSync(src));
const text = (n: string) => files.get(n)!.toString("utf8");

fs.rmSync(outDir, { recursive: true, force: true });
fs.mkdirSync(path.join(outDir, "masters", "_rels"), { recursive: true });

fs.writeFileSync(path.join(outDir, "document.xml"), text("visio/document.xml"));

const masterFiles = [...files.keys()].filter((n) => n.startsWith("visio/masters/"));
for (const n of masterFiles) {
  let t = text(n);
  // Kundens systemliste ud — valglisten fyldes ikke, systemerne står i teksten.
  t = t.replace(/(<Row N='System'>(?:(?!<\/Row>).)*?<Cell N='Format' V=')[^']*(')/g, "$1$2");
  fs.writeFileSync(path.join(outDir, "masters", n.slice("visio/masters/".length)), t);
}

const page = text("visio/pages/page1.xml");
const instances: Record<string, string> = {};
for (const m of page.matchAll(/<Shape ID='\d+' NameU='(REF_[A-Z_0-9]+)'/g)) {
  instances[m[1]] = shapeXml(page, m.index!);
}
const pages = text("visio/pages/pages.xml");
const layers = pages.match(/<Section N='Layer'>.*?<\/Section>/)?.[0] ?? "";

fs.writeFileSync(
  path.join(outDir, "instances.json"),
  JSON.stringify({ layers, instances }, null, 1),
);

const left = [...masterFiles.map((n) => path.join(outDir, "masters", n.slice("visio/masters/".length))), path.join(outDir, "instances.json")].filter(
  (f) => fs.readFileSync(f, "utf8").includes("Perfion"),
);
console.log(`Skrev ${Object.keys(instances).length} figurer og ${masterFiles.length} masterfiler til ${outDir}`);
console.log("Figurer:", Object.keys(instances).join(", "));
if (left.length) console.log("ADVARSEL: kundens systemliste findes stadig i", left);
