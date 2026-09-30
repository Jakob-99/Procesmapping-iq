/*
  Fanger Corner IQ's sider til en læseside (se assemble-snapshot.ts).

  1. Start Corner IQ (npm run dev) og en modtager, der gemmer POST
     /save/<navn> som filer (fx en lille node-server på port 3100).
  2. Log ind i Corner IQ i browseren som dig selv, og kør dette script i
     konsollen på http://localhost:3000.
  3. Scriptet går alle sider igennem via menuen og links, venter til
     diagrammets pile er tegnet, fjerner chat, redigering og knapper til at
     oprette/slette, og sender siden til modtageren. window.__cap viser
     fremdriften.
  4. Gem også stylesheetet (/_next/static/css/app/layout.css) som app.css i
     samme mappe, og kør assemble-snapshot.ts.
*/
(() => {
  const RECEIVER = "http://localhost:3100/save/";
  window.__cap = { done: [], errors: [], running: true };
  const ALLOWED = /^\/(processes(\/[A-Za-z0-9]+){0,2}|landscape(\/readiness)?|roles|data)?$/;
  const token = (p) => (p === "/" ? "forside" : p.replace(/^\//, "").replace(/\//g, "__"));

  function clean(doc) {
    doc.querySelectorAll("script,noscript,next-route-announcer,nextjs-portal,template").forEach((e) => e.remove());
    // Chatten med proces-agenten (kolonnen og den sammenklappede fane) —
    // ikke menuen, som også er en <aside>.
    doc.querySelectorAll("aside").forEach((e) => {
      if (e.querySelector("h2")?.textContent.trim() === "Proces-agent") e.remove();
    });
    [...doc.querySelectorAll("button")].filter((b) => b.textContent.trim() === "Proces-agent").forEach((b) => b.remove());
    // Brugermenuen (initialen oppe til højre) og indstillinger hører til den indloggede.
    doc.querySelectorAll("header button.rounded-full").forEach((b) => b.remove());
    [...doc.querySelectorAll("aside button")].filter((b) => (b.title || b.textContent.trim()) === "Kontrolpanel").forEach((b) => b.remove());
    // Forsidens hilsen er til den indloggede; siden læses af alle.
    [...doc.querySelectorAll("h1, h2")]
      .filter((h) => !h.children.length && /^Hej, /.test(h.textContent.trim()))
      .forEach((h) => (h.textContent = "Procesmodel"));
    // Redigeringslinjen over diagrammet.
    [...doc.querySelectorAll(".eyebrow")]
      .filter((e) => e.textContent.trim() === "Tilføj")
      .forEach((e) => (e.closest(".mb-3") || e.parentElement.parentElement).remove());
    // Downloads (Visio) virker ikke i et artifact.
    doc.querySelectorAll('a[href^="/api/"]').forEach((a) => a.remove());
    const rm = /^(Ansvarlig og status|Rediger|Slet|Ryd|Gem|Annuller|Interview|Skridtdetaljer|Start et interview.*)$|^\+ /;
    [...doc.querySelectorAll("button")].filter((b) => rm.test(b.textContent.trim())).forEach((b) => b.remove());
    // Felter med indhold bliver til tekst; tomme felter (til at oprette nyt) fjernes.
    doc.querySelectorAll("textarea, input").forEach((e) => {
      const v = e.value || "";
      if (!v.trim() || e.type === "checkbox" || e.type === "hidden") return e.remove();
      const d = doc.createElement(e.tagName === "TEXTAREA" ? "div" : "span");
      d.className = e.className;
      d.setAttribute("style", (e.getAttribute("style") || "") + ";white-space:pre-wrap");
      d.textContent = v;
      e.replaceWith(d);
    });
    doc.querySelectorAll("select").forEach((e) => {
      if (!e.value) return e.remove();
      const d = doc.createElement("span");
      d.className = e.className;
      d.textContent = e.selectedOptions[0]?.textContent || "";
      e.replaceWith(d);
    });
    doc.querySelectorAll("form").forEach((f) => {
      if (!f.textContent.trim()) f.remove();
    });
  }

  async function capture(p) {
    const f = document.createElement("iframe");
    f.style.cssText = "position:fixed;left:-3000px;top:0;width:1440px;height:900px";
    f.src = p;
    document.body.appendChild(f);
    await new Promise((r) => {
      f.onload = r;
      setTimeout(r, 15000);
    });
    const doc = f.contentDocument;
    // Vent til siden står stille (diagrammets pile tegnes efter indlæsning).
    let last = -1;
    for (let i = 0; i < 20; i++) {
      await new Promise((r) => setTimeout(r, 250));
      const n = doc.querySelectorAll("svg path").length + doc.body.innerHTML.length;
      if (n === last && i > 4) break;
      last = n;
    }
    const links = [...doc.querySelectorAll("a[href]")]
      .map((a) => a.getAttribute("href").split("?")[0].split("#")[0])
      .filter((h) => ALLOWED.test(h));
    clean(doc);
    const out = { path: p, htmlClass: doc.documentElement.className, bodyClass: doc.body.className, body: doc.body.innerHTML };
    await fetch(RECEIVER + token(p) + ".json", { method: "POST", mode: "no-cors", body: JSON.stringify(out) });
    f.remove();
    return links;
  }

  (async () => {
    const queue = ["/"];
    const seen = new Set(queue);
    while (queue.length) {
      const p = queue.shift();
      try {
        for (const l of await capture(p)) if (!seen.has(l)) seen.add(l), queue.push(l);
        window.__cap.done.push(p);
      } catch (e) {
        window.__cap.errors.push(p + ": " + e.message);
      }
    }
    window.__cap.running = false;
  })();
})();
