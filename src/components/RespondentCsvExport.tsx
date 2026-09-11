"use client";

type Respondent = {
  name: string;
  email: string;
  title: string | null;
  category: string | null;
};

// Modstykket til RespondentCsvImport — samme kolonneformat, så en eksport
// kan importeres direkte igen (fx til en anden kunde).
function toCsv(respondents: Respondent[]): string {
  const rows = respondents.map((r) =>
    [r.name, r.email, r.title ?? "", r.category ?? ""].map((v) => v.replaceAll(",", " ")).join(","),
  );
  return ["navn,mail,titel,forretningsområde", ...rows].join("\n");
}

export function RespondentCsvExport({ respondents }: { respondents: Respondent[] }) {
  function download() {
    const blob = new Blob([toCsv(respondents)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "respondenter.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <button
      onClick={download}
      disabled={respondents.length === 0}
      className="mb-4 ml-2 flex items-center gap-1.5 rounded-full border border-dashed border-(--color-line) px-3.5 py-1.5 text-[12px] font-medium text-(--color-muted) transition-colors hover:border-(--color-clay) hover:text-(--color-clay) disabled:opacity-40"
    >
      ↓ Eksportér CSV
    </button>
  );
}
