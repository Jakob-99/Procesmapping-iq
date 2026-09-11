"use client";

import { useState, useTransition } from "react";
import { joinPublicInterview } from "@/app/(respond)/respond/actions";
import { ClayButton } from "./ui";

export function PublicJoinForm({ slug }: { slug: string }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit() {
    if (!name.trim() || !email.trim() || pending) return;
    setError(null);
    startTransition(async () => {
      const res = await joinPublicInterview(slug, name, email);
      if (res?.error) setError(res.error);
    });
  }

  return (
    <div className="mx-auto max-w-xs space-y-2.5">
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Dit navn"
        autoFocus
        className="w-full rounded-lg border border-(--color-line) bg-(--color-surface) px-4 py-3 text-center text-[15px] outline-none transition-colors focus:border-(--color-clay-line)"
      />
      <input
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && submit()}
        placeholder="din@mail.dk"
        type="email"
        className="w-full rounded-lg border border-(--color-line) bg-(--color-surface) px-4 py-3 text-center text-[15px] outline-none transition-colors focus:border-(--color-clay-line)"
      />
      {error && <p className="text-center text-[12.5px] text-(--color-alert)">{error}</p>}
      <ClayButton
        onClick={submit}
        disabled={pending || !name.trim() || !email.trim()}
        className="w-full justify-center !py-3"
      >
        {pending ? "Starter…" : "Start interviewet"}
      </ClayButton>
    </div>
  );
}
