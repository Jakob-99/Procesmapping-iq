// Respondent.categories gemmes som et JSON-array i en String-kolonne —
// samme mønster som QuantQuestion.options og ThemeCluster.noteIds i denne
// kodebase, i stedet for en relationstabel, da SQLite ikke har en
// arraytype og listen aldrig forespørges på tværs af respondenter i SQL.
export function parseCategories(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === "string") : [];
  } catch {
    return [];
  }
}

export function serializeCategories(categories: string[]): string | null {
  const clean = [...new Set(categories.map((c) => c.trim()).filter(Boolean))];
  return clean.length ? JSON.stringify(clean) : null;
}
