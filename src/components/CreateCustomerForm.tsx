"use client";

import { useState, useTransition } from "react";
import { createCustomer } from "@/app/admin/actions";
import { ROLES } from "@/lib/roles";
import { ClayButton, Panel } from "./ui";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <div className="mb-1.5 text-[12px] font-medium text-(--color-muted)">{label}</div>
      {children}
    </label>
  );
}

const inputClass =
  "w-full rounded-md border border-(--color-line) bg-(--color-surface) px-3 py-2 text-[13px] outline-none focus:border-(--color-clay)";

export function CreateCustomerForm() {
  const [orgName, setOrgName] = useState("");
  const [industry, setIndustry] = useState("");
  const [engagementName, setEngagementName] = useState("");
  const [contactName, setContactName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactRole, setContactRole] = useState<string>("PROCESS_OWNER");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const canSubmit =
    orgName.trim() && engagementName.trim() && contactName.trim() && contactEmail.trim();

  function submit() {
    if (!canSubmit || pending) return;
    setError(null);
    startTransition(async () => {
      const res = await createCustomer({
        orgName,
        industry,
        engagementName,
        contactName,
        contactEmail,
        contactRole,
      });
      if (res?.error) setError(res.error);
    });
  }

  return (
    <Panel className="mx-auto max-w-xl">
      <div className="space-y-4">
        <div className="eyebrow">Virksomhed</div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Virksomhedens navn">
            <input
              value={orgName}
              onChange={(e) => setOrgName(e.target.value)}
              placeholder="Fx Nordvest Industri A/S"
              className={inputClass}
            />
          </Field>
          <Field label="Branche (valgfrit)">
            <input
              value={industry}
              onChange={(e) => setIndustry(e.target.value)}
              placeholder="Fx Produktion og engros"
              className={inputClass}
            />
          </Field>
        </div>
        <Field label="Engagementets navn">
          <input
            value={engagementName}
            onChange={(e) => setEngagementName(e.target.value)}
            placeholder="Fx AI-native transformation 2026"
            className={inputClass}
          />
        </Field>

        <div className="border-t border-(--color-line-soft) pt-4">
          <div className="eyebrow mb-3">Første bruger hos kunden</div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Navn">
              <input
                value={contactName}
                onChange={(e) => setContactName(e.target.value)}
                placeholder="Fx Mette Krogh"
                className={inputClass}
              />
            </Field>
            <Field label="Mail">
              <input
                value={contactEmail}
                onChange={(e) => setContactEmail(e.target.value)}
                type="email"
                placeholder="mette@kunde.dk"
                className={inputClass}
              />
            </Field>
          </div>
          <div className="mt-4">
            <Field label="Rolle">
              <select
                value={contactRole}
                onChange={(e) => setContactRole(e.target.value)}
                className={inputClass}
              >
                {Object.entries(ROLES).map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </select>
            </Field>
          </div>
        </div>

        {error && <p className="text-[12.5px] text-(--color-alert)">{error}</p>}

        <ClayButton onClick={submit} disabled={!canSubmit || pending} className="w-full justify-center !py-2.5">
          {pending ? "Opretter…" : "Opret virksomhed"}
        </ClayButton>
      </div>
    </Panel>
  );
}
