import fs from "node:fs";
import path from "node:path";
import { buildSubProcessVsdx } from "@/lib/visio/subprocess";
import { setStencilFiles } from "@/lib/visio/stencil";
import { readModel, toInput } from "./model";

/*
  node visio.mjs model.json [diagram.vsdx]

  Samme Visio-fil som "Eksportér til Visio" i Corner IQ, bygget af
  Cornerstones' stencil — som er indlejret i denne fil.
*/

declare const __STENCIL__: Record<string, string>;

function main() {
  const [modelPath, outArg] = process.argv.slice(2);
  if (!modelPath) {
    console.error("Brug: node visio.mjs model.json [diagram.vsdx]");
    process.exit(2);
  }
  const { model, errors, warnings } = readModel(fs.readFileSync(modelPath, "utf8"));
  for (const w of warnings) console.warn(`Advarsel: ${w}`);
  if (errors.length) {
    for (const e of errors) console.error(`Fejl: ${e}`);
    process.exit(1);
  }
  setStencilFiles(__STENCIL__);
  const file = buildSubProcessVsdx(toInput(model));
  const safe = model.title.replace(/[\\/:*?"<>|]+/g, "-").trim() || "procesdiagram";
  const out = outArg ?? path.join(path.dirname(modelPath), `${safe}.vsdx`);
  fs.writeFileSync(out, file);
  console.log(`Skrevet: ${out} (${Math.round(file.length / 1024)} KB)`);
}

main();
