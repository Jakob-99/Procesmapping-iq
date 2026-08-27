import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/*
  Root-layoutet (app/layout.tsx) afgjorde tidligere kun ud fra session_uid-
  cookien om kundens Topbar/Nav skulle vises — det holdt ikke, fordi en
  konsulent kan sagtens have BÅDE en admin-session (admin_cid) OG en
  kunde-session (session_uid, fx fra at teste kundefladen som en seedet
  FDE-bruger) samtidig. Så viste /admin kundens fulde menu udenom, fordi
  layoutet ikke vidste at man stod på en admin-rute. Denne header fortæller
  layoutet det, uafhængigt af hvilke cookies der findes.
*/
export function middleware(request: NextRequest) {
  const headers = new Headers(request.headers);
  headers.set("x-app-section", request.nextUrl.pathname.startsWith("/admin") ? "admin" : "customer");
  return NextResponse.next({ request: { headers } });
}

export const config = {
  matcher: "/:path*",
};
