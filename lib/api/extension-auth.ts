import type { SupabaseClient } from "@supabase/supabase-js";
import type { User } from "@supabase/supabase-js";
import {
  bearerTokenFromRequest,
  createSupabaseClientForBearer,
  isEmailVerified,
} from "@/lib/api/auth";
import { jsonError } from "@/lib/api/errors";

export type ExtensionAuthResult = {
  supabase: SupabaseClient | null;
  user: User | null;
  response: ReturnType<typeof jsonError> | null;
};

export async function requireExtensionUser(request: Request): Promise<ExtensionAuthResult> {
  const token = bearerTokenFromRequest(request);
  if (!token) {
    return {
      supabase: null,
      user: null,
      response: jsonError(401, "Missing Bearer token"),
    };
  }

  const supabase = createSupabaseClientForBearer(token);

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return {
      supabase: null,
      user: null,
      response: jsonError(401, "Invalid or expired token"),
    };
  }

  if (!isEmailVerified(user)) {
    return {
      supabase: null,
      user: null,
      response: jsonError(
        403,
        "Please verify your email before using price tracking features"
      ),
    };
  }

  return { supabase, user, response: null };
}
