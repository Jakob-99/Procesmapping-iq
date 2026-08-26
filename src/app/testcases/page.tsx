import { Upcoming } from "@/components/Upcoming";

export default function TestCasesPage() {
  return (
    <Upcoming
      eyebrow="Fase 6 og 7"
      title="Test og træning"
      lead="De samme test cases bruges to gange: først til at godkende partnerens leverance, derefter til at lære medarbejderne systemet."
      steps={[
        {
          title: "Genereret ud fra processen",
          body: "Hver test case skrives som givet-når-så ud fra de kortlagte skridt — ikke ud fra en kravspecifikation.",
        },
        {
          title: "Godkendelse af leverancen",
          body: "Partnerens system skal kunne eksekvere alle test cases, før det tages i brug.",
        },
        {
          title: "Træning bagefter",
          body: "Agenten laver en gennemgang af processen og svarer på spørgsmål undervejs.",
        },
        {
          title: "Forbedringslogning",
          body: "Medarbejdere kan løbende melde ind, når noget ikke passer med virkeligheden.",
        },
      ]}
    />
  );
}
