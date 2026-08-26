import Link from "next/link";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/PageHeader";
import { InterviewSession } from "@/components/InterviewSession";
import { Empty } from "@/components/ui";

export const dynamic = "force-dynamic";

/*
  Preview: kør interviewet igennem, før det sendes ud til medarbejderne.
  Konsulenten og procesejeren skal kunne se hvad folk faktisk bliver mødt af.
*/
export default async function InterviewPreviewPage({
  searchParams,
}: {
  searchParams: Promise<{ process?: string; sub?: string }>;
}) {
  const { process: processId, sub: subId } = await searchParams;

  // Peger man på en e2e-proces, tager vi dens første underproces i scope.
  const sp = subId
    ? await db.subProcess.findUnique({
        where: { id: subId },
        include: { process: true, assignee: true },
      })
    : processId
      ? await db.subProcess.findFirst({
          where: { processId, inScope: true },
          orderBy: { sortOrder: "asc" },
          include: { process: true, assignee: true },
        })
      : null;

  if (!sp) {
    return (
      <div className="p-10">
        <Empty>
          Vælg en proces først —{" "}
          <Link href="/processes" className="text-(--color-clay) hover:underline">
            gå til procesmodellen
          </Link>
          .
        </Empty>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        eyebrow={`${sp.process.name} · forhåndsvisning`}
        title={`Interview om ${sp.name}`}
        lead="Agenten veksler mellem at spørge frit og at række et lille skema frem, når svaret er noget der skal tælles eller vælges. Intet gemmes i denne visning."
        action={
          <Link
            href={`/processes/${sp.processId}`}
            className="text-[13px] text-(--color-muted) hover:text-(--color-text)"
          >
            ← Tilbage
          </Link>
        }
      />

      <InterviewSession
        preview
        subProcessId={sp.id}
        subProcessName={sp.name}
        employeeName={sp.assignee?.name ?? "Medarbejderen"}
      />
    </div>
  );
}
