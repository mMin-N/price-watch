import { verifyCronAuth } from "@/lib/api/cron-auth";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  const authError = verifyCronAuth(request);
  if (authError) return authError;

  const supabase = createAdminClient();
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const statDate = new Date().toISOString().slice(0, 10);

  const { count: newProducts } = await supabase
    .from("tracked_products")
    .select("id", { count: "exact", head: true })
    .gte("created_at", oneDayAgo);

  const { count: alertsSent } = await supabase
    .from("alert_logs")
    .select("id", { count: "exact", head: true })
    .gte("created_at", oneDayAgo);

  const { data: failures } = await supabase
    .from("pipeline_events")
    .select("site")
    .eq("success", false)
    .gte("created_at", oneDayAgo);

  const failuresBySite: Record<string, number> = {};
  for (const row of failures ?? []) {
    failuresBySite[row.site] = (failuresBySite[row.site] ?? 0) + 1;
  }

  await supabase.from("daily_stats").upsert({
    stat_date: statDate,
    new_users: 0,
    new_products: newProducts ?? 0,
    alerts_sent: alertsSent ?? 0,
    fetch_failures_by_site: failuresBySite,
  });

  const { data: cleanupCount } = await supabase.rpc("cleanup_api_usage_windows", {
    p_days: 7,
  });

  return Response.json({
    statDate,
    newProducts: newProducts ?? 0,
    alertsSent: alertsSent ?? 0,
    failuresBySite,
    usageWindowsDeleted: cleanupCount ?? 0,
  });
}
