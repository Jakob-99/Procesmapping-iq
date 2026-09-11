"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteInterview } from "@/app/(customer)/interviews/actions";

export function DeleteInterviewButton({ id }: { id: string }) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function remove() {
    if (!confirm("Slet dette interview? Transskription og noter forsvinder permanent.")) return;
    startTransition(async () => {
      await deleteInterview(id);
      router.push("/interviews");
    });
  }

  return (
    <button
      onClick={remove}
      disabled={pending}
      className="text-[12.5px] text-(--color-faint) hover:text-(--color-alert)"
    >
      {pending ? "Sletter…" : "Slet interview"}
    </button>
  );
}
