import { NextResponse } from "next/server";
import { requireUserFromRequest } from "@/lib/api/auth";
import { jsonError } from "@/lib/api/errors";
import { mapProduct, PRODUCT_COLUMNS } from "@/lib/api/product-map";
import {
  parseDiscountAlertPercent,
  parseOptionalPrice,
  validateOwnedWishlistItem,
} from "@/lib/api/validate-product-input";
import { deleteOwnedRow } from "@/lib/supabase/delete-owned-row";
import { touchUserActivity } from "@/lib/tracking/touch-user-activity";

type RouteContext = { params: Promise<{ id: string }> };

async function getOwnedProduct(
  supabase: NonNullable<Awaited<ReturnType<typeof requireUserFromRequest>>["supabase"]>,
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

export async function GET(request: Request, context: RouteContext) {
  const { supabase, user, response } = await requireUserFromRequest(request);
  if (response) return response;

  const { id } = await context.params;
  const { searchParams } = new URL(request.url);
  const limit = Math.min(Math.max(parseInt(searchParams.get("limit") ?? "90", 10) || 90, 1), 200);
  const offset = Math.max(parseInt(searchParams.get("offset") ?? "0", 10) || 0, 0);

  const { product, error: fetchError } = await getOwnedProduct(supabase, user.id, id);
  if (fetchError) {
    return jsonError(500, fetchError);
  }
  if (!product) {
    return jsonError(404, "Product not found");
  }

  await touchUserActivity(supabase, user.id);

  const { count, error: countError } = await supabase
    .from("price_history")
    .select("id", { count: "exact", head: true })
    .eq("tracked_product_id", id);

  if (countError) {
    return jsonError(500, countError.message);
  }

  const { data: history, error: historyError } = await supabase
    .from("price_history")
    .select("id, price, currency, provider, created_at")
    .eq("tracked_product_id", id)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

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
    priceHistoryTotal: count ?? 0,
    priceHistoryLimit: limit,
    priceHistoryOffset: offset,
  });
}

export async function PATCH(request: Request, context: RouteContext) {
  const { supabase, user, response } = await requireUserFromRequest(request);
  if (response) return response;

  const { id } = await context.params;

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return jsonError(400, "Invalid JSON body");
  }

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
    const targetPrice = parseOptionalPrice(body.targetPrice);
    if (targetPrice === "invalid") {
      return jsonError(400, "targetPrice must be a non-negative finite number or null");
    }
    updates.target_price = targetPrice;
  }

  if ("discountAlertPercent" in body) {
    const raw = body.discountAlertPercent;
    if (raw === null || raw === "") {
      updates.discount_alert_percent = null;
    } else {
      const parsed = parseDiscountAlertPercent(raw);
      if (parsed === "invalid") {
        return jsonError(400, "discountAlertPercent must be between 1 and 100");
      }
      updates.discount_alert_percent = parsed;
    }
  }

  if ("wishlistItemId" in body) {
    const wishlistItemId = body.wishlistItemId;
    if (wishlistItemId !== null && typeof wishlistItemId !== "string") {
      return jsonError(400, "wishlistItemId must be a string or null");
    }
    try {
      const wishlistError = await validateOwnedWishlistItem(
        supabase,
        user.id,
        wishlistItemId as string | null
      );
      if (wishlistError) {
        return jsonError(400, wishlistError);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to validate wishlist";
      return jsonError(500, message);
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

  await touchUserActivity(supabase, user.id);

  return NextResponse.json(mapProduct(data));
}

export async function DELETE(request: Request, context: RouteContext) {
  const { supabase, user, response } = await requireUserFromRequest(request);
  if (response) return response;

  const { id } = await context.params;

  const { product, error: fetchError } = await getOwnedProduct(supabase, user.id, id);
  if (fetchError) {
    return jsonError(500, fetchError);
  }
  if (!product) {
    return jsonError(404, "Product not found");
  }

  const { deleted, error: deleteError } = await deleteOwnedRow(
    "tracked_products",
    id,
    user.id
  );

  if (deleteError) {
    return jsonError(500, deleteError);
  }

  if (!deleted) {
    return jsonError(500, "Failed to delete product");
  }

  await touchUserActivity(supabase, user.id);

  return NextResponse.json({ success: true });
}
