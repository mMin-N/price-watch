/**
 * Probe success rate and cost across Amazon + Indian sites.
 * Uses production routing (ZenRows for Amazon, Decodo for Flipkart/Meesho/eBay).
 *
 * Usage:
 *   npx tsx scripts/measure-all-cost-probe.ts
 *   npx tsx scripts/measure-all-cost-probe.ts --runs 10 --sites flipkart,meesho
 */

import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createPriceProvider } from "../lib/providers/get-price-provider";
import type { PriceProvider } from "../lib/providers/price-provider";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const DEFAULT_URLS = {
  amazon: "https://www.amazon.com/dp/B0FB15XXWX",
  flipkart:
    "https://www.flipkart.com/samsung-galaxy-s26-5g-cobalt-violet-256-gb/p/itm0ca5d0430e1c1",
  meesho: "https://www.meesho.com/short-kurti/p/8u99m0",
  ebay: "https://www.ebay.com/itm/166847256012",
};

type SiteKey = keyof typeof DEFAULT_URLS;

function loadEnv(): Record<string, string> {
  const envPath = resolve(root, ".env.local");
  if (!existsSync(envPath)) {
    throw new Error("Missing .env.local with ZENROWS_API_KEY");
  }
  return Object.fromEntries(
    readFileSync(envPath, "utf8")
      .split(/\r?\n/)
      .filter((line) => line && !line.startsWith("#"))
      .map((line) => {
        const index = line.indexOf("=");
        return [line.slice(0, index), line.slice(index + 1)];
      })
  );
}

function parseArgs(argv: string[]) {
  let runs = 10;
  const urls = { ...DEFAULT_URLS };
  let sites: SiteKey[] = ["amazon", "flipkart", "meesho"];

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--runs" && argv[i + 1]) {
      runs = Math.max(1, Number.parseInt(argv[++i], 10) || 10);
    } else if (arg === "--sites" && argv[i + 1]) {
      sites = argv[++i]
        .split(",")
        .map((s) => s.trim() as SiteKey)
        .filter((s) => s in DEFAULT_URLS);
    } else if (arg.startsWith("--amazon=")) {
      urls.amazon = arg.slice("--amazon=".length);
    } else if (arg.startsWith("--flipkart=")) {
      urls.flipkart = arg.slice("--flipkart=".length);
    } else if (arg.startsWith("--meesho=")) {
      urls.meesho = arg.slice("--meesho=".length);
    } else if (arg.startsWith("--ebay=")) {
      urls.ebay = arg.slice("--ebay=".length);
    }
  }

  return { runs, urls, sites };
}

async function fetchSubscription(apiKey: string) {
  const res = await fetch("https://api.zenrows.com/v1/subscriptions/self/details", {
    headers: { "X-API-Key": apiKey },
  });
  if (!res.ok) return { error: `${res.status} ${await res.text()}` };
  return { data: (await res.json()) as Record<string, unknown> };
}

function summarizeSubscription(data: Record<string, unknown> | undefined) {
  if (!data || typeof data !== "object") return data;
  const plan = data.plan as Record<string, unknown> | undefined;
  const products = plan?.products as Record<string, unknown> | undefined;
  const dataApis = products?.data_apis as Record<string, unknown> | undefined;
  const webApi = products?.api as Record<string, unknown> | undefined;
  const planInfo = plan as { name?: string } | undefined;
  return {
    totalUsageUsd: data.usage,
    usagePercent: data.usage_percent,
    planName: planInfo?.name,
    dataApisUsageUsd: dataApis?.usage,
    webScrapingApiUsageUsd: webApi?.usage,
    periodEndsAt: data.period_ends_at,
  };
}

type RunResult = {
  site: SiteKey;
  run: number;
  ok: boolean;
  durationMs: number;
  price: number | null;
  currency: string | null;
  title: string | null;
  error: string | null;
};

async function probeSite(
  provider: PriceProvider,
  site: SiteKey,
  url: string,
  runs: number
): Promise<RunResult[]> {
  const results: RunResult[] = [];

  for (let i = 0; i < runs; i++) {
    const start = Date.now();
    try {
      const result = await provider.fetchPrice(url);
      results.push({
        site,
        run: i + 1,
        ok: true,
        durationMs: Date.now() - start,
        price: result.price,
        currency: result.currency,
        title: result.title ?? null,
        error: null,
      });
    } catch (err) {
      results.push({
        site,
        run: i + 1,
        ok: false,
        durationMs: Date.now() - start,
        price: null,
        currency: null,
        title: null,
        error: err instanceof Error ? err.message : String(err),
      });
    }

    if (i < runs - 1) {
      await new Promise((r) => setTimeout(r, 2000));
    }
  }

  return results;
}

function summarizeSite(site: SiteKey, results: RunResult[]) {
  const ok = results.filter((r) => r.ok);
  const failed = results.filter((r) => !r.ok);
  const durations = ok.map((r) => r.durationMs);
  const avgMs =
    durations.length > 0
      ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length)
      : 0;

  return {
    site,
    total: results.length,
    success: ok.length,
    failed: failed.length,
    successRate: `${((ok.length / results.length) * 100).toFixed(1)}%`,
    avgDurationMs: avgMs,
    samplePrice: ok[0]?.price ?? null,
    sampleCurrency: ok[0]?.currency ?? null,
    errors: [...new Set(failed.map((r) => r.error).filter(Boolean))],
  };
}

