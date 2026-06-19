import type { SupabaseClient } from "@supabase/supabase-js";
import type { PriceProvider } from "@/lib/providers/price-provider";
import { resolveProviderId } from "@/lib/providers/get-price-provider";
import { detectSite } from "@/lib/providers/detect-site";
import { normalizeFetchResultToUsd } from "@/lib/providers/normalize-price";
import { logPipelineEvent } from "@/lib/observability/pipeline-event";
import { persistPriceSnapshot } from "./persist-price-snapshot";

export async function runPricePipeline(
  supabase: SupabaseClient,
  trackedProductId: string,
  provider: PriceProvider
) {
  const correlationId = `${trackedProductId}-${Date.now()}`;

  const { data: product, error: loadError } = await supabase
    .from("tracked_products")
    .select("id, url")
    .eq("id", trackedProductId)
    .single();

  if (loadError || !product) throw new Error("Tracked product not found");

  const site = detectSite(product.url);
  console.log(JSON.stringify({ step: "input", correlationId, url: product.url, site }));

  const fetchStart = Date.now();
  let rawResult;
  try {
    rawResult = await provider.fetchPrice(product.url);
    await logPipelineEvent(supabase, {
      trackedProductId,
      site,
      step: "fetch",
      success: true,
      durationMs: Date.now() - fetchStart,
    });
  } catch (err) {
    await logPipelineEvent(supabase, {
      trackedProductId,
      site,
      step: "fetch",
      success: false,
      durationMs: Date.now() - fetchStart,
      errorCode: err instanceof Error ? err.message.slice(0, 200) : "fetch_failed",
    });
    throw err;
  }

  console.log(JSON.stringify({
    step: "provider_response",
    correlationId,
    price: rawResult.price,
    currency: rawResult.currency,
  }));

  const fetchResult = await normalizeFetchResultToUsd(rawResult);
  if (fetchResult.originalCurrency) {
    console.log(JSON.stringify({
      step: "normalize",
      correlationId,
      originalPrice: fetchResult.originalPrice,
      originalCurrency: fetchResult.originalCurrency,
      convertedPrice: fetchResult.price,
      currency: fetchResult.currency,
    }));
  }

  return persistPriceSnapshot(
    supabase,
    trackedProductId,
    fetchResult,
    correlationId,
    resolveProviderId(product.url)
  );
}
