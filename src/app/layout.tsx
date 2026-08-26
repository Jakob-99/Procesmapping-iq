import type { Metadata } from "next";
import "./globals.css";
import { Nav } from "@/components/Nav";
import { Topbar } from "@/components/Topbar";
import { BreadcrumbProvider } from "@/components/BreadcrumbContext";
import { db } from "@/lib/db";

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
  // Kontrolpanelet er organisations-scoped — appen har (indtil videre) én
  // organisation, så vi henter blot den første.
  const organization = await db.organization.findFirst({
    orderBy: { createdAt: "asc" },
    include: { users: { orderBy: { name: "asc" } } },
  });

  // Forbedringsforslag skal kunne ses og pinnes/un-pinnes direkte fra menuen,
  // ikke kun på selve Forbedringer-siden — så man kan holde øje med dem
  // uanset hvor man er.
  const proposals = await db.aiosProposal.findMany({
    select: { id: true, name: true, selected: true },
    orderBy: { name: "asc" },
  });

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
        <BreadcrumbProvider>
          <Topbar />
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
      </body>
    </html>
  );
}