async function main() {
  const env = loadEnv();
  if (env.ZENROWS_API_KEY) process.env.ZENROWS_API_KEY = env.ZENROWS_API_KEY;
  if (env.DECODO_API_KEY) process.env.DECODO_API_KEY = env.DECODO_API_KEY;
  if (env.DECODO_API_TOKEN) process.env.DECODO_API_TOKEN = env.DECODO_API_TOKEN;
  if (env.DECODO_USERNAME) process.env.DECODO_USERNAME = env.DECODO_USERNAME;
  if (env.DECODO_PASSWORD) process.env.DECODO_PASSWORD = env.DECODO_PASSWORD;

  const { runs, urls, sites } = parseArgs(process.argv.slice(2));
  const provider = createPriceProvider();

  console.log("Price provider probe (production routing)");
  console.log(`Runs per site: ${runs}`);
  console.log(`Sites: ${sites.join(", ")}`);
  console.log("URLs:", JSON.stringify(urls, null, 2));
  console.log("");

  const before = env.ZENROWS_API_KEY
    ? await fetchSubscription(env.ZENROWS_API_KEY)
    : { error: "no zenrows key" };
  if (before.data) {
    console.log("Subscription (before):", JSON.stringify(summarizeSubscription(before.data), null, 2));
  }
  console.log("");

  const allResults: RunResult[] = [];

  for (const site of sites) {
    console.log(`=== ${site.toUpperCase()} (${runs} runs) ===`);
    const siteResults = await probeSite(provider, site, urls[site], runs);
    allResults.push(...siteResults);

    for (const r of siteResults) {
      const status = r.ok ? "OK" : "FAIL";
      const detail = r.ok
        ? `${r.currency} ${r.price} (${r.durationMs}ms)`
        : `${r.error} (${r.durationMs}ms)`;
      console.log(`  ${status} #${r.run}: ${detail}`);
    }
    console.log("");
  }

  const after = env.ZENROWS_API_KEY
    ? await fetchSubscription(env.ZENROWS_API_KEY)
    : { error: "no zenrows key" };
  if (after.data) {
    console.log("Subscription (after):", JSON.stringify(summarizeSubscription(after.data), null, 2));
  }
  console.log("");

  const summaries = sites.map((site) =>
    summarizeSite(
      site,
      allResults.filter((r) => r.site === site)
    )
  );

  console.log("=== SUMMARY ===");
  for (const s of summaries) {
    console.log(
      `${s.site}: ${s.success}/${s.total} (${s.successRate}), avg ${s.avgDurationMs}ms` +
        (s.samplePrice != null ? `, sample ${s.sampleCurrency} ${s.samplePrice}` : "") +
        (s.errors.length ? `, errors: ${s.errors.join(" | ")}` : "")
    );
  }

  if (before.data && after.data) {
    const b = summarizeSubscription(before.data) as Record<string, number | string | undefined>;
    const a = summarizeSubscription(after.data) as Record<string, number | string | undefined>;
    console.log("");
    if (b.totalUsageUsd != null && a.totalUsageUsd != null) {
      const delta = Number(a.totalUsageUsd) - Number(b.totalUsageUsd);
      const perSuccess =
        allResults.filter((r) => r.ok).length > 0
          ? delta / allResults.filter((r) => r.ok).length
          : 0;
      console.log(`Total usage delta (USD): $${delta.toFixed(6)}`);
      console.log(`Avg cost per successful fetch: $${perSuccess.toFixed(6)}`);
    }
    if (b.dataApisUsageUsd != null && a.dataApisUsageUsd != null) {
      const delta = Number(a.dataApisUsageUsd) - Number(b.dataApisUsageUsd);
      console.log(`Data APIs (Amazon) usage delta: $${delta.toFixed(6)}`);
    }
    if (b.webScrapingApiUsageUsd != null && a.webScrapingApiUsageUsd != null) {
      const delta = Number(a.webScrapingApiUsageUsd) - Number(b.webScrapingApiUsageUsd);
      console.log(`Web Scraping API (Flipkart/Meesho) usage delta: $${delta.toFixed(6)}`);
    }

    for (const site of sites) {
      const siteOk = allResults.filter((r) => r.site === site && r.ok).length;
      const siteKey = site === "amazon" ? "dataApisUsageUsd" : "webScrapingApiUsageUsd";
      if (site === "amazon" && b.dataApisUsageUsd != null && a.dataApisUsageUsd != null) {
        const totalWebDelta =
          Number(a.webScrapingApiUsageUsd ?? 0) - Number(b.webScrapingApiUsageUsd ?? 0);
        const totalDataDelta = Number(a.dataApisUsageUsd) - Number(b.dataApisUsageUsd);
        // per-site split printed below after loop
        void totalWebDelta;
        void totalDataDelta;
      }
      void siteKey;
      void siteOk;
    }

    const amazonOk = allResults.filter((r) => r.site === "amazon" && r.ok).length;
    const indiaOk = allResults.filter(
      (r) => (r.site === "flipkart" || r.site === "meesho") && r.ok
    ).length;
    if (b.dataApisUsageUsd != null && a.dataApisUsageUsd != null && amazonOk > 0) {
      const d = Number(a.dataApisUsageUsd) - Number(b.dataApisUsageUsd);
      console.log(`Amazon avg per success: $${(d / amazonOk).toFixed(6)} (${amazonOk} successes)`);
    }
    if (b.webScrapingApiUsageUsd != null && a.webScrapingApiUsageUsd != null && indiaOk > 0) {
      const d = Number(a.webScrapingApiUsageUsd) - Number(b.webScrapingApiUsageUsd);
      console.log(`India sites avg per success: $${(d / indiaOk).toFixed(6)} (${indiaOk} successes)`);
    }
  }

  const anyFailed = allResults.some((r) => !r.ok);
  if (anyFailed) process.exit(1);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
