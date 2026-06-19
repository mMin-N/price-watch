import { NextResponse } from "next/server";
import { requireVerifiedUserFromRequest } from "@/lib/api/auth";
import { jsonError } from "@/lib/api/errors";
import { enforceRateLimit } from "@/lib/api/rate-limit";
import { productFetchErrorResponse } from "@/lib/api/product-fetch-errors";
import { fetchNormalizedProductPrice } from "@/lib/pipeline/fetch-normalized-price";
import { detectSite, siteDisplayName } from "@/lib/providers/detect-site";
import { logPipelineEvent } from "@/lib/observability/pipeline-event";

export async function POST(request: Request) {
  const { supabase, user, response } = await requireVerifiedUserFromRequest(request);
  if (response) return response;

  const rateLimited = await enforceRateLimit(supabase, user.id, "preview");
  if (rateLimited) return rateLimited;

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return jsonError(400, "Invalid JSON body");
  }

  const url = body?.url;

  if (!url || typeof url !== "string" || !url.trim()) {
    return jsonError(400, "url is required");
  }

  const trimmedUrl = url.trim();
  const site = detectSite(trimmedUrl);

  try {
    new URL(trimmedUrl);
  } catch {
    return jsonError(400, "Invalid URL");
  }

  const fetchStart = Date.now();
  try {
    const fetchResult = await fetchNormalizedProductPrice(trimmedUrl);
    await logPipelineEvent(supabase, {
      site,
      step: "preview",
      success: true,
      durationMs: Date.now() - fetchStart,
    });
    return NextResponse.json({
      title: fetchResult.title?.trim() || "Unknown product",
      price: fetchResult.price,
      currency: fetchResult.currency,
      site,
      siteName: siteDisplayName(site),
    });
  } catch (err) {
    await logPipelineEvent(supabase, {
      site,
      step: "preview",
      success: false,
      durationMs: Date.now() - fetchStart,
      errorCode: err instanceof Error ? err.message.slice(0, 200) : "preview_failed",
    });
    return productFetchErrorResponse(err);
  }
}
