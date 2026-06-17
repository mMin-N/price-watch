import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api/auth";
import { jsonError } from "@/lib/api/errors";

type RouteContext = { params: Promise<{ id: string }> };

const PRODUCT_COLUMNS =
  "id, url, title, target_price, currency, last_price, last_fetched_at, wishlist_item_id, created_at, updated_at";

type ProductRow = {
  id: string;
  url: string;
  title: string | null;
  target_price: number | null;
  currency: string | null;
  last_price: number | null;
  last_fetched_at: string | null;
  wishlist_item_id: string | null;
  created_at: string;
  updated_at: string;
};

function mapProduct(row: ProductRow) {
  return {
    id: row.id,
    url: row.url,
    title: row.title,
    targetPrice: row.target_price,
    currency: row.currency ?? "USD",
    lastPrice: row.last_price,
    lastFetchedAt: row.last_fetched_at,
    wishlistItemId: row.wishlist_item_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function getOwnedProduct(
  supabase: Awaited<ReturnType<typeof requireUser>>["supabase"],
  userId: string,
  id: string
) {
  const { data, error } = await supabase
    .from("tracked_products")
    .select(PRODUCT_COLUMNS)
    .eq("id", id)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    return { product: null, error: error.message };
  }

  return { product: data, error: null };
}

export async function GET(_request: Request, context: RouteContext) {
  const { supabase, user, response } = await requireUser();
  if (response) return response;

  const { id } = await context.params;

  const { product, error: fetchError } = await getOwnedProduct(supabase, user.id, id);
  if (fetchError) {
    return jsonError(500, fetchError);
  }
  if (!product) {
    return jsonError(404, "Product not found");
  }

  const { data: history, error: historyError } = await supabase
    .from("price_history")
    .select("id, price, currency, provider, created_at")
    .eq("tracked_product_id", id)
    .order("created_at", { ascending: false });

  if (historyError) {
    return jsonError(500, historyError.message);
  }

  return NextResponse.json({
    ...mapProduct(product),
    priceHistory: (history ?? []).map((row) => ({
      id: row.id,
      price: row.price,
      currency: row.currency,
      provider: row.provider,
      createdAt: row.created_at,
    })),
  });
}

export async function PATCH(request: Request, context: RouteContext) {
  const { supabase, user, response } = await requireUser();
  if (response) return response;

  const { id } = await context.params;
  const body = await request.json();

  const { product, error: fetchError } = await getOwnedProduct(supabase, user.id, id);
  if (fetchError) {
    return jsonError(500, fetchError);
  }
  if (!product) {
    return jsonError(404, "Product not found");
  }

  const updates: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if ("targetPrice" in body) {
    const targetPrice = body.targetPrice;
    if (targetPrice !== null && typeof targetPrice !== "number") {
      return jsonError(400, "targetPrice must be a number or null");
    }
    updates.target_price = targetPrice;
  }

  if ("wishlistItemId" in body) {
    const wishlistItemId = body.wishlistItemId;
    if (wishlistItemId !== null && typeof wishlistItemId !== "string") {
      return jsonError(400, "wishlistItemId must be a string or null");
    }
    updates.wishlist_item_id = wishlistItemId;
  }

  const { data, error } = await supabase
    .from("tracked_products")
    .update(updates)
    .eq("id", id)
    .eq("user_id", user.id)
    .select(PRODUCT_COLUMNS)
    .single();

  if (error) {
    return jsonError(500, error.message);
  }

  return NextResponse.json(mapProduct(data));
}

export async function DELETE(_request: Request, context: RouteContext) {
  const { supabase, user, response } = await requireUser();
  if (response) return response;

  const { id } = await context.params;

  const { product, error: fetchError } = await getOwnedProduct(supabase, user.id, id);
  if (fetchError) {
    return jsonError(500, fetchError);
  }
  if (!product) {
    return jsonError(404, "Product not found");
  }

  const { error: deleteError } = await supabase
    .from("tracked_products")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (deleteError) {
    return jsonError(500, deleteError.message);
  }

  return NextResponse.json({ success: true });
}
