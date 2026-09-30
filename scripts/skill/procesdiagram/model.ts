import { STEP_TYPES, isStart } from "@/lib/domain";
import type { VisioInput } from "@/lib/visio/subprocess";

/*
  Procesdiagram-skillens modelfil (model.json) — det Claude skriver og
  retter, og som både siden (render) og Visio-filen (visio) tegnes ud fra.
  Samme indhold som et diagram i Corner IQ, med læsbare id'er.
  Formatet er beskrevet for Claude i skillens references/model.md.
*/

export type Model = {
  title: string;
  pools?: { id: string; name: string }[];
  lanes: { id: string; name: string; pool?: string }[];
  steps: {
    id: string;
    type: string;
    name: string;
    lane: string;
    systems?: string[];
    data?: { name: string; dir: "in" | "out" }[];
  }[];
  flows: { from: string; to: string; label?: string | null; kind?: "SEQUENCE" | "MESSAGE" }[];
};

export function readModel(text: string): { model: Model; errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];
  let m: Model;
  try {
    m = JSON.parse(text.replace(/^﻿/, ""));
  } catch (e) {
    return { model: null as unknown as Model, errors: [`model.json er ikke gyldig JSON: ${(e as Error).message}`], warnings };
  }
  if (!m || typeof m !== "object") return { model: m, errors: ["model.json skal være et objekt"], warnings };
  if (typeof m.title !== "string" || !m.title.trim()) errors.push("title mangler");
  for (const k of ["lanes", "steps", "flows"] as const) if (!Array.isArray(m[k])) errors.push(`${k} skal være en liste`);
  if (m.pools != null && !Array.isArray(m.pools)) errors.push("pools skal være en liste");
  if (errors.length) return { model: m, errors, warnings };

  const dup = (kind: string, ids: string[]) => {
    const seen = new Set<string>();
    for (const id of ids) {
      if (typeof id !== "string" || !id) errors.push(`${kind} uden id`);
      else if (seen.has(id)) errors.push(`${kind}-id "${id}" bruges to gange`);
      seen.add(id);
    }
  };
  const pools = m.pools ?? [];
  dup("pool", pools.map((p) => p.id));
  dup("svimlane", m.lanes.map((l) => l.id));
  dup("skridt", m.steps.map((s) => s.id));

  const poolIds = new Set(pools.map((p) => p.id));
  const laneIds = new Set(m.lanes.map((l) => l.id));
  const stepIds = new Set(m.steps.map((s) => s.id));
  for (const l of m.lanes) {
    if (!l.name) errors.push(`svimlanen "${l.id}" mangler name`);
    if (l.pool != null && !poolIds.has(l.pool)) errors.push(`svimlanen "${l.id}" peger på en ukendt pool "${l.pool}"`);
  }
  for (const s of m.steps) {
    if (!(STEP_TYPES as readonly string[]).includes(s.type))
      errors.push(`skridtet "${s.id}" har ukendt type "${s.type}" — brug ${STEP_TYPES.join(", ")}`);
    if (!laneIds.has(s.lane)) errors.push(`skridtet "${s.id}" står i en ukendt svimlane "${s.lane}"`);
    if (s.type === "TASK" && !s.name) errors.push(`aktiviteten "${s.id}" mangler name`);
    for (const d of s.data ?? []) {
      if (!d.name) errors.push(`skridtet "${s.id}" har et dokument uden name`);
      if (d.dir !== "in" && d.dir !== "out") errors.push(`dokumentet "${d.name}" på "${s.id}" skal have dir "in" eller "out"`);
    }
    if ((s.data?.length ?? 0) > 0 && s.type !== "TASK") warnings.push(`dokumenter på "${s.id}" vises kun ved aktiviteter (TASK)`);
  }
  const poolOf = (stepId: string) => m.lanes.find((l) => l.id === m.steps.find((s) => s.id === stepId)?.lane)?.pool ?? null;
  for (const f of m.flows) {
    if (!stepIds.has(f.from)) errors.push(`en pil går fra et ukendt skridt "${f.from}"`);
    if (!stepIds.has(f.to)) errors.push(`en pil går til et ukendt skridt "${f.to}"`);
    if (f.kind != null && f.kind !== "SEQUENCE" && f.kind !== "MESSAGE") errors.push(`pilen ${f.from} → ${f.to} har ukendt kind "${f.kind}"`);
    if (stepIds.has(f.from) && stepIds.has(f.to)) {
      const cross = poolOf(f.from) !== poolOf(f.to);
      if (cross && f.kind !== "MESSAGE") warnings.push(`pilen ${f.from} → ${f.to} krydser pools — i BPMN er det en MESSAGE`);
      if (!cross && f.kind === "MESSAGE") warnings.push(`pilen ${f.from} → ${f.to} er MESSAGE inden for samme pool — normalt SEQUENCE`);
    }
  }
  const starts = m.steps.filter((s) => isStart(s.type)).length;
  const ends = m.steps.filter((s) => s.type === "END").length;
  if (!starts) warnings.push("der er ingen START");
  if (!ends) warnings.push("der er ingen END");
  return { model: m, errors, warnings };
}

// Til samme form som diagrammet i appen og Visio-eksporten bruger.
export function toInput(m: Model): VisioInput {
  return {
    title: m.title,
    pools: m.pools ?? [],
    lanes: m.lanes.map((l) => ({ id: l.id, name: l.name, isDefault: false, poolId: l.pool ?? null })),
    steps: m.steps.map((s) => ({
      id: s.id,
      type: s.type,
      name: s.name ?? "",
      laneId: s.lane,
      systems: s.systems ?? [],
      data: s.data ?? [],
    })),
    flows: m.flows.map((f) => ({ from: f.from, to: f.to, label: f.label ?? null, kind: f.kind ?? "SEQUENCE" })),
  };
}
