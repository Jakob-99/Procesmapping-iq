"use client";

import { useRef, useState, useTransition } from "react";
import { createAgentImage, deleteAgentImage } from "@/app/(customer)/agents/actions";
import { ClayButton } from "./ui";

type AgentImage = {
  id: string;
  label: string;
  data: string;
};

/*
  Billeder agenten kan vælge at vise respondenten undervejs i interviewet —
  hvornår er op til agenten selv (se buildInterviewSystemPrompt/showImage),
  ikke fastlagt her. Man refererer et billede fra prompt-felterne ved at
  skrive dets label, fx "Vis [Emballage A] og spørg om førstehåndsindtryk".
*/
export function AgentImagesEditor({
  agentId,
  images,
}: {
  agentId: string;
  images: AgentImage[];
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [label, setLabel] = useState("");
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  function onFile(file: File) {
    setError(null);
    if (file.size > 4 * 1024 * 1024) {
      setError("Billedet er for stort (maks 4 MB).");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setPreview(String(reader.result ?? ""));
    reader.readAsDataURL(file);
  }

  function submit() {
    if (!label.trim() || !preview) return;
    startTransition(async () => {
      await createAgentImage(agentId, label, preview);
      setLabel("");
      setPreview(null);
      if (inputRef.current) inputRef.current.value = "";
      setOpen(false);
    });
  }

  return (
    <div>
      {images.length === 0 ? (
        <p className="mb-3 text-[12.5px] text-(--color-faint)">
          Ingen billeder endnu — agenten stiller kun spørgsmål i tekst.
        </p>
      ) : (
        <div className="mb-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {images.map((img) => (
            <div
              key={img.id}
              className="group relative overflow-hidden rounded-lg border border-(--color-line-soft) bg-(--color-raised)"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={img.data} alt={img.label} className="h-24 w-full object-cover" />
              <div className="flex items-center justify-between gap-2 px-2 py-1.5">
                <code className="min-w-0 truncate text-[11px] text-(--color-muted)">{img.label}</code>
                <button
                  onClick={() => startTransition(() => deleteAgentImage(img.id))}
                  disabled={pending}
                  className="shrink-0 text-[11px] text-(--color-faint) hover:text-(--color-alert)"
                >
                  Slet
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {images.length > 0 && (
        <p className="mb-3 text-[11.5px] leading-relaxed text-(--color-faint)">
          Referér et billede i prompt-felterne ovenfor ved at skrive dets label i firkantede parenteser, fx{" "}
          <code className="text-(--color-muted)">Vis [{images[0].label}] og spørg hvad de lægger mærke til.</code>{" "}
          Agenten vurderer selv hvornår det er relevant at vise det.
        </p>
      )}

      {!open ? (
        <button
          onClick={() => setOpen(true)}
          className="flex items-center gap-1.5 rounded-full border border-dashed border-(--color-line) px-3.5 py-1.5 text-[12px] font-medium text-(--color-muted) transition-colors hover:border-(--color-clay) hover:text-(--color-clay)"
        >
          + Tilføj billede
        </button>
      ) : (
        <div className="space-y-1.5 rounded-xl border border-(--color-line-soft) bg-(--color-raised) p-3.5">
          <input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder='Label, fx "Emballage A"'
            className="w-full rounded-md border border-(--color-line) bg-(--color-surface) px-2.5 py-1.5 text-[12.5px] outline-none focus:border-(--color-clay)"
          />
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])}
            className="w-full text-[12.5px]"
          />
          {preview && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={preview} alt="Forhåndsvisning" className="h-24 rounded-md object-cover" />
          )}
          {error && <p className="text-[12px] text-(--color-alert)">{error}</p>}
          <div className="flex gap-2 pt-0.5">
            <ClayButton onClick={submit} disabled={pending || !label.trim() || !preview} className="!py-1.5 !text-[12.5px]">
              Tilføj
            </ClayButton>
            <button
              onClick={() => {
                setOpen(false);
                setPreview(null);
                setLabel("");
              }}
              className="text-[12px] text-(--color-faint) hover:text-(--color-text)"
            >
              Annullér
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
