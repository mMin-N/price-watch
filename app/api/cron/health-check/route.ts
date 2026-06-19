import { verifyCronAuth } from "@/lib/api/cron-auth";
import { sendOperatorAlert } from "@/lib/observability/operator-alert";
import { createAdminClient } from "@/lib/supabase/admin";

type SiteRow = { site: string; total: number; failures: number };

export async function POST(request: Request) {
  const authError = verifyCronAuth(request);
  if (authError) return authError;

  const supabase = createAdminClient();
  const alerts: string[] = [];

  const sevenHoursAgo = new Date(Date.now() - 7 * 60 * 60 * 1000).toISOString();
  const { data: recentCron } = await supabase
    .from("cron_runs")
    .select("created_at, succeeded, failed")
    .eq("job_name", "refresh-prices")
    .gte("created_at", sevenHoursAgo)
    .order("created_at", { ascending: false })
    .limit(1);

  if (!recentCron?.length) {
    alerts.push("No refresh-prices cron run in the last 7 hours.");
  }

  const sixHoursAgo = new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString();
  const { data: fetchEvents } = await supabase
    .from("pipeline_events")
    .select("success")
    .eq("step", "fetch")
    .gte("created_at", sixHoursAgo);

  if (fetchEvents && fetchEvents.length > 0) {
    const failures = fetchEvents.filter((e) => !e.success).length;
    const failureRate = failures / fetchEvents.length;
    if (failureRate > 0.2) {
      alerts.push(
        `Fetch failure rate ${(failureRate * 100).toFixed(1)}% in last 6h (${failures}/${fetchEvents.length}).`
      );
    }
  }

  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { data: previewEvents } = await supabase
    .from("pipeline_events")
    .select("success")
    .eq("step", "preview")
    .gte("created_at", oneHourAgo);

  if (previewEvents && previewEvents.length >= 5) {
    const failures = previewEvents.filter((e) => !e.success).length;
    const failureRate = failures / previewEvents.length;
    if (failureRate > 0.5) {
      alerts.push(
        `Preview failure rate ${(failureRate * 100).toFixed(1)}% in last 1h (${failures}/${previewEvents.length}).`
      );
    }
  }

  const { data: siteRows } = await supabase
    .from("pipeline_events")
    .select("site, success")
    .eq("step", "fetch")
    .gte("created_at", sixHoursAgo);

  if (siteRows && siteRows.length > 0) {
    const bySite = new Map<string, SiteRow>();
    for (const row of siteRows) {
      const current = bySite.get(row.site) ?? { site: row.site, total: 0, failures: 0 };
      current.total += 1;
      if (!row.success) current.failures += 1;
      bySite.set(row.site, current);
    }
    for (const stats of bySite.values()) {
      if (stats.total >= 3 && stats.failures / stats.total > 0.7) {
        alerts.push(
          `Site ${stats.site} fetch failure rate ${((stats.failures / stats.total) * 100).toFixed(1)}% in last 6h.`
        );
      }
    }
  }

  if (alerts.length > 0) {
    await sendOperatorAlert("Health check alert", alerts.join("\n"));
  }

  return Response.json({ ok: alerts.length === 0, alerts });
}
