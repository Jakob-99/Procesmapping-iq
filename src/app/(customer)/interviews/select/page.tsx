import Link from "next/link";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getInterviewUser } from "@/lib/interview-session";
import { PageHeader } from "@/components/PageHeader";
import { Empty, Panel } from "@/components/ui";
import { logoutInterview } from "@/app/(customer)/interviews/actions";

export const dynamic = "force-dynamic";

/*
  Første skærmbillede efter koden: man er procesekspert, men ofte på flere
  underprocesser på tværs af flere e2e-processer — så man vælger hvilken man
  vil interviewes om, før selve interviewet starter.
*/
export default async function InterviewSelectPage() {
  const user = await getInterviewUser();
  if (!user) redirect("/interviews/login");

  const experts = await db.subProcessExpert.findMany({
    where: { email: user.email },
    include: { subProcess: { include: { process: true } } },
    orderBy: { createdAt: "asc" },
  });

  // Samme underproces kan i teorien optræde to gange (tilføjet to gange) —
  // vis den kun én gang.
  const seen = new Set<string>();
  const items = experts.filter((e) => {
    if (seen.has(e.subProcessId)) return false;
    seen.add(e.subProcessId);
    return true;
  });

  return (
    <div>
      <PageHeader
        eyebrow={user.name}
        title="Hvilken proces vil du fortælle om?"
        action={
          <form action={logoutInterview}>
            <button className="text-[12.5px] text-(--color-muted) hover:text-(--color-text)">
              Ikke dig? Skift kode
            </button>
          </form>
        }
      />

      <div className="p-8">
        {items.length === 0 ? (
          <Empty>Du er ikke tilknyttet som procesekspert på nogen processer endnu.</Empty>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {items.map((e) => (
              <Link key={e.id} href={`/interviews/session/${e.subProcessId}`}>
                <Panel className="lift h-full transition-colors hover:border-(--color-clay-line)">
                  <div className="eyebrow mb-1.5">{e.subProcess.process.name}</div>
                  <div className="text-[15px] font-medium">{e.subProcess.name}</div>
                </Panel>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
