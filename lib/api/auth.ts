import { createClient as createSupabaseJsClient } from "@supabase/supabase-js";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { jsonError } from "./errors";

export function isEmailVerified(user: User): boolean {
  const providers = user.app_metadata?.providers as string[] | undefined;
  if (providers?.includes("google")) return true;
  if (user.app_metadata?.provider === "google") return true;
  return Boolean(user.email_confirmed_at);
}

export function bearerTokenFromRequest(request: Request): string | null {
  const header = request.headers.get("authorization");
  if (!header?.startsWith("Bearer ")) return null;
  const token = header.slice("Bearer ".length).trim();
  return token || null;
}

export function createSupabaseClientForBearer(token: string) {
  return createSupabaseJsClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      global: {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    }
  );
}

export async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) {
    return { supabase, user: null, response: jsonError(401, "Unauthorized") };
  }
  return { supabase, user, response: null };
}

export async function requireUserFromRequest(request?: Request) {
  const bearer = request ? bearerTokenFromRequest(request) : null;
  if (bearer) {
    const supabase = createSupabaseClientForBearer(bearer);
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();
    if (error || !user) {
      return { supabase: null, user: null, response: jsonError(401, "Unauthorized") };
    }
    return { supabase, user, response: null };
  }
  return requireUser();
}

export async function requireVerifiedUser() {
  const result = await requireUser();
  if (result.response) return result;
  if (!isEmailVerified(result.user)) {
    return {
      ...result,
      response: jsonError(
        403,
        "Please verify your email before using price tracking features"
      ),
    };
  }
  return result;
}

export async function requireVerifiedUserFromRequest(request?: Request) {
  const result = await requireUserFromRequest(request);
  if (result.response) return result;
  if (!isEmailVerified(result.user!)) {
    return {
      ...result,
      response: jsonError(
        403,
        "Please verify your email before using price tracking features"
      ),
    };
  }
  return result;
}
