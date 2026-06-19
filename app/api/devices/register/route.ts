import { NextResponse } from "next/server";
import { requireUserFromRequest } from "@/lib/api/auth";
import { jsonError } from "@/lib/api/errors";

export async function POST(request: Request) {
  const { supabase, user, response } = await requireUserFromRequest(request);
  if (response || !supabase || !user) return response ?? jsonError(401, "Unauthorized");

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return jsonError(400, "Invalid JSON body");
  }

  const fcmToken = body.fcmToken;
  const platform = body.platform ?? "android";
  if (typeof fcmToken !== "string" || !fcmToken.trim()) {
    return jsonError(400, "fcmToken is required");
  }
  if (typeof platform !== "string") {
    return jsonError(400, "platform must be a string");
  }

  const { error } = await supabase.from("device_tokens").upsert(
    {
      user_id: user.id,
      fcm_token: fcmToken.trim(),
      platform,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,fcm_token" }
  );

  if (error) return jsonError(500, error.message);
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request) {
  const { supabase, user, response } = await requireUserFromRequest(request);
  if (response || !supabase || !user) return response ?? jsonError(401, "Unauthorized");

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return jsonError(400, "Invalid JSON body");
  }

  const fcmToken = body.fcmToken;
  if (typeof fcmToken !== "string" || !fcmToken.trim()) {
    return jsonError(400, "fcmToken is required");
  }

  const { error } = await supabase
    .from("device_tokens")
    .delete()
    .eq("user_id", user.id)
    .eq("fcm_token", fcmToken.trim());

  if (error) return jsonError(500, error.message);
  return NextResponse.json({ ok: true });
}
