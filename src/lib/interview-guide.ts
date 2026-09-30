import fs from "node:fs";
import path from "node:path";

/*
  Interviewet i Corner IQ er det samme som i procesdiagram-skillen: teksten
  læses direkte fra skillens SKILL.md (afsnittet "## 1. Interview"), så der
  kun er ét sted at rette, hvordan der interviewes. Proces-agenten får
  afsnittet som instruks, når konsulenten trykker "Interview" i chatten
  (se process-agent.ts), og åbningsspørgsmålet er det skillen selv stiller.
*/

const SKILL = path.join(process.cwd(), "scripts", "skill", "procesdiagram", "skill", "SKILL.md");

let cache: { mtime: number; guide: string; opening: string } | null = null;

function load() {
  const mtime = fs.statSync(SKILL).mtimeMs;
  if (cache && cache.mtime === mtime) return cache;
  const text = fs.readFileSync(SKILL, "utf8").replace(/\r\n/g, "\n");
  const start = text.indexOf("## 1. Interview");
  const end = text.indexOf("\n## 2.", start);
  if (start < 0 || end < 0) throw new Error("Interviewafsnittet mangler i procesdiagram-skillen");
  const guide = text
    .slice(start, end)
    // Kun for skillen uden for appen — her ligger diagrammet allerede i Corner IQ.
    .replace(/\nHar du i stedet et diagram fra Corner IQ[^\n]*\n/, "\n")
    .trim();
  const section = guide.slice(guide.indexOf("### 1a."), guide.indexOf("### 1b."));
  const opening = section
    .split("\n")
    .filter((l) => l.startsWith("> "))
    .map((l) => l.slice(2))
    .join(" ")
    .trim();
  if (!opening) throw new Error("Åbningsspørgsmålet mangler i procesdiagram-skillen");
  cache = { mtime, guide, opening };
  return cache;
}

// Hele interviewafsnittet (1a–1d, pools og baner, udfald, data, overlevering).
export const interviewGuide = () => load().guide;

// Det ene store åbningsspørgsmål, ordret fra skillen.
export const interviewOpening = () => load().opening;
