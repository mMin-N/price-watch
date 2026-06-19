import type { SupabaseClient } from "@supabase/supabase-js";
import { jsonError } from "@/lib/api/errors";
import { NextResponse } from "next/server";

export type RateLimitEndpoint = "preview" | "add_product" | "refresh";

const LIMITS: Record<RateLimitEndpoint, { windowMinutes: number; limit: number }> = {
  preview: { windowMinutes: 60, limit: 30 },
  add_product: { windowMinutes: 1440, limit: 20 },
  refresh: { windowMinutes: 1440, limit: 40 },
};

type RateLimitResult = {
  allowed: boolean;
  retry_after_seconds: number;
  current_count: number;
};

export async function checkRateLimit(
  supabase: SupabaseClient,
  userId: string,
  endpoint: RateLimitEndpoint
): Promise<RateLimitResult> {
  const config = LIMITS[endpoint];
  const { data, error } = await supabase.rpc("check_and_increment_usage", {
    p_user_id: userId,
    p_endpoint: endpoint,
    p_window_minutes: config.windowMinutes,
    p_limit: config.limit,
  });

  if (error) {
    throw new Error(`Rate limit check failed: ${error.message}`);
  }

  const result = data as RateLimitResult;
  return {
    allowed: result.allowed,
    retry_after_seconds: result.retry_after_seconds ?? 0,
    current_count: result.current_count ?? 0,
  };
}

export function rateLimitResponse(retryAfterSeconds: number) {
  const response = jsonError(429, "Rate limit exceeded", { retryAfterSeconds });
  response.headers.set("Retry-After", String(retryAfterSeconds));
  return response;
}

export async function enforceRateLimit(
  supabase: SupabaseClient,
  userId: string,
  endpoint: RateLimitEndpoint
): Promise<NextResponse | null> {
  const result = await checkRateLimit(supabase, userId, endpoint);
  if (!result.allowed) {
    return rateLimitResponse(result.retry_after_seconds);
  }
  return null;
}
