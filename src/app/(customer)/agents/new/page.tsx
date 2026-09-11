import { SetBreadcrumb } from "@/components/BreadcrumbContext";
import { AgentEditor } from "@/components/AgentEditor";

export const dynamic = "force-dynamic";

// Agenten man opretter får en hel side for sig selv — samme editor som
// /agents/[id], bare uden agent-prop (create-tilstand) og uden de
// eksisterende-agent-only sektioner (kvant-spørgsmål, offentlig invitation).
export default function NewAgentPage() {
  return (
    <div>
      <SetBreadcrumb items={[{ label: "Interview agenter", href: "/agents" }, { label: "Ny agent" }]} />
      <AgentEditor />
    </div>
  );
}
