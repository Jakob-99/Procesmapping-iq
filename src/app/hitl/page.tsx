import { Upcoming } from "@/components/Upcoming";

export default function HitlPage() {
  return (
    <Upcoming
      eyebrow="Altid tilgængelig"
      title="Kontakt en konsulent"
      lead="Agenten kan meget, men ikke alt. Der skal altid være en vej til et menneske — uanset hvor i forløbet man står."
      steps={[
        {
          title: "Spørg herfra",
          body: "Spørgsmålet sendes med den kontekst du står i — hvilken proces, hvilket skridt, hvilket forslag.",
        },
        {
          title: "En rigtig konsulent svarer",
          body: "Svaret lander i systemet, så det bliver en del af virksomhedens hukommelse i stedet for at forsvinde i en mailtråd.",
        },
      ]}
    />
  );
}
