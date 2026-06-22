import { NextResponse } from "next/server";
import { requireUserFromRequest, requireVerifiedUserFromRequest } from "@/lib/api/auth";
import { jsonError } from "@/lib/api/errors";
import { enforceRateLimit } from "@/lib/api/rate-limit";
import { productFetchErrorResponse } from "@/lib/api/product-fetch-errors";
import { mapProduct, PRODUCT_COLUMNS } from "@/lib/api/product-map";
import {
  parseDiscountAlertPercent,
  validateOwnedWishlistItem,
} from "@/lib/api/validate-product-input";
import { APP_CURRENCY } from "@/lib/providers/normalize-price";
import { fetchNormalizedProductPrice } from "@/lib/pipeline/fetch-normalized-price";
import { persistPriceSnapshot } from "@/lib/pipeline/persist-price-snapshot";
import {
  canonicalUrlForStorage,
  findTrackedProductByUrl,
} from "@/lib/url/find-tracked-product";
import { rollbackInsertedProduct } from "@/lib/supabase/delete-owned-row";
import { MAX_TRACKED_PRODUCTS_PER_USER } from "@/lib/tracking/tracking-policy";
import { touchUserActivity } from "@/lib/tracking/touch-user-activity";
import { ensureDefaultWishlist } from "@/lib/wishlists/ensure-default-wishlist";

export async function GET(request: Request) {
  const { supabase, user, response } = await requireUserFromRequest(request);
  if (response) return response;

  await touchUserActivity(supabase, user.id);

  const { data, error } = await supabase
    .from("tracked_products")
    .select(PRODUCT_COLUMNS)
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) {
    return jsonError(500, error.message);
  }

  return NextResponse.json({ products: (data ?? []).map(mapProduct) });
}

export async function POST(request: Request) {
  const { supabase, user, response } = await requireVerifiedUserFromRequest(request);
  if (response) return response;

  const rateLimited = await enforceRateLimit(supabase, user.id, "add_product");
  if (rateLimited) return rateLimited;

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return jsonError(400, "Invalid JSON body");
  }

  const url = body?.url;
  const discountAlertPercent = parseDiscountAlertPercent(body?.discountAlertPercent);
  const wishlistItemId = body?.wishlistItemId;

  if (!url || typeof url !== "string" || !url.trim()) {
    return jsonError(400, "url is required");
  }

  const trimmedUrl = url.trim();
  const storedUrl = canonicalUrlForStorage(trimmedUrl);

  try {
    new URL(trimmedUrl);
  } catch {
    return jsonError(400, "Invalid URL");
  }

  if (discountAlertPercent === "invalid") {
    return jsonError(400, "discountAlertPercent must be between 1 and 100");
  }

  if (
    wishlistItemId !== undefined &&
    wishlistItemId !== null &&
    typeof wishlistItemId !== "string"
  ) {
    return jsonError(400, "wishlistItemId must be a string");
  }

  const trimmedWishlistId =
    typeof wishlistItemId === "string" ? wishlistItemId.trim() : "";

  let resolvedWishlistId: string;
  if (trimmedWishlistId) {
    let wishlistError: string | null;
    try {
      wishlistError = await validateOwnedWishlistItem(
        supabase,
        user.id,
        trimmedWishlistId
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to validate wishlist";
      return jsonError(500, message);
    }
    if (wishlistError) {
      return jsonError(400, wishlistError);
    }
    resolvedWishlistId = trimmedWishlistId;
  } else {
    try {
      resolvedWishlistId = (await ensureDefaultWishlist(supabase, user.id)).id;
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to resolve default wishlist";
      return jsonError(500, message);
    }
  }

  let duplicate;
  try {
    duplicate = await findTrackedProductByUrl(supabase, user.id, trimmedUrl);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to check duplicates";
    return jsonError(500, message);
  }

  if (duplicate) {
    return jsonError(409, "Already tracking this URL", { existingId: duplicate.id });
  }

  const { count: productCount, error: countError } = await supabase
    .from("tracked_products")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id);

  if (countError) {
    return jsonError(500, countError.message);
  }
  if ((productCount ?? 0) >= MAX_TRACKED_PRODUCTS_PER_USER) {
    return jsonError(
      403,
      `You can track up to ${MAX_TRACKED_PRODUCTS_PER_USER} products. Remove one to add another.`
    );
  }

  let fetchResult;
  try {
    fetchResult = await fetchNormalizedProductPrice(trimmedUrl);
  } catch (err) {
    return productFetchErrorResponse(err);
  }

  const { data: inserted, error: insertError } = await supabase
    .from("tracked_products")
    .insert({
      user_id: user.id,
      url: storedUrl,
      title: fetchResult.title?.trim() || null,
      image_url: fetchResult.imageUrl?.trim() || null,
      target_price: null,
      discount_alert_percent: discountAlertPercent,
      baseline_price: fetchResult.price,
      wishlist_item_id: resolvedWishlistId,
      currency: APP_CURRENCY,
    })
    .select(PRODUCT_COLUMNS)
    .single();

  if (insertError) {
    if (insertError.code === "23505") {
      return jsonError(409, "Already tracking this URL");
    }
    return jsonError(500, insertError.message);
  }

  const correlationId = `${inserted.id}-${Date.now()}`;
  let pipelineResult;

  try {
    pipelineResult = await persistPriceSnapshot(
      supabase,
      inserted.id,
      fetchResult,
      correlationId
    );
  } catch (err) {
    await rollbackInsertedProduct(supabase, inserted.id, user.id);
    return productFetchErrorResponse(err);
  }

  const { data: product, error: fetchError } = await supabase
    .from("tracked_products")
    .select(PRODUCT_COLUMNS)
    .eq("id", inserted.id)
    .single();

  if (fetchError || !product) {
    return jsonError(500, fetchError?.message ?? "Failed to load product");
  }

  await touchUserActivity(supabase, user.id);

  return NextResponse.json({
    ...mapProduct(product),
    pipeline: pipelineResult,
  });
}
