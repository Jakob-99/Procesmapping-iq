import type { VisioInput } from "@/lib/visio/subprocess";
import { renderDiagram } from "./page";

/*
  Sidens opstart: modellen står som JSON i <script id="model">. Diagrammet
  tegnes i 100 %, og zoomen er en CSS-skalering af det hele — pilene regnes
  i diagrammets egne mål (som ZoomableDiagram i appen).
*/

const input: VisioInput = JSON.parse(document.getElementById("model")!.textContent!);
const viewport = document.getElementById("viewport")!;
const stage = document.getElementById("stage")!;
const sizer = document.getElementById("sizer")!;
const pct = document.getElementById("zoom-pct")!;
const { canvas, draw } = renderDiagram(stage, input);

let zoom = 1;
let fitted = true;

function apply() {
  stage.style.transform = `scale(${zoom})`;
  sizer.style.width = `${canvas.offsetWidth * zoom}px`;
  sizer.style.height = `${canvas.offsetHeight * zoom}px`;
  pct.textContent = `${Math.round(zoom * 100)} %`;
  draw(zoom);
}

function fit() {
  // Bredden inden for viewportens luft (16 px hver side).
  const avail = viewport.clientWidth - 34;
  zoom = Math.max(0.3, Math.min(1, avail / canvas.offsetWidth));
  fitted = true;
  apply();
}

function step(dir: number) {
  const levels = [0.3, 0.4, 0.5, 0.6, 0.75, 0.9, 1, 1.25, 1.5];
  const i = levels.findIndex((l) => l >= zoom - 0.001);
  const next = dir > 0 ? levels.find((l) => l > zoom + 0.001) : [...levels].reverse().find((l) => l < zoom - 0.001);
  zoom = next ?? levels[i < 0 ? levels.length - 1 : i];
  fitted = false;
  apply();
}

document.getElementById("zoom-out")!.addEventListener("click", () => step(-1));
document.getElementById("zoom-in")!.addEventListener("click", () => step(1));
document.getElementById("zoom-fit")!.addEventListener("click", fit);
document.getElementById("zoom-100")!.addEventListener("click", () => {
  zoom = 1;
  fitted = false;
  apply();
});
new ResizeObserver(() => (fitted ? fit() : apply())).observe(viewport);
if (document.fonts?.ready) document.fonts.ready.then(() => (fitted ? fit() : apply()));
fit();
