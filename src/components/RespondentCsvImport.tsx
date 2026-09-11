"use client";

import { useRef, useState, useTransition } from "react";
import { importRespondents } from "@/app/(customer)/respondents/actions";
import { ClayButton } from "./ui";

type Row = { name: string; email: string; title?: string; category?: string };

// Simpelt, håndrullet CSV-format uden citationstegn — "navn,mail,titel,forretningsområde",
// én respondent pr. linje, titel/forretningsområde valgfri, valgfri header-linje der springes over.
function parseCsv(text: string): Row[] {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const rows: Row[] = [];
  for (const line of lines) {
    const [name, email, title, category] = line.split(",").map((c) => c.trim());
    if (!name || !email) continue;
    if (name.toLowerCase() === "navn" && email.toLowerCase() === "mail") continue; // header
    rows.push({ name, email, title: title || undefined, category: category || undefined });
  }
  return rows;
}

export function RespondentCsvImport() {
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<Row[]>([]);
  const [fileName, setFileName] = useState<string | null>(null);
  const [done, setDone] = useState<number | null>(null);
  const [pending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  function onFile(file: File) {
    setFileName(file.name);
    setDone(null);
    const reader = new FileReader();
    reader.onload = () => setRows(parseCsv(String(reader.result ?? "")));
    reader.readAsText(file);
  }

  function submit() {
    startTransition(async () => {
      const res = await importRespondents(rows);
      setDone(res.imported);
      setRows([]);
      setFileName(null);
      if (inputRef.current) inputRef.current.value = "";
    });
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="mb-4 ml-2 flex items-center gap-1.5 rounded-full border border-dashed border-(--color-line) px-3.5 py-1.5 text-[12px] font-medium text-(--color-muted) transition-colors hover:border-(--color-clay) hover:text-(--color-clay)"
      >
        + Importér CSV
      </button>
    );
  }

  return (
    <div className="mb-4 space-y-2 rounded-xl border border-(--color-line-soft) bg-(--color-raised) p-3.5">
      <div className="eyebrow mb-1">Importér respondenter fra CSV</div>
      <p className="text-[11.5px] leading-relaxed text-(--color-faint)">
        Én pr. linje: <code>navn,mail,titel,forretningsområde</code> (titel og
        forretningsområde valgfri). Findes mailen allerede, opdateres
        respondenten i stedet for at duplikeres.
      </p>
      <input
        ref={inputRef}
        type="file"
        accept=".csv,text/csv"
        onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])}
        className="w-full text-[12.5px]"
      />
      {fileName && rows.length > 0 && (
        <p className="text-[12px] text-(--color-clay)">
          {rows.length} rækker fundet i {fileName}.
        </p>
      )}
      {done !== null && (
        <p className="text-[12px] text-(--color-ok)">{done} respondenter importeret.</p>
      )}
      <div className="flex gap-2 pt-0.5">
        <ClayButton
          onClick={submit}
          disabled={pending || rows.length === 0}
          className="!py-1.5 !text-[12.5px]"
        >
          Importér {rows.length > 0 ? rows.length : ""}
        </ClayButton>
        <button
          onClick={() => setOpen(false)}
          className="text-[12px] text-(--color-faint) hover:text-(--color-text)"
        >
          Luk
        </button>
      </div>
    </div>
  );
}
