import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api/auth";
import { jsonError } from "@/lib/api/errors";

type RouteContext = { params: Promise<{ id: string }> };

async function getOwnedWishlist(
  supabase: Awaited<ReturnType<typeof requireUser>>["supabase"],
  userId: string,
  id: string
) {
  const { data, error } = await supabase
    .from("wishlist_items")
    .select("id, name, created_at, updated_at")
    .eq("id", id)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    return { wishlist: null, error: error.message };
  }

  return { wishlist: data, error: null };
}

export async function PATCH(request: Request, context: RouteContext) {
  const { supabase, user, response } = await requireUser();
  if (response) return response;

  const { id } = await context.params;
  const body = await request.json();
  const name = body?.name;

  if (!name || typeof name !== "string" || !name.trim()) {
    return jsonError(400, "name is required");
  }

  const { wishlist, error: fetchError } = await getOwnedWishlist(supabase, user.id, id);
  if (fetchError) {
    return jsonError(500, fetchError);
  }
  if (!wishlist) {
    return jsonError(404, "Wishlist not found");
  }

  const { data, error } = await supabase
    .from("wishlist_items")
    .update({ name: name.trim(), updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", user.id)
    .select("id, name, created_at, updated_at")
    .single();

  if (error) {
    return jsonError(500, error.message);
  }

  const { count } = await supabase
    .from("tracked_products")
    .select("*", { count: "exact", head: true })
    .eq("wishlist_item_id", id);

  return NextResponse.json({
    id: data.id,
    name: data.name,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
    productCount: count ?? 0,
  });
}

export async function DELETE(_request: Request, context: RouteContext) {
  const { supabase, user, response } = await requireUser();
  if (response) return response;

  const { id } = await context.params;

  const { wishlist, error: fetchError } = await getOwnedWishlist(supabase, user.id, id);
  if (fetchError) {
    return jsonError(500, fetchError);
  }
  if (!wishlist) {
    return jsonError(404, "Wishlist not found");
  }

  const { error: unlinkError } = await supabase
    .from("tracked_products")
    .update({ wishlist_item_id: null })
    .eq("wishlist_item_id", id)
    .eq("user_id", user.id);

  if (unlinkError) {
    return jsonError(500, unlinkError.message);
  }

  const { error: deleteError } = await supabase
    .from("wishlist_items")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (deleteError) {
    return jsonError(500, deleteError.message);
  }

  return NextResponse.json({ success: true });
}
