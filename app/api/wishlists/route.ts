import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api/auth";
import { jsonError } from "@/lib/api/errors";

export async function GET() {
  const { supabase, user, response } = await requireUser();
  if (response) return response;

  const { data, error } = await supabase
    .from("wishlist_items")
    .select("id, name, created_at, updated_at, tracked_products(count)")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) {
    return jsonError(500, error.message);
  }

  const wishlists = (data ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    productCount: row.tracked_products?.[0]?.count ?? 0,
  }));

  return NextResponse.json({ wishlists });
}

export async function POST(request: Request) {
  const { supabase, user, response } = await requireUser();
  if (response) return response;

  const body = await request.json();
  const name = body?.name;

  if (!name || typeof name !== "string" || !name.trim()) {
    return jsonError(400, "name is required");
  }

  const { data, error } = await supabase
    .from("wishlist_items")
    .insert({ user_id: user.id, name: name.trim() })
    .select("id, name, created_at, updated_at")
    .single();

  if (error) {
    return jsonError(500, error.message);
  }

  return NextResponse.json({
    id: data.id,
    name: data.name,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
    productCount: 0,
  });
}
