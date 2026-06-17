import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api/auth";
import { jsonError } from "@/lib/api/errors";

type NotificationRow = {
  id: string;
  tracked_product_id: string | null;
  type: string;
  message: string;
  read_at: string | null;
  created_at: string;
};

function mapNotification(row: NotificationRow) {
  return {
    id: row.id,
    trackedProductId: row.tracked_product_id,
    type: row.type,
    message: row.message,
    readAt: row.read_at,
    createdAt: row.created_at,
  };
}

export async function GET(request: Request) {
  const { supabase, user, response } = await requireUser();
  if (response) return response;

  const { searchParams } = new URL(request.url);
  const unreadOnly = searchParams.get("unreadOnly") === "true";

  let query = supabase
    .from("notifications")
    .select("id, tracked_product_id, type, message, read_at, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (unreadOnly) {
    query = query.is("read_at", null);
  }

  const { data, error } = await query;

  if (error) {
    return jsonError(500, error.message);
  }

  return NextResponse.json({
    notifications: (data ?? []).map(mapNotification),
  });
}
