"use client";

import { useState } from "react";
import Link from "next/link";
import { Empty, Badge, Panel } from "./ui";
import { daysAgo } from "@/lib/format";

const STATUS_LABEL: Record<string, string> = {
  OPEN: "Sendt, afventer svar",
  COMPLETED: "Afsluttet",
};

type InterviewRow = {
  id: string;
  status: string;
  startedAt: Date;
  interviewAgent: { name: string };
  respondent: { name: string };
  interviewRound: { name: string };
  sentBy: { name: string } | null;
};

export function InterviewList({ interviews }: { interviews: InterviewRow[] }) {
  const [query, setQuery] = useState("");

  const q = query.trim().toLowerCase();
  const filtered = q
    ? interviews.filter((iv) =>
        [iv.interviewAgent.name, iv.respondent.name, iv.interviewRound.name].some((v) =>
          v.toLowerCase().includes(q),
        ),
      )
    : interviews;

  return (
    <div>
      {interviews.length > 5 && (
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Søg på agent, respondent eller runde…"
          className="mb-3 w-full rounded-md border border-(--color-line) bg-(--color-surface) px-3 py-2 text-[13px] outline-none focus:border-(--color-clay)"
        />
      )}
      {filtered.length === 0 ? (
        <Empty>{q ? "Ingen interviews matcher søgningen." : "Ingen interviews sendt endnu."}</Empty>
      ) : (
        <div className="space-y-2.5">
          {filtered.map((iv) => (
            <Link key={iv.id} href={`/interviews/${iv.id}`} className="block">
              <Panel className="lift flex items-center justify-between gap-4 transition-colors hover:border-(--color-clay-line)">
                <div className="min-w-0">
                  <div className="text-[14px] font-medium">{iv.interviewAgent.name}</div>
                  <div className="mt-0.5 text-[12.5px] text-(--color-muted)">
                    {iv.respondent.name}
                    <span className="text-(--color-faint)"> · {iv.interviewRound.name}</span>
                    {iv.sentBy && <span className="text-(--color-faint)"> · sendt af {iv.sentBy.name}</span>}
                    {iv.status === "OPEN" && (
                      <span className="text-(--color-faint)"> · sendt {daysAgo(iv.startedAt)}</span>
                    )}
                  </div>
                </div>
                <Badge tone={iv.status === "COMPLETED" ? "ok" : "clay"}>
                  {STATUS_LABEL[iv.status] ?? iv.status}
                </Badge>
              </Panel>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
