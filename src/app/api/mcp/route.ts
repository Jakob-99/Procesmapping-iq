import { NextResponse } from "next/server";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import type { JSONRPCMessage } from "@modelcontextprotocol/sdk/types.js";
import { resolveApiKey } from "@/lib/mcp/auth";
import { registerTools } from "@/lib/mcp/tools";

export const runtime = "nodejs";
export const maxDuration = 60;

// SDK'ens StreamableHTTPServerTransport er bygget til Node's rå
// IncomingMessage/ServerResponse, ikke Next's Web-standard Request/Response,
// så vi bruger en minimal, selvskrevet transport i stedet. Den er bevidst
// "one-shot" og stateless: hver HTTP-POST opretter sin egen McpServer og
// lever kun for varigheden af ét JSON-RPC-kald, uden session mellem kald —
// helt fint her, da tools/list og tools/call ikke deler nogen tilstand.
class OneShotTransport implements Transport {
  onmessage?: (message: JSONRPCMessage) => void;
  onclose?: () => void;
  onerror?: (error: Error) => void;

  private resolveResponse!: (message: JSONRPCMessage) => void;
  private responsePromise = new Promise<JSONRPCMessage>((resolve) => {
    this.resolveResponse = resolve;
  });

  async start() {}
  async send(message: JSONRPCMessage) {
    this.resolveResponse(message);
  }
  async close() {}

  // Kun beskeder med et "id" forventer et svar (JSON-RPC requests) —
  // notifikationer (fx "notifications/initialized") udløser ingen send()
  // og skal ikke ventes på.
  async handle(message: JSONRPCMessage): Promise<JSONRPCMessage | null> {
    const isRequest = "id" in message && "method" in message;
    this.onmessage?.(message);
    return isRequest ? this.responsePromise : null;
  }
}

function jsonRpcError(id: unknown, code: number, message: string) {
  return NextResponse.json({ jsonrpc: "2.0", id: id ?? null, error: { code, message } }, { status: 200 });
}

export async function POST(req: Request) {
  const auth = await resolveApiKey(req.headers);
  if (!auth) {
    return NextResponse.json(
      { jsonrpc: "2.0", id: null, error: { code: -32001, message: "Ugyldig eller manglende API-nøgle." } },
      { status: 401 },
    );
  }

  let message: JSONRPCMessage;
  try {
    message = await req.json();
  } catch {
    return jsonRpcError(null, -32700, "Ugyldig JSON.");
  }

  const server = new McpServer({ name: "corner-iq", version: "1.0.0" });
  registerTools(server, auth.engagementId);

  const transport = new OneShotTransport();
  await server.connect(transport);

  try {
    const response = await transport.handle(message);
    if (!response) return new NextResponse(null, { status: 202 });
    return NextResponse.json(response);
  } finally {
    await server.close();
  }
}

export async function GET() {
  // Denne server er stateless (se OneShotTransport ovenfor) og understøtter
  // derfor ikke den valgfrie server-til-klient SSE-strøm fra MCP-specen.
  return new NextResponse(null, { status: 405 });
}
