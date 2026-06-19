import { NextResponse } from "next/server";
import { requireExtensionUser } from "@/lib/api/extension-auth";
import { jsonError } from "@/lib/api/errors";
import { enforceRateLimit } from "@/lib/api/rate-limit";
import { productFetchErrorResponse } from "@/lib/api/product-fetch-errors";
import { ingestExtensionPrice } from "@/lib/extension/ingest-extension-price";
import { detectSite } from "@/lib/providers/detect-site";

function isValidPayload(body: Record<string, unknown>) {
  return (
    typeof body.url === "string" &&
    body.url.trim() &&
    typeof body.title === "string" &&
    typeof body.price === "string" &&
    body.price.trim() &&
    typeof body.timestamp === "number" &&
    Number.isFinite(body.timestamp)
  );
}

export async function POST(request: Request) {
  const { supabase, user, response } = await requireExtensionUser(request);
  if (response || !supabase || !user) {
    return response ?? jsonError(401, "Unauthorized");
  }

  const rateLimited = await enforceRateLimit(supabase, user.id, "refresh");
  if (rateLimited) {
    return rateLimited;
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return jsonError(400, "Invalid JSON body");
  }

  if (!isValidPayload(body)) {
    return jsonError(400, "url, title, price, and timestamp are required");
  }

  const url = (body.url as string).trim();
  const title = body.title as string;
  const price = body.price as string;
  const timestamp = body.timestamp as number;
  try {
    new URL(url);
  } catch {
    return jsonError(400, "Invalid URL");
  }

  if (detectSite(url) !== "amazon") {
    return jsonError(400, "Only Amazon product URLs are supported by the extension");
  }

  const asin = body.asin;
  if (asin !== undefined && asin !== null && typeof asin !== "string") {
    return jsonError(400, "asin must be a string");
  }

  try {
    const result = await ingestExtensionPrice(supabase, user.id, {
      url,
      title,
      price,
      asin: typeof asin === "string" ? asin : undefined,
      timestamp,
    });

    return NextResponse.json({
      ok: true,
      created: result.created,
      product: result.product,
      pipeline: result.pipeline,
    });
  } catch (err) {
    return productFetchErrorResponse(err);
  }
}
