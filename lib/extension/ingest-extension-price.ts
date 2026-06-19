import type { SupabaseClient } from "@supabase/supabase-js";
import { mapProduct, PRODUCT_COLUMNS } from "@/lib/api/product-map";
import { APP_CURRENCY, normalizeFetchResultToUsd } from "@/lib/providers/normalize-price";
import {
  canonicalUrlForStorage,
  findTrackedProductByUrl,
} from "@/lib/url/find-tracked-product";
import { persistPriceSnapshot } from "@/lib/pipeline/persist-price-snapshot";
import { logPipelineEvent } from "@/lib/observability/pipeline-event";
import { detectSite } from "@/lib/providers/detect-site";
import { parseDomPrice } from "./parse-dom-price";
import { MAX_TRACKED_PRODUCTS_PER_USER } from "@/lib/tracking/tracking-policy";

export type ExtensionPricePayload = {
  url: string;
  title: string;
  price: string;
  asin?: string;
  timestamp: number;
};

export async function ingestExtensionPrice(
  supabase: SupabaseClient,
  userId: string,
  payload: ExtensionPricePayload
) {
  const trimmedUrl = payload.url.trim();
  const storedUrl = canonicalUrlForStorage(trimmedUrl);
  const site = detectSite(trimmedUrl);
  const parsed = parseDomPrice(payload.price, trimmedUrl);
  const correlationId = `extension-${userId}-${Date.now()}`;

  console.log(
    JSON.stringify({
      step: "input",
      correlationId,
      url: trimmedUrl,
      site,
      source: "extension",
      asin: payload.asin ?? null,
      clientTimestamp: payload.timestamp,
    })
  );

  const rawResult = {
    price: parsed.price,
    currency: parsed.currency,
    title: payload.title?.trim() || undefined,
    isAvailable: true,
  };

  console.log(
    JSON.stringify({
      step: "provider_response",
      correlationId,
      price: rawResult.price,
      currency: rawResult.currency,
      provider: "extension",
    })
  );

  const fetchResult = await normalizeFetchResultToUsd(rawResult);
  if (fetchResult.originalCurrency) {
    console.log(
      JSON.stringify({
        step: "normalize",
        correlationId,
        originalPrice: fetchResult.originalPrice,
        originalCurrency: fetchResult.originalCurrency,
        convertedPrice: fetchResult.price,
        currency: fetchResult.currency,
      })
    );
  }

  let trackedProductId: string;
  let created = false;
  const existing = await findTrackedProductByUrl(supabase, userId, trimmedUrl);

  if (existing) {
    trackedProductId = existing.id;
  } else {
    const { count: productCount, error: countError } = await supabase
      .from("tracked_products")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId);

    if (countError) {
      throw new Error(countError.message);
    }
    if ((productCount ?? 0) >= MAX_TRACKED_PRODUCTS_PER_USER) {
      throw new Error(
        `You can track up to ${MAX_TRACKED_PRODUCTS_PER_USER} products. Remove one to add another.`
      );
    }

    const { data: inserted, error: insertError } = await supabase
      .from("tracked_products")
      .insert({
        user_id: userId,
        url: storedUrl,
        title: fetchResult.title?.trim() || null,
        baseline_price: fetchResult.price,
        currency: APP_CURRENCY,
      })
      .select(PRODUCT_COLUMNS)
      .single();

    if (insertError || !inserted) {
      if (insertError?.code === "23505") {
        const duplicate = await findTrackedProductByUrl(supabase, userId, trimmedUrl);
        if (!duplicate) {
          throw new Error(insertError.message);
        }
        trackedProductId = duplicate.id;
      } else {
        throw new Error(insertError?.message ?? "Failed to create tracked product");
      }
    } else {
      trackedProductId = inserted.id;
      created = true;
    }
  }

  const productCorrelationId = `${trackedProductId}-${Date.now()}`;

  try {
    const pipelineResult = await persistPriceSnapshot(
      supabase,
      trackedProductId,
      fetchResult,
      productCorrelationId,
      "extension"
    );

    await logPipelineEvent(supabase, {
      trackedProductId,
      site,
      step: "fetch",
      success: true,
      durationMs: 0,
    });

    const { data: product, error: loadError } = await supabase
      .from("tracked_products")
      .select(PRODUCT_COLUMNS)
      .eq("id", trackedProductId)
      .eq("user_id", userId)
      .single();

    if (loadError || !product) {
      throw new Error(loadError?.message ?? "Failed to load product");
    }

    return {
      product: mapProduct(product),
      pipeline: pipelineResult,
      created,
    };
  } catch (err) {
    await logPipelineEvent(supabase, {
      trackedProductId,
      site,
      step: "fetch",
      success: false,
      durationMs: 0,
      errorCode: err instanceof Error ? err.message.slice(0, 200) : "extension_ingest_failed",
    });
    throw err;
  }
}
