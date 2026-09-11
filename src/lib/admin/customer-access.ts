import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireConsultant } from "@/lib/consultant-session";

// Delt af alle faner under /admin/customers/[id] (Oversigt/Adgang/MCP
// API-nøgler) — samme adgangstjek alle tre skal lave: 404 hvis engagementet
// ikke findes, ELLER hvis denne konsulent ikke har fået adgang til det.
export async function requireCustomerAccess(engagementId: string) {
  const consultant = await requireConsultant();

  const access = await db.consultantEngagementAccess.findFirst({
    where: { consultantId: consultant.id, engagementId },
    include: {
      engagement: {
        include: {
          organization: { include: { users: { orderBy: { name: "asc" } } } },
          _count: { select: { respondents: true, interviewAgents: true } },
          consultantAccess: { include: { consultant: true } },
        },
      },
    },
  });
  if (!access) notFound();

  return { consultant, access };
}
