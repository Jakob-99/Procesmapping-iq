// Indsigter deles i to: det der fungerer, og det der ikke gør. Kategorierne
// fra interviewnoterne mappes til den ene eller den anden side.
export type Note = { category: string; content: string };

export function splitInsights(notes: Note[]) {
  const broken = notes.filter((n) => n.category === "PAIN" || n.category === "RISK" || n.category === "WORKAROUND");
  const works = notes.filter((n) => n.category === "OPPORTUNITY" || n.category === "KNOWLEDGE");
  return { works, broken };
}
