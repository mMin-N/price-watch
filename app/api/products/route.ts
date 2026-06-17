import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api/auth";
import { jsonError } from "@/lib/api/errors";
import { runPricePipeline } from "@/lib/pipeline/run-price-pipeline";
import { ZenRowsProvider } from "@/lib/providers/zenrows";

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

function pipelineErrorResponse(err: unknown) {
  const message = err instanceof Error ? err.message : "Pipeline failed";
  if (message.includes("ZenRows")) {
    return jsonError(502, "Cannot fetch price temporarily");
  }
  if (message.includes("Cannot parse price")) {
    return jsonError(422, "Cannot parse price from page");
  }
  return jsonError(500, message);
}

export async function GET() {
  const { supabase, user, response } = await requireUser();
  if (response) return response;

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
  const { supabase, user, response } = await requireUser();
  if (response) return response;

  const body = await request.json();
  const url = body?.url;
  const targetPrice = body?.targetPrice;
  const wishlistItemId = body?.wishlistItemId;

  if (!url || typeof url !== "string" || !url.trim()) {
    return jsonError(400, "url is required");
  }

  const trimmedUrl = url.trim();

  try {
    new URL(trimmedUrl);
  } catch {
    return jsonError(400, "Invalid URL");
  }

  if (targetPrice !== undefined && targetPrice !== null && typeof targetPrice !== "number") {
    return jsonError(400, "targetPrice must be a number");
  }

  if (
    wishlistItemId !== undefined &&
    wishlistItemId !== null &&
    typeof wishlistItemId !== "string"
  ) {
    return jsonError(400, "wishlistItemId must be a string");
  }

  const { data: duplicate } = await supabase
    .from("tracked_products")
    .select("id")
    .eq("user_id", user.id)
    .eq("url", trimmedUrl)
    .maybeSingle();

  if (duplicate) {
    return jsonError(409, "Already tracking this URL");
  }

  const { data: inserted, error: insertError } = await supabase
    .from("tracked_products")
    .insert({
      user_id: user.id,
      url: trimmedUrl,
      target_price: targetPrice ?? null,
      wishlist_item_id: wishlistItemId ?? null,
    })
    .select(PRODUCT_COLUMNS)
    .single();

  if (insertError) {
    if (insertError.code === "23505") {
      return jsonError(409, "Already tracking this URL");
    }
    return jsonError(500, insertError.message);
  }

  let pipelineResult;
  try {
    pipelineResult = await runPricePipeline(supabase, inserted.id, new ZenRowsProvider());
  } catch (err) {
    return pipelineErrorResponse(err);
  }

  const { data: product, error: fetchError } = await supabase
    .from("tracked_products")
    .select(PRODUCT_COLUMNS)
    .eq("id", inserted.id)
    .single();

  if (fetchError || !product) {
    return jsonError(500, fetchError?.message ?? "Failed to load product");
  }

  return NextResponse.json({
    ...mapProduct(product),
    pipeline: pipelineResult,
  });
}
