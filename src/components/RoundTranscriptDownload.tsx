"use client";

type Message = { role: string; content: string };
type InterviewData = {
  id: string;
  agentName: string;
  respondentName: string;
  status: string;
  startedAt: Date;
  messages: Message[];
};

const STATUS_LABEL: Record<string, string> = {
  OPEN: "Sendt, afventer svar",
  COMPLETED: "Afsluttet",
};

function transcriptText(iv: InterviewData): string {
  const lines = [
    `Agent: ${iv.agentName}`,
    `Respondent: ${iv.respondentName}`,
    `Status: ${STATUS_LABEL[iv.status] ?? iv.status}`,
    `Dato: ${iv.startedAt.toLocaleDateString("da-DK")}`,
    "",
    ...iv.messages.map((m) => `${m.role === "agent" ? iv.agentName : iv.respondentName}: ${m.content}`),
  ];
  return lines.join("\n");
}

function download(filename: string, text: string) {
  const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function InterviewDownloadButton({ interview }: { interview: InterviewData }) {
  return (
    <button
      onClick={() => download(`${interview.respondentName}.txt`, transcriptText(interview))}
      disabled={interview.messages.length === 0}
      className="shrink-0 text-[11px] text-(--color-faint) hover:text-(--color-clay) disabled:opacity-30"
    >
      ↓ Download
    </button>
  );
}

export function DownloadAllButton({ interviews }: { interviews: InterviewData[] }) {
  const withMessages = interviews.filter((iv) => iv.messages.length > 0);
  function downloadAll() {
    const text = withMessages
      .map(transcriptText)
      .join("\n\n" + "—".repeat(40) + "\n\n");
    download("interviews.txt", text);
  }
  return (
    <button
      onClick={downloadAll}
      disabled={withMessages.length === 0}
      className="rounded-full border border-dashed border-(--color-line) px-3.5 py-1.5 text-[12px] font-medium text-(--color-muted) transition-colors hover:border-(--color-clay) hover:text-(--color-clay) disabled:opacity-40"
    >
      ↓ Download alle ({withMessages.length})
    </button>
  );
}
