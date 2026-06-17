import { createClient } from "@/lib/supabase/server";
import { jsonError } from "./errors";

export async function requireUser() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return { supabase, user: null, response: jsonError(401, "Unauthorized") };
  return { supabase, user, response: null };
}
