import { NextResponse } from "next/server";
import { requireUserFromRequest } from "@/lib/api/auth";
import { jsonError } from "@/lib/api/errors";

export async function POST(request: Request) {
  const { supabase, user, response } = await requireUserFromRequest(request);
  if (response) return response;

  const readAt = new Date().toISOString();

  const { data, error } = await supabase
    .from("notifications")
    .update({ read_at: readAt })
    .eq("user_id", user.id)
    .is("read_at", null)
    .select("id");

  if (error) {
    return jsonError(500, error.message);
  }

  return NextResponse.json({
    success: true,
    markedCount: data?.length ?? 0,
  });
}
