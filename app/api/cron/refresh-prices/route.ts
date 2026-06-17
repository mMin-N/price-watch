import { createAdminClient } from "@/lib/supabase/admin";
import { ZenRowsProvider } from "@/lib/providers/zenrows";
import { runPricePipeline } from "@/lib/pipeline/run-price-pipeline";

export async function POST(request: Request) {
  const auth = request.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();
  const sixHoursAgo = new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString();

  const { data: products } = await supabase
    .from("tracked_products")
    .select("id, last_fetched_at")
    .or(`last_fetched_at.is.null,last_fetched_at.lt.${sixHoursAgo}`)
    .limit(20);

  const provider = new ZenRowsProvider();
  let succeeded = 0;
  let failed = 0;

  for (const p of products ?? []) {
    try {
      await runPricePipeline(supabase, p.id, provider);
      succeeded++;
    } catch {
      failed++;
    }
  }

  return Response.json({
    processed: products?.length ?? 0,
    succeeded,
    failed,
    skipped: 0,
  });
}
