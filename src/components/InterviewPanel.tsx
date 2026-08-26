"use client";

import { useState } from "react";
import { Badge, type Tone } from "./ui";
import { NOTE_CATEGORIES } from "@/lib/domain";

const NOTE_TONE: Record<string, Tone> = {
  PAIN: "alert",
  WORKAROUND: "warn",
  RISK: "alert",
  KNOWLEDGE: "muted",
  OPPORTUNITY: "clay",
};

export type Note = {
  id: string;
  category: string;
  content: string;
  importance: number;
};

export type Line = { id: string; role: string; content: string };

/*
  Keynotes er indgangen til interviewet. Man læser den korte pointe, og kan
  folde selve samtalen ud bagved — så påstanden altid kan spores til det
  medarbejderen faktisk sagde.
*/
export function InterviewPanel({
  notes,
  transcript,
  interviewer,
}: {
  notes: Note[];
  transcript: Line[];
  interviewer: string | null;
}) {
  const [openNote, setOpenNote] = useState<string | null>(null);
  const [showTranscript, setShowTranscript] = useState(false);

  return (
    <div>
      {transcript.length > 0 && (
        <button
          onClick={() => setShowTranscript((v) => !v)}
          className="mb-3 text-[11.5px] font-medium text-(--color-clay) hover:underline"
        >
          {showTranscript ? "Skjul samtalen" : "Se hele samtalen →"}
        </button>
      )}

      {notes.length === 0 ? (
        <p className="text-[13px] text-(--color-faint)">
          Ingen noter endnu — agenten har ikke interviewet nogen om denne
          underproces.
        </p>
      ) : (
        <div className="space-y-2">
          {notes
            .slice()
            .sort((a, b) => b.importance - a.importance)
            .map((n) => {
              const open = openNote === n.id;
              return (
                <button
                  key={n.id}
                  onClick={() => setOpenNote(open ? null : n.id)}
                  className={`block w-full border-l-2 py-2.5 pl-3 pr-2 text-left transition-colors ${
                    open
                      ? "border-(--color-clay-line) bg-(--color-clay-wash)"
                      : "border-(--color-line) bg-(--color-surface) hover:border-(--color-clay-line)"
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <Badge tone={NOTE_TONE[n.category] ?? "muted"}>
                      {NOTE_CATEGORIES[n.category as keyof typeof NOTE_CATEGORIES] ??
                        n.category}
                    </Badge>
                    {n.importance === 3 && (
                      <span className="text-[10px] text-(--color-faint)">
                        Vigtig
                      </span>
                    )}
                  </div>

                  <p
                    className={`mt-2 text-[12.5px] leading-relaxed text-(--color-muted) ${
                      open ? "" : "line-clamp-2"
                    }`}
                  >
                    {n.content}
                  </p>

                  {open && interviewer && (
                    <p className="mt-3 border-t border-(--color-clay-line) pt-2.5 text-[11px] text-(--color-faint)">
                      Fra interview med {interviewer}
                    </p>
                  )}
                </button>
              );
            })}
        </div>
      )}

      {showTranscript && transcript.length > 0 && (
        <div className="mt-4 space-y-3 border-t border-(--color-line) pt-4">
          {transcript.map((l) => (
            <div key={l.id}>
              <div className="eyebrow mb-1">
                {l.role === "agent" ? "Corner IQ" : (interviewer ?? "Medarbejder")}
              </div>
              <p className="text-[12.5px] leading-relaxed text-(--color-muted)">
                {l.content}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
