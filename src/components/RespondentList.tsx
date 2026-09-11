"use client";

import { useState } from "react";
import { Empty } from "./ui";
import { RespondentRow } from "./RespondentRow";

type Respondent = {
  id: string;
  name: string;
  email: string;
  title: string | null;
  category: string | null;
};

export function RespondentList({ respondents }: { respondents: Respondent[] }) {
  const [query, setQuery] = useState("");

  const q = query.trim().toLowerCase();
  const filtered = q
    ? respondents.filter((r) =>
        [r.name, r.email, r.title, r.category].some((v) => v?.toLowerCase().includes(q)),
      )
    : respondents;

  return (
    <div>
      {respondents.length > 5 && (
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Søg på navn, mail, titel eller forretningsområde…"
          className="mb-4 w-full rounded-md border border-(--color-line) bg-(--color-surface) px-3 py-2 text-[13px] outline-none focus:border-(--color-clay)"
        />
      )}
      {filtered.length === 0 ? (
        <Empty>{q ? "Ingen respondenter matcher søgningen." : "Ingen respondenter endnu."}</Empty>
      ) : (
        <div className="divide-y divide-(--color-line-soft)">
          {filtered.map((r) => (
            <RespondentRow
              key={r.id}
              id={r.id}
              name={r.name}
              email={r.email}
              title={r.title}
              category={r.category}
            />
          ))}
        </div>
      )}
    </div>
  );
}
