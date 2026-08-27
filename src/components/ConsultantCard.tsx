"use client";

import { useTransition } from "react";
import { deleteConsultant } from "@/app/(customer)/hitl/actions";

function bookingHref(consultant: { email: string | null; bookingUrl: string | null; name: string }) {
  if (consultant.bookingUrl) return consultant.bookingUrl;
  if (consultant.email) {
    const subject = encodeURIComponent(`Møde med ${consultant.name}`);
    return `mailto:${consultant.email}?subject=${subject}`;
  }
  return null;
}

export function ConsultantCard({
  id,
  name,
  bio,
  email,
  phone,
  bookingUrl,
}: {
  id: string;
  name: string;
  bio: string | null;
  email: string | null;
  phone: string | null;
  bookingUrl: string | null;
}) {
  const [pending, startTransition] = useTransition();
  const href = bookingHref({ email, bookingUrl, name });

  function remove() {
    if (!confirm(`Fjern ${name} fra konsulentlisten?`)) return;
    startTransition(() => deleteConsultant(id));
  }

  return (
    <div
      className={`group rounded-lg border border-(--color-line-soft) bg-(--color-surface) p-4 transition-opacity ${
        pending ? "opacity-40" : ""
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="text-[14.5px] font-semibold leading-tight">{name}</div>
        <button
          onClick={remove}
          disabled={pending}
          title="Fjern konsulent"
          className="shrink-0 text-[11px] text-(--color-faint) opacity-0 transition-opacity hover:text-(--color-alert) group-hover:opacity-100"
        >
          Fjern
        </button>
      </div>
      {bio && (
        <p className="mt-1.5 line-clamp-2 text-[12.5px] leading-relaxed text-(--color-muted)">
          {bio}
        </p>
      )}
      <div className="mt-3 space-y-1 text-[12px] text-(--color-faint)">
        {email && (
          <a href={`mailto:${email}`} className="block truncate hover:text-(--color-clay)">
            {email}
          </a>
        )}
        {phone && (
          <a href={`tel:${phone.replace(/\s+/g, "")}`} className="block hover:text-(--color-clay)">
            {phone}
          </a>
        )}
        {!email && !phone && <span>Ingen kontaktoplysninger endnu.</span>}
      </div>
      {href && (
        <a
          href={href}
          target={bookingUrl ? "_blank" : undefined}
          rel={bookingUrl ? "noopener noreferrer" : undefined}
          className="mt-3 block rounded-md border border-(--color-clay-line) bg-(--color-clay-wash) px-3 py-1.5 text-center text-[12px] font-medium text-(--color-clay) transition-colors hover:bg-(--color-clay-line)"
        >
          Book møde
        </a>
      )}
    </div>
  );
}
