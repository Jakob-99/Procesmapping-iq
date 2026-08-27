import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Corner IQ",
  description:
    "Virksomhedens hjerne — processer, data, systemer og de agenter der kan bygges ovenpå.",
};

/*
  Bevidst "dum" — ingen session-opslag, ingen Topbar/Nav her. Kundefladen
  ((customer)/layout.tsx) og admin-panelet (admin/layout.tsx) er hver sin
  søskende-rute under denne fælles rod, med hver sin skal. Tidligere lå
  chrome-valget HER, styret af en request-header (se git-historik) — det gav
  et race, fordi Next kan genbruge en cachet klient-render af det DELTE
  root-layout ved frem/tilbage-navigation, uafhængigt af hvilken rute man
  rent faktisk lander på. En fælles rute-forælder der skifter UI ud fra
  request-state er derfor et mønster at undgå her — brug adskilte
  layout-segmenter (route groups) i stedet, som denne opdeling gør.
*/
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="da">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      {/* Appen går helt ud til kanten. Ingen ramme, ingen kasse. */}
      <body className="flex h-screen flex-col overflow-hidden">{children}</body>
    </html>
  );
}
