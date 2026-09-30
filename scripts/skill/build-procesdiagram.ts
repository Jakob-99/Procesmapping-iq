import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { build } from "esbuild";
import { zip } from "@/lib/zip";

/*
  npx tsx scripts/skill/build-procesdiagram.ts

  Bygger procesdiagram-skillen — en global skill, ikke en del af Corner IQ.
  Teksten (SKILL.md, references/) ligger i scripts/skill/procesdiagram/skill;
  de to scripts bygges ud fra appens egen kode (lib/swimlane-layout,
  lib/swimlane-routing, lib/visio), så skillen tegner præcis som Corner IQ:

    scripts/render.mjs  model → HTML-side
    scripts/visio.mjs   model → .vsdx

  Begge er én fil uden afhængigheder ud over Node — sidens script og
  Cornerstones' stencil er bygget ind. Resultatet lægges to steder:

    ~/.claude/skills/procesdiagram/   Claude Code, i alle projekter
    ~/Downloads/procesdiagram.zip     til upload som skill i Claude
                                      (Cowork og claude.ai)

  Kør igen, når diagrammet eller Visio-eksporten ændres i appen.
*/

const root = process.cwd();
const src = path.join(root, "scripts", "skill", "procesdiagram");
const skillSrc = path.join(src, "skill");
const target = process.env.PROCESDIAGRAM_DIR ?? path.join(os.homedir(), ".claude", "skills", "procesdiagram");
const zipPath = process.env.PROCESDIAGRAM_ZIP ?? path.join(os.homedir(), "Downloads", "procesdiagram.zip");
const out = path.join(target, "scripts");

function stencilFiles() {
  const dir = path.join(root, "src", "lib", "visio", "stencil");
  const files: Record<string, string> = {};
  const walk = (d: string) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p);
      else files[path.relative(dir, p).split(path.sep).join("/")] = fs.readFileSync(p, "utf8");
    }
  };
  walk(dir);
  return files;
}

async function main() {
  const page = await build({
    entryPoints: [path.join(src, "page-entry.ts")],
    bundle: true,
    format: "iife",
    platform: "browser",
    target: "es2020",
    minify: true,
    write: false,
    legalComments: "none",
  });
  const pageJs = page.outputFiles[0].text;

  fs.mkdirSync(out, { recursive: true });
  const banner = { js: "// Bygget af scripts/skill/build-procesdiagram.ts i Corner IQ — ret ikke i hånden." };
  const node = { bundle: true, format: "esm" as const, platform: "node" as const, target: "node18", banner, legalComments: "none" as const };

  await build({
    ...node,
    entryPoints: [path.join(src, "render.ts")],
    outfile: path.join(out, "render.mjs"),
    define: { __PAGE_JS__: JSON.stringify(pageJs) },
  });
  await build({
    ...node,
    entryPoints: [path.join(src, "visio.ts")],
    outfile: path.join(out, "visio.mjs"),
    define: { __STENCIL__: JSON.stringify(stencilFiles()) },
  });
  // Skillens tekst ved siden af scripts.
  const copy = (from: string, to: string) => {
    for (const e of fs.readdirSync(from, { withFileTypes: true })) {
      const a = path.join(from, e.name);
      const b = path.join(to, e.name);
      if (e.isDirectory()) {
        fs.mkdirSync(b, { recursive: true });
        copy(a, b);
      } else fs.copyFileSync(a, b);
    }
  };
  copy(skillSrc, target);

  // Samme mappe som zip, med mappen "procesdiagram/" øverst.
  const files: { path: string; data: Uint8Array }[] = [];
  const collect = (dir: string) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) collect(p);
      else files.push({ path: `procesdiagram/${path.relative(target, p).split(path.sep).join("/")}`, data: fs.readFileSync(p) });
    }
  };
  collect(target);
  fs.mkdirSync(path.dirname(zipPath), { recursive: true });
  fs.writeFileSync(zipPath, zip(files));

  for (const f of files) console.log(" ", f.path, Math.round(f.data.length / 1024), "KB");
  console.log("Installeret:", target);
  console.log("Til upload:", zipPath);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
