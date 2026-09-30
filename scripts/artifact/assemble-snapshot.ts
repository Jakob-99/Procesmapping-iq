import fs from "node:fs";
import path from "node:path";

/*
  npx tsx scripts/artifact/assemble-snapshot.ts <mappe med fangede sider> <ud.html>

  Samler Corner IQ-sider, fanget i browseren med capture-snapshot.js, til én
  side til læsning (et artifact): præcis Corner IQ's egen opmærkning og
  stylesheet, med chat, redigering og knapper til at oprette/slette fjernet
  ved fangsten. Menuen og alle links skifter mellem de fangede sider med
  #anker, og diagrammets zoom (−, 100 %, +, Tilpas) og træk-for-at-flytte
  virker som i appen. Resten er statisk.
*/

const [dir, out] = process.argv.slice(2);
if (!dir || !out) {
  console.error("Brug: npx tsx scripts/artifact/assemble-snapshot.ts <mappe> <ud.html>");
  process.exit(2);
}

type Page = { path: string; htmlClass: string; bodyClass: string; body: string };
const pages: Record<string, Page> = {};
for (const f of fs.readdirSync(dir).filter((f) => f.endsWith(".json"))) {
  const p: Page = JSON.parse(fs.readFileSync(path.join(dir, f), "utf8"));
  pages[p.path] = p;
}
const css = fs.readFileSync(path.join(dir, "app.css"), "utf8");

// Tekster, der beder læseren om at rette eller chatte — det kan man ikke her.
const READ_ONLY_COPY: [RegExp, string][] = [[/\s*Skriv punkterne her, eller bed agenten i chatten om at notere dem\./g, ""]];
for (const p of Object.values(pages)) for (const [re, to] of READ_ONLY_COPY) p.body = p.body.replace(re, to);

// Sidens eget script: vis en side, omskriv links til #anker, zoom og træk.
const boot = `(() => {
  const pages = JSON.parse(document.getElementById("pages").textContent);
  const token = (p) => p === "/" ? "forside" : p.replace(/^\\//, "").replace(/\\//g, "--");
  const byToken = {};
  for (const p of Object.keys(pages)) byToken[token(p)] = p;
  const root = document.getElementById("root");

  function zoomable(frame) {
    const controls = frame.querySelector(":scope > .absolute");
    const view = frame.querySelector(":scope > .overflow-auto");
    const inner = view && view.querySelector(".origin-top-left");
    if (!controls || !view || !inner) return;
    const sizer = inner.parentElement;
    const btns = controls.querySelectorAll("button");
    const STEPS = [0.2, 0.25, 0.3, 0.4, 0.5, 0.67, 0.8, 0.9, 1, 1.1, 1.25, 1.5, 1.75, 2], PAD = 24, MAX = 2;
    inner.style.transform = "";
    const w = Math.max(inner.offsetWidth, inner.scrollWidth), h = Math.max(inner.offsetHeight, inner.scrollHeight);
    const fit = () => Math.min((view.clientWidth - PAD * 2) / w, (view.clientHeight - PAD * 2) / h);
    const min = () => Math.max(0.1, Math.min(1, fit()));
    let scale = 1;
    function set(s) {
      scale = Math.min(MAX, Math.max(min(), s));
      inner.style.transform = scale === 1 ? "" : "scale(" + scale + ")";
      sizer.style.width = w * scale + "px";
      sizer.style.height = h * scale + "px";
      btns[1].textContent = Math.round(scale * 100) + "%";
      btns[0].disabled = scale <= min() + 0.001;
      btns[2].disabled = scale >= MAX;
    }
    btns[0].onclick = () => set([...STEPS].reverse().find((v) => v < scale - 0.001) ?? min());
    btns[1].onclick = () => set(1);
    btns[2].onclick = () => set(STEPS.find((v) => v > scale + 0.001) ?? MAX);
    btns[3].onclick = () => set(Math.min(1.25, fit()));
    set(1);
    let pan = null;
    view.addEventListener("pointerdown", (e) => {
      if (e.button !== 0) return;
      pan = { x: e.clientX, y: e.clientY, l: view.scrollLeft, t: view.scrollTop };
      view.setPointerCapture(e.pointerId);
      view.classList.add("cursor-grabbing");
    });
    view.addEventListener("pointermove", (e) => {
      if (!pan) return;
      view.scrollLeft = pan.l - (e.clientX - pan.x);
      view.scrollTop = pan.t - (e.clientY - pan.y);
    });
    const end = () => { pan = null; view.classList.remove("cursor-grabbing"); };
    view.addEventListener("pointerup", end);
    view.addEventListener("pointercancel", end);
  }

  function show() {
    const t = location.hash.replace(/^#/, "") || "forside";
    const page = pages[byToken[t] || "/"];
    document.documentElement.className = page.htmlClass;
    document.body.className = page.bodyClass;
    root.innerHTML = page.body;
    root.querySelectorAll("a[href]").forEach((a) => {
      const href = a.getAttribute("href").split("?")[0].split("#")[0];
      if (pages[href]) a.setAttribute("href", "#" + token(href));
      else if (href.startsWith("/")) { a.removeAttribute("href"); a.style.cursor = "default"; }
    });
    // Knapper uden handling her (skridt, faner) må ikke se ud som om de gør noget.
    root.querySelectorAll("button").forEach((b) => { if (!b.closest(".z-30")) b.tabIndex = -1; });
    [...root.querySelectorAll("button")].filter((b) => b.textContent.trim() === "Tilpas").forEach((b) => zoomable(b.closest(".relative")));
    root.querySelectorAll(".overflow-y-auto").forEach((el) => (el.scrollTop = 0));
    window.scrollTo(0, 0);
  }
  window.addEventListener("hashchange", show);
  show();
})();`;

const html = `<title>Cornerstones Procesmodel</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap">
<style>
${css}
/* Læseside: knapper, der ikke gør noget her, reagerer ikke. */
#root button:not(.z-30 button) { pointer-events: none; }
html, body { height: 100%; }
body { background: var(--color-surface); }
#root { display: contents; }
</style>
<div id="root"></div>
<script id="pages" type="application/json">${JSON.stringify(pages).replace(/</g, "\\u003c")}</script>
<script>${boot.replace(/<\/script/gi, "<\\/script")}</script>
`;
fs.writeFileSync(out, html);
console.log(`Skrevet: ${out} (${Math.round(html.length / 1024)} KB, ${Object.keys(pages).length} sider)`);
