import { Resend } from "resend";

// RESEND_API_KEY er valgfri med vilje: uden den falder alle tre login-flows
// (kunde, konsulent, respondent) tilbage til at vise koden direkte på
// skærmen i stedet for at sende en mail — så appen stadig virker lokalt
// uden at nogen har sat en Resend-konto op. Sæt nøglen i .env for at slå
// rigtig mailudsendelse til.
const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

// Uden et verificeret afsenderdomæne i Resend kan man kun sende fra deres
// eget test-domæne — sæt RESEND_FROM_EMAIL når jeres domæne er verificeret.
const FROM = process.env.RESEND_FROM_EMAIL || "Corner IQ <onboarding@resend.dev>";

export function mailEnabled(): boolean {
  return resend !== null;
}

// Returnerer true hvis mailen rent faktisk blev sendt — kaldere bruger det
// til at afgøre om koden stadig skal vises på skærmen (dev-fallback) eller
// ej.
export async function sendLoginCodeEmail(
  to: string,
  code: string,
  context: string,
): Promise<boolean> {
  if (!resend) return false;

  const { error } = await resend.emails.send({
    from: FROM,
    to,
    subject: `Din login-kode til ${context}: ${code}`,
    html: `
      <div style="font-family: -apple-system, sans-serif; max-width: 400px; margin: 0 auto;">
        <p style="color: #6b5a4c; font-size: 14px;">Din login-kode til ${context} er:</p>
        <p style="font-size: 32px; font-weight: 600; letter-spacing: 0.2em; color: #e35f1e; margin: 16px 0;">${code}</p>
        <p style="color: #96826e; font-size: 12px;">Koden er gyldig i 14 dage, eller indtil du har brugt den.</p>
      </div>
    `,
  });

  // En fejl her betyder mailen ikke kom afsted — lad kalderen falde tilbage
  // til at vise koden, i stedet for at brugeren står helt fast. Logges
  // alligevel, ellers er en forkert Resend-opsætning umulig at diagnosticere.
  if (error) console.error("Resend-fejl ved afsendelse af login-kode:", error);
  return !error;
}
