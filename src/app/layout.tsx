import type { Metadata } from "next";
import { headers } from "next/headers";
import "./globals.css";
import { Nav } from "@/components/Nav";
import { Topbar } from "@/components/Topbar";
import { BreadcrumbProvider } from "@/components/BreadcrumbContext";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/session";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Corner IQ",
  description:
    "Virksomhedens hjerne — processer, data, systemer og de agenter der kan bygges ovenpå.",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // /admin har sin egen skal (app/admin/layout.tsx) og skal ALDRIG få
  // kundens Topbar/Nav udenom — heller ikke selvom man (som konsulent) også
  // tilfældigvis har en gyldig kunde-session_uid-cookie fra at have testet
  // kundefladen. Uden dette tjek afgjorde koden kun ud fra cookien, ikke
  // ud fra hvilken rute man rent faktisk står på. Se middleware.ts.
  const isAdminSection = (await headers()).get("x-app-section") === "admin";

  // Kontrolpanelet er organisations-scoped — organisationen er nu den
  // indloggede brugers egen, ikke længere "den første i DB" (flere kunder
  // kan være logget ind samtidig). Ingen session giver et tomt layout, som
  // /login selv rendere indeni (samme mønster som /interviews/login).
  const sessionUser = isAdminSection ? null : await getSessionUser();
  const organization = sessionUser
    ? await db.organization.findUnique({
        where: { id: sessionUser.organizationId },
        include: { users: { orderBy: { name: "asc" } } },
      })
    : null;

  // Forbedringsforslag skal kunne ses og pinnes/un-pinnes direkte fra menuen,
  // ikke kun på selve Forbedringer-siden — så man kan holde øje med dem
  // uanset hvor man er. Skal scopes til egen organisation, ellers ville man
  // se (og kunne pinne) andre kunders forslag.
  const proposals = sessionUser
    ? await db.aiosProposal.findMany({
        where: { improvement: { engagement: { organizationId: sessionUser.organizationId } } },
        select: { id: true, name: true, selected: true },
        orderBy: { name: "asc" },
      })
    : [];

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
      <body className="flex h-screen flex-col overflow-hidden">
        {sessionUser ? (
          <BreadcrumbProvider>
            <Topbar
              currentUserId={sessionUser.id}
              users={
                organization
                  ? organization.users.map((u) => ({
                      id: u.id,
                      name: u.name,
                      email: u.email,
                      role: u.role,
                    }))
                  : []
              }
            />
            <div className="flex flex-1 overflow-hidden">
              <Nav
                organization={organization ? { id: organization.id, name: organization.name } : null}
                users={
                  organization
                    ? organization.users.map((u) => ({
                        id: u.id,
                        name: u.name,
                        email: u.email,
                        role: u.role,
                      }))
                    : []
                }
                proposals={proposals}
              />
              <main className="flex-1 overflow-y-auto">{children}</main>
            </div>
          </BreadcrumbProvider>
        ) : (
          // Ingen kunde-session, eller en /admin-rute (som altid lander her,
          // se isAdminSection ovenfor) — /admin/layout.tsx lægger sin egen
          // skal om children i det tilfælde. Fuldskærms her, uden kundens
          // menu og topbjælke.
          <main className="flex-1 overflow-y-auto">{children}</main>
        )}
      </body>
    </html>
  );
}
