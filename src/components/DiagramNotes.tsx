"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { addNote, deleteNote, updateNote } from "@/app/(customer)/processes/[processId]/[subId]/actions";

/*
  Fritstående noter på tegnefladen — som en BPMN-tekstannotation: en
  kantet parentes til venstre med teksten ved siden af. Klik på en note for
  at skrive i den, træk i den for at flytte den. En tom note slettes, når
  man klikker væk fra den.

  placing: efter "+ Note" i redigeringslinjen fanger laget ét klik på
  tegnefladen og opretter noten præcis dér.
*/

export type Note = { id: string; text: string; x: number; y: number };

export function DiagramNotes({
  processId,
  subProcessId,
  notes,
  placing,
  scale = 1,
  onPlaced,
}: {
  processId: string;
  subProcessId: string;
  notes: Note[];
  placing: boolean;
  scale?: number;
  onPlaced: () => void;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  return (
    <>
      {placing && (
        <div
          data-no-pan
          className="absolute inset-0 z-20 cursor-crosshair bg-(--color-clay-wash)/20"
          onClick={(e) => {
            const r = e.currentTarget.getBoundingClientRect();
            const x = (e.clientX - r.left) / scale;
            const y = (e.clientY - r.top) / scale;
            onPlaced();
            startTransition(async () => {
              const id = await addNote(processId, subProcessId, x, y);
              if (id) setEditingId(id);
            });
          }}
        />
      )}
      {notes.map((n) => (
        <NoteItem
          key={n.id}
          note={n}
          editing={editingId === n.id}
          onEdit={() => setEditingId(n.id)}
          onDone={() => setEditingId(null)}
          scale={scale}
          processId={processId}
          subProcessId={subProcessId}
        />
      ))}
    </>
  );
}

function NoteItem({
  note,
  editing,
  onEdit,
  onDone,
  scale,
  processId,
  subProcessId,
}: {
  note: Note;
  editing: boolean;
  onEdit: () => void;
  onDone: () => void;
  scale: number;
  processId: string;
  subProcessId: string;
}) {
  const [text, setText] = useState(note.text);
  const [pos, setPos] = useState({ x: note.x, y: note.y });
  const [, startTransition] = useTransition();
  // Trækket regnes fra startpunktet i skærm-pixels, omregnet med zoom.
  const drag = useRef<{ cx: number; cy: number; x0: number; y0: number; moved: boolean } | null>(null);

  useEffect(() => setText(note.text), [note.text]);
  useEffect(() => setPos({ x: note.x, y: note.y }), [note.x, note.y]);

  function finishEditing() {
    onDone();
    if (!text.trim()) {
      startTransition(() => deleteNote(processId, subProcessId, note.id));
    } else if (text !== note.text) {
      startTransition(() => updateNote(processId, subProcessId, note.id, { text }));
    }
  }

  return (
    <div
      data-no-pan
      className={`group absolute z-10 ${editing ? "" : "cursor-grab select-none active:cursor-grabbing"}`}
      style={{ left: pos.x, top: pos.y }}
      onPointerDown={(e) => {
        if (editing || (e.target as HTMLElement).closest("button")) return;
        e.currentTarget.setPointerCapture(e.pointerId);
        drag.current = { cx: e.clientX, cy: e.clientY, x0: pos.x, y0: pos.y, moved: false };
      }}
      onPointerMove={(e) => {
        const d = drag.current;
        if (!d) return;
        const x = d.x0 + (e.clientX - d.cx) / scale;
        const y = d.y0 + (e.clientY - d.cy) / scale;
        if (Math.abs(e.clientX - d.cx) + Math.abs(e.clientY - d.cy) > 3) d.moved = true;
        setPos({ x: Math.max(0, x), y: Math.max(0, y) });
      }}
      onPointerUp={() => {
        const d = drag.current;
        drag.current = null;
        if (!d) return;
        if (d.moved) {
          startTransition(() => updateNote(processId, subProcessId, note.id, { x: pos.x, y: pos.y }));
        } else {
          onEdit();
        }
      }}
    >
      {/* BPMN-tekstannotation: kantet parentes til venstre */}
      <div className="relative min-w-[120px] max-w-[220px] bg-(--color-surface)/90 py-1.5 pl-3 pr-2">
        <span
          aria-hidden
          className="pointer-events-none absolute inset-y-0 left-0 w-3 border-y-[1.5px] border-l-[1.5px] border-(--color-text)"
        />
        {editing ? (
          <textarea
            autoFocus
            value={text}
            onChange={(e) => setText(e.target.value)}
            onBlur={finishEditing}
            onKeyDown={(e) => {
              if (e.key === "Escape") (e.currentTarget as HTMLTextAreaElement).blur();
            }}
            rows={Math.max(2, text.split("\n").length)}
            placeholder="Skriv en note…"
            className="block w-[190px] resize-none bg-transparent text-[12px] leading-snug text-(--color-text) outline-none placeholder:text-(--color-faint)"
          />
        ) : (
          <p className="whitespace-pre-wrap text-[12px] leading-snug text-(--color-text)">
            {note.text || <span className="text-(--color-faint)">Tom note</span>}
          </p>
        )}
      </div>
      {!editing && (
        <button
          type="button"
          title="Slet note"
          onClick={() => startTransition(() => deleteNote(processId, subProcessId, note.id))}
          className="absolute -right-2 -top-2 hidden h-5 w-5 items-center justify-center rounded-full border border-(--color-line) bg-(--color-surface) text-[11px] leading-none text-(--color-faint) hover:text-(--color-alert) group-hover:flex"
        >
          ×
        </button>
      )}
    </div>
  );
}
