import { type NextRequest, NextResponse } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

const PUBLIC_PATHS = ["/login", "/register", "/forgot-password", "/reset-password", "/privacy", "/terms"];

function isPublicPath(path: string): boolean {
  return PUBLIC_PATHS.includes(path);
}

function isCronApi(path: string): boolean {
  return path.startsWith("/api/cron");
}

function isExtensionIngestApi(path: string): boolean {
  return path === "/api/price-update";
}

function hasBearerAuth(request: NextRequest): boolean {
  const header = request.headers.get("authorization");
  return Boolean(header?.startsWith("Bearer "));
}

function isUserApi(path: string): boolean {
  return path.startsWith("/api/") && !isCronApi(path);
}

function isAuthCallback(path: string): boolean {
  return path.startsWith("/auth/callback");
}

export async function middleware(request: NextRequest) {
  const { supabaseResponse, user } = await updateSession(request);
  const path = request.nextUrl.pathname;

  if (isPublicPath(path) && user && (path === "/login" || path === "/register")) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  if (isUserApi(path) && !user && !isExtensionIngestApi(path) && !hasBearerAuth(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isPublicPath(path) && !isCronApi(path) && !isAuthCallback(path) && !path.startsWith("/api/") && !user) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return supabaseResponse;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
