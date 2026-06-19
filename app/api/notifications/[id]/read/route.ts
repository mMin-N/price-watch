import { NextResponse } from "next/server";
import { requireUserFromRequest } from "@/lib/api/auth";
import { jsonError } from "@/lib/api/errors";

type RouteContext = { params: Promise<{ id: string }> };

const NOTIFICATION_COLUMNS =
  "id, tracked_product_id, type, message, read_at, created_at";

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

async function getOwnedNotification(
  supabase: NonNullable<Awaited<ReturnType<typeof requireUserFromRequest>>["supabase"]>,
  userId: string,
  id: string
) {
  const { data, error } = await supabase
    .from("notifications")
    .select(NOTIFICATION_COLUMNS)
    .eq("id", id)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    return { notification: null, error: error.message };
  }

  return { notification: data, error: null };
}

export async function PATCH(request: Request, context: RouteContext) {
  const { supabase, user, response } = await requireUserFromRequest(request);
  if (response) return response;

  const { id } = await context.params;

  const { notification, error: fetchError } = await getOwnedNotification(
    supabase,
    user.id,
    id
  );
  if (fetchError) {
    return jsonError(500, fetchError);
  }
  if (!notification) {
    return jsonError(404, "Notification not found");
  }

  const { data, error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", user.id)
    .select(NOTIFICATION_COLUMNS)
    .single();

  if (error) {
    return jsonError(500, error.message);
  }

  return NextResponse.json(mapNotification(data));
}
