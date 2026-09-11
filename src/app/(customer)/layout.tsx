import { Nav } from "@/components/Nav";
import { Topbar } from "@/components/Topbar";
import { BreadcrumbProvider } from "@/components/BreadcrumbContext";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/session";

export const dynamic = "force-dynamic";

/*
  Skallen for hele kundefladen — egen route-group ((customer)), adskilt fra
  admin-panelets segment (app/admin/layout.tsx). De to deler kun den
  fælles, chrome-løse app/layout.tsx (html/body) som forælder, aldrig
  hinandens Topbar/Nav — Next behandler dem som to forskellige
  layout-grene og cacher/genbruger dem uafhængigt af hinanden.
*/
export default async function CustomerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Organisationen er den indloggede brugers egen, ikke "den første i DB"
  // (flere kunder kan være logget ind samtidig). Ingen session giver et
  // tomt layout, som /login selv rendere indeni.
  const sessionUser = await getSessionUser();
  const organization = sessionUser
    ? await db.organization.findUnique({
        where: { id: sessionUser.organizationId },
        include: { users: { orderBy: { name: "asc" } } },
      })
    : null;

  // MCP-nøgler hører til engagementet, ikke organisationen direkte (se
  // ApiKey i schema.prisma) — samme "første engagement for organisationen"
  // som requireEngagement() bruger (lib/engagement.ts).
  const engagement = organization
    ? await db.engagement.findFirst({
        where: { organizationId: organization.id },
        orderBy: { createdAt: "asc" },
      })
    : null;
  const apiKeys = engagement
    ? await db.apiKey.findMany({
        where: { engagementId: engagement.id, revokedAt: null },
        orderBy: { createdAt: "desc" },
        select: { id: true, name: true, createdAt: true, lastUsedAt: true },
      })
    : [];

  if (!sessionUser) {
    // Ingen session — kun /login lander her (alle andre sider redirecter
    // dertil via requireEngagement/requireSessionUser). Fuldskærms, uden
    // menu og topbjælke, for man er jo ikke inde i noget endnu.
    return <main className="flex-1 overflow-y-auto">{children}</main>;
  }

  return (
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
                title: u.title,
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
          apiKeys={apiKeys.map((k) => ({
            id: k.id,
            name: k.name,
            createdAt: k.createdAt.toISOString(),
            lastUsedAt: k.lastUsedAt?.toISOString() ?? null,
          }))}
        />
        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
    </BreadcrumbProvider>
  );
}
