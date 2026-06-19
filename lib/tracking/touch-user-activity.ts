import type { SupabaseClient } from "@supabase/supabase-js";

export async function touchUserActivity(
  supabase: SupabaseClient,
  userId: string
): Promise<void> {
  const { error } = await supabase
    .from("profiles")
    .update({ last_active_at: new Date().toISOString() })
    .eq("id", userId);

  if (error) {
    console.error(
      JSON.stringify({ step: "touch_user_activity", userId, error: error.message })
    );
  }
}
