import { NextResponse } from "next/server";
import { requireVerifiedUserFromRequest } from "@/lib/api/auth";
import { jsonError } from "@/lib/api/errors";

export async function GET(request: Request) {
  const { supabase, user, response } = await requireVerifiedUserFromRequest(request);
  if (response || !supabase || !user) {
    return response ?? jsonError(401, "Unauthorized");
  }

  const {
    data: { session },
    error,
  } = await supabase.auth.getSession();

  if (error || !session?.access_token) {
    return jsonError(401, "No active session");
  }

  return NextResponse.json({
    accessToken: session.access_token,
    expiresAt: session.expires_at ?? null,
  });
}
