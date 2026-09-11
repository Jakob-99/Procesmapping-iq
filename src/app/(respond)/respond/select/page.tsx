import Link from "next/link";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getRespondent } from "@/lib/respondent-session";
import { PageHeader } from "@/components/PageHeader";
import { Empty, Panel } from "@/components/ui";
import { logoutRespondent } from "@/app/(respond)/respond/actions";

export const dynamic = "force-dynamic";

/*
  Første skærmbillede efter koden: en respondent kan have flere åbne
  interviews (forskellige agenter sendt til samme person) — vælg hvilket.
*/
export default async function RespondentSelectPage() {
  const respondent = await getRespondent();
  if (!respondent) redirect("/respond/login");

  const interviews = await db.interview.findMany({
    where: { respondentId: respondent.id, status: "OPEN" },
    include: { interviewAgent: true },
    orderBy: { startedAt: "asc" },
  });

  return (
    <div>
      <PageHeader
        eyebrow={respondent.name}
        title="Hvilket interview vil du svare på?"
        action={
          <form action={logoutRespondent}>
            <button className="text-[12.5px] text-(--color-muted) hover:text-(--color-text)">
              Ikke dig? Skift kode
            </button>
          </form>
        }
      />

      <div className="p-8">
        {interviews.length === 0 ? (
          <Empty>Du har ikke nogen åbne interviews lige nu.</Empty>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {interviews.map((iv) => (
              <Link key={iv.id} href={`/respond/session/${iv.id}`}>
                <Panel className="lift h-full transition-colors hover:border-(--color-clay-line)">
                  <div className="text-[15px] font-medium">{iv.interviewAgent.name}</div>
                </Panel>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
