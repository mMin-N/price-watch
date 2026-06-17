import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api/auth";
import { jsonError } from "@/lib/api/errors";
import { runPricePipeline } from "@/lib/pipeline/run-price-pipeline";
import { ZenRowsProvider } from "@/lib/providers/zenrows";

type RouteContext = { params: Promise<{ id: string }> };

const COOLDOWN_MS = 15 * 60 * 1000;

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

export async function POST(_request: Request, context: RouteContext) {
  const { supabase, user, response } = await requireUser();
  if (response) return response;

  const { id } = await context.params;

  const { data: product, error: fetchError } = await supabase
    .from("tracked_products")
    .select(PRODUCT_COLUMNS)
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (fetchError) {
    return jsonError(500, fetchError.message);
  }
  if (!product) {
    return jsonError(404, "Product not found");
  }

  if (product.last_fetched_at) {
    const elapsed = Date.now() - new Date(product.last_fetched_at).getTime();
    if (elapsed < COOLDOWN_MS) {
      const retryAfterSeconds = Math.ceil((COOLDOWN_MS - elapsed) / 1000);
      return jsonError(429, "Refresh cooldown active", { retryAfterSeconds });
    }
  }

  let pipelineResult;
  try {
    pipelineResult = await runPricePipeline(supabase, id, new ZenRowsProvider());
  } catch (err) {
    return pipelineErrorResponse(err);
  }

  const { data: updated, error: reloadError } = await supabase
    .from("tracked_products")
    .select(PRODUCT_COLUMNS)
    .eq("id", id)
    .single();

  if (reloadError || !updated) {
    return jsonError(500, reloadError?.message ?? "Failed to load product");
  }

  return NextResponse.json({
    ...mapProduct(updated),
    pipeline: pipelineResult,
  });
}
