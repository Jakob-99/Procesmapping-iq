"use client";

import { useState, useTransition } from "react";
import { sendInterviewToProcessExperts } from "@/app/processes/actions";

import { ClayButton } from "./ui";

/*
  Sender interviewet til samtlige procesksperter på tværs af hele e2e-processen
  — ikke kun én underproces.
*/
export function SendInterviewButton({ processId }: { processId: string }) {
  const [pending, startTransition] = useTransition();
  const [sent, setSent] = useState<number | null>(null);

  return (
    <ClayButton
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const n = await sendInterviewToProcessExperts(processId);
          setSent(n ?? 0);
        })
      }
      className="!py-2 !text-[12.5px]"
    >
      {sent !== null ? `Sendt til ${sent}` : "Send interview"}
    </ClayButton>
  );
}
