import fs from "node:fs";
import path from "node:path";
import { DIAGRAM_CSS } from "./diagram-css";
import { readModel, toInput } from "./model";

/*
  node render.mjs model.json [diagram.html]

  Tegner modellen som én selvstændig HTML-side — svimlanediagrammet som i
  Corner IQ — til at vise som artifact og rette i, indtil det er færdigt.
  Sidens script (page-entry.ts) er bygget ind i denne fil.
*/

declare const __PAGE_JS__: string;

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const CSS = `
:root {
  --bg: #f4efe9; --panel: #ffffff; --ink: #241c17; --muted: #6b5a4c; --line: #e4dbd0; --accent: #e35f1e;
  /* Selve diagrammet er papir og står ens i lyst og mørkt tema, som i Corner IQ. */
  --d-surface: #ffffff; --d-text: #241c17; --d-muted: #6b5a4c; --d-faint: #96826e; --d-clay-wash: #fdf0e6;
  color-scheme: light;
}
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) { --bg: #17120e; --panel: #221b16; --ink: #f1e9e1; --muted: #b9a797; --line: #3a2f27; color-scheme: dark; }
}
:root[data-theme="dark"] { --bg: #17120e; --panel: #221b16; --ink: #f1e9e1; --muted: #b9a797; --line: #3a2f27; color-scheme: dark; }
*, *::before, *::after { box-sizing: border-box; }
html, body { margin: 0; height: 100%; }
body { background: var(--bg); color: var(--ink); font-family: "Inter", ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif; line-height: 1.5; display: flex; flex-direction: column; }
.bar { display: flex; align-items: center; gap: 12px; padding: 10px 16px; border-bottom: 1px solid var(--line); background: var(--panel); flex-wrap: wrap; }
.bar h1 { margin: 0; font-size: 15px; font-weight: 600; flex: 1 1 auto; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.zoom { display: flex; align-items: center; gap: 4px; }
.zoom button { font: inherit; font-size: 13px; color: var(--ink); background: transparent; border: 1px solid var(--line); border-radius: 6px; height: 28px; min-width: 28px; padding: 0 8px; cursor: pointer; }
.zoom button:hover { border-color: var(--accent); }
#zoom-pct { font-size: 12px; color: var(--muted); min-width: 44px; text-align: center; font-variant-numeric: tabular-nums; }
#viewport { flex: 1 1 auto; overflow: auto; padding: 16px; }
#sizer { position: relative; }
#stage { position: absolute; left: 0; top: 0; transform-origin: 0 0; }

${DIAGRAM_CSS}
`;

function main() {
  const [modelPath, outArg] = process.argv.slice(2);
  if (!modelPath) {
    console.error("Brug: node render.mjs model.json [diagram.html]");
    process.exit(2);
  }
  const { model, errors, warnings } = readModel(fs.readFileSync(modelPath, "utf8"));
  for (const w of warnings) console.warn(`Advarsel: ${w}`);
  if (errors.length) {
    for (const e of errors) console.error(`Fejl: ${e}`);
    process.exit(1);
  }
  const input = toInput(model);
  const out = outArg ?? path.join(path.dirname(modelPath), "diagram.html");
  const json = JSON.stringify(input).replace(/</g, "\\u003c");
  const html = `<!doctype html>
<html lang="da">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(model.title)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap">
<style>${CSS}</style>
</head>
<body>
<header class="bar">
<h1>${esc(model.title)}</h1>
<div class="zoom" role="group" aria-label="Zoom">
<button id="zoom-out" type="button" aria-label="Zoom ud">−</button>
<span id="zoom-pct">100 %</span>
<button id="zoom-in" type="button" aria-label="Zoom ind">+</button>
<button id="zoom-100" type="button">100 %</button>
<button id="zoom-fit" type="button">Tilpas</button>
</div>
</header>
<main id="viewport"><div id="sizer"><div id="stage"></div></div></main>
<script id="model" type="application/json">${json}</script>
<script>${__PAGE_JS__.replace(/<\/script/gi, "<\\/script")}</script>
</body>
</html>
`;
  fs.writeFileSync(out, html);
  console.log(`Skrevet: ${out} (${input.steps.length} skridt, ${input.flows.length} pile)`);
}

main();
