"use client";

import { useState, useTransition } from "react";
import { createApiKey, revokeApiKey } from "@/app/actions/api-keys";
import { ClayButton, OutlineButton, Badge } from "./ui";

type ApiKeyRow = {
  id: string;
  name: string;
  createdAt: string;
  lastUsedAt: string | null;
};

export function ApiKeyManager({ keys }: { keys: ApiKeyRow[] }) {
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [freshKey, setFreshKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <section>
      <div className="mb-2 flex items-center justify-between">
        <div className="eyebrow">MCP API-nøgler</div>
        {!adding && (
          <OutlineButton
            onClick={() => {
              setAdding(true);
              setFreshKey(null);
              setError(null);
            }}
          >
            + Ny nøgle
          </OutlineButton>
        )}
      </div>
      <p className="mb-3 text-[12px] text-(--color-faint)">
        Lader en ekstern klient (fx en Claude-agent via MCP) læse jeres interview-runder,
        transskriptioner og indsigter — read-only, ingen adgang til at sende eller ændre noget.
      </p>

      {freshKey && (
        <div className="mb-3 rounded-md border border-(--color-clay-line) bg-(--color-clay-wash) px-3 py-2.5">
          <div className="mb-1 text-[12px] font-medium text-(--color-clay)">
            Nøglen vises kun denne ene gang — kopier den nu:
          </div>
          <code className="block break-all rounded bg-(--color-surface) px-2 py-1.5 text-[12px]">{freshKey}</code>
        </div>
      )}

      {adding && (
        <div className="mb-3 flex flex-wrap items-center gap-2 rounded-md border border-(--color-line-soft) px-3 py-2.5">
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Navn, fx “Claude MCP – Q3 analyse”"
            className="min-w-0 flex-1 rounded-md border border-(--color-line) bg-(--color-surface) px-2.5 py-1.5 text-[12.5px] outline-none focus:border-(--color-clay)"
          />
          <ClayButton
            disabled={pending || !name.trim()}
            onClick={() =>
              startTransition(async () => {
                const result = await createApiKey(name);
                if ("error" in result) {
                  setError(result.error);
                  return;
                }
                setFreshKey(result.key);
                setName("");
                setAdding(false);
                setError(null);
              })
            }
            className="!py-1.5 !text-[12.5px]"
          >
            Opret
          </ClayButton>
          <OutlineButton onClick={() => setAdding(false)}>Annuller</OutlineButton>
          {error && <div className="w-full text-[11.5px] text-(--color-alert)">{error}</div>}
        </div>
      )}

      {keys.length === 0 ? (
        <div className="text-[12px] text-(--color-faint)">Ingen nøgler oprettet endnu.</div>
      ) : (
        <div className="divide-y divide-(--color-line-soft) rounded-lg border border-(--color-line-soft)">
          {keys.map((k) => (
            <div key={k.id} className="flex items-center justify-between gap-3 px-3 py-2.5">
              <div className="min-w-0">
                <div className="truncate text-[13px] font-medium">{k.name}</div>
                <div className="truncate text-[11px] text-(--color-faint)">
                  Oprettet {new Date(k.createdAt).toLocaleDateString("da-DK")}
                  {k.lastUsedAt
                    ? ` · sidst brugt ${new Date(k.lastUsedAt).toLocaleDateString("da-DK")}`
                    : " · aldrig brugt"}
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <Badge tone="ok">Aktiv</Badge>
                {confirmingId === k.id ? (
                  <>
                    <span className="text-[11.5px] text-(--color-alert)">Sikker?</span>
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => {
                        setConfirmingId(null);
                        startTransition(() => revokeApiKey(k.id));
                      }}
                      className="rounded-md px-2 py-1.5 text-[12px] font-medium text-(--color-alert) transition-opacity hover:opacity-70 disabled:opacity-40"
                    >
                      Ja, tilbagekald
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmingId(null)}
                      className="rounded-md px-2 py-1.5 text-[12px] text-(--color-muted) transition-opacity hover:opacity-70"
                    >
                      Annuller
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => setConfirmingId(k.id)}
                    className="rounded-md px-2 py-1.5 text-[12px] text-(--color-alert) transition-opacity hover:opacity-70 disabled:opacity-40"
                  >
                    Tilbagekald
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
