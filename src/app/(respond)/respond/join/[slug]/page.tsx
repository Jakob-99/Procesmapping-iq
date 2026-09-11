import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { PublicJoinForm } from "@/components/PublicJoinForm";

export const dynamic = "force-dynamic";

// Offentlig, uautentificeret join-side — samme "tomme main"-layoutgren som
// /respond/login rammer, når ingen session_uid-cookie er sat.
export default async function PublicJoinPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const agent = await db.interviewAgent.findUnique({ where: { publicJoinSlug: slug } });
  if (!agent || !agent.publicJoinEnabled) notFound();

  return (
    <div className="dot-grid flex h-full items-center justify-center p-8">
      <div className="w-full max-w-sm text-center">
        <div className="eyebrow mb-2">Corner IQ</div>
        <h1 className="mb-3 text-[24px] font-semibold tracking-tight">{agent.name}</h1>
        <p className="mb-8 text-[14px] text-(--color-faint)">
          Udfyld navn og mail for at starte interviewet.
        </p>
        <PublicJoinForm slug={slug} />
      </div>
    </div>
  );
}
