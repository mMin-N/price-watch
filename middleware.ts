import { type NextRequest, NextResponse } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

const PUBLIC_PATHS = ["/login", "/register"];

export async function middleware(request: NextRequest) {
  const { supabaseResponse, user } = await updateSession(request);
  const path = request.nextUrl.pathname;

  if (PUBLIC_PATHS.includes(path) && user) {
    return NextResponse.redirect(new URL("/", request.url));
  }
  if (!PUBLIC_PATHS.includes(path) && !path.startsWith("/api/cron") && !user) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  return supabaseResponse;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
