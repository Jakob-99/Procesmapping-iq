import { getSessionUser } from "@/lib/session";
import { buildSubProcessVsdx } from "@/lib/visio/subprocess";
import { loadSubProcessForVisio } from "@/lib/visio/load";

// Henter en underproces som Visio-fil (.vsdx). Kun for brugere i samme
// organisation som underprocessen.
export async function GET(_req: Request, { params }: { params: Promise<{ subId: string }> }) {
  const { subId } = await params;
  const user = await getSessionUser();
  if (!user) return new Response("Log ind først.", { status: 401 });

  const loaded = await loadSubProcessForVisio(subId);
  if (!loaded || loaded.organizationId !== user.organizationId) {
    return new Response("Ikke fundet.", { status: 404 });
  }

  const file = buildSubProcessVsdx(loaded.input);
  const fileName = `${loaded.input.title.replace(/[\\/:*?"<>|]+/g, " ").trim() || "Diagram"}.vsdx`;
  return new Response(file as unknown as BodyInit, {
    headers: {
      "Content-Type": "application/vnd.ms-visio.drawing",
      "Content-Disposition": `attachment; filename="${fileName.replace(/[^\x20-\x7e]/g, "_")}"; filename*=UTF-8''${encodeURIComponent(fileName)}`,
      "Cache-Control": "no-store",
    },
  });
}
