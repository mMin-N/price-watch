/**
 * Multi-URL success probe for Decodo-routed sites (budget ~50 requests).
 * One run per URL to measure parser/provider stability across product types.
 *
 * Usage:
 *   npx tsx scripts/measure-multi-url-probe.ts
 *   npx tsx scripts/measure-multi-url-probe.ts --sites flipkart,ebay
 */

import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createPriceProvider } from "../lib/providers/get-price-provider";
import { detectSite } from "../lib/providers/detect-site";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

/** Curated live listings — mix categories; some may 404 over time. */
const URL_POOL: Record<string, string[]> = {
  flipkart: [
    "https://www.flipkart.com/realme-p4-lite-5g-mosaic-green-64-gb/p/itm90c243961f214?pid=MOBHHFBUUUQNXRGX&lid=LSTMOBHHFBUUUQNXRGXKR3NYG&marketplace=FLIPKART",
    "https://www.flipkart.com/realme-p4r-5g-silver-glare-128-gb/p/itmb42ae388c1ef6?pid=MOBHMYR3EJZ8J2ES&lid=LSTMOBHMYR3EJZ8J2ESJIJD96&marketplace=FLIPKART",
    "https://www.flipkart.com/realme-p4-lite-5g-mosaic-blue-64-gb/p/itm90c243961f214?pid=MOBHHFBUHTZG3GTN&lid=LSTMOBHHFBUHTZG3GTN6CU6Z3&marketplace=FLIPKART",
  ],
  ebay: [
    "https://www.ebay.com/itm/267005627153",
    "https://www.ebay.com/itm/257161337055",
    "https://www.ebay.com/itm/227278777948",
  ],
  meesho: [
    "https://www.meesho.com/kurti/p/6dy8dt",
    "https://www.meesho.com/aadhya-premium-kurtis/p/6kbzoq",
    "https://www.meesho.com/s/p/19yax6",
  ],
};

type PoolSite = keyof typeof URL_POOL;

function loadEnv(): Record<string, string> {
  const envPath = resolve(root, ".env.local");
  if (!existsSync(envPath)) {
    throw new Error("Missing .env.local with DECODO credentials");
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
  let sites: PoolSite[] = ["flipkart", "ebay"];
  const delayMs = 2500;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--sites" && argv[i + 1]) {
      sites = argv[++i]
        .split(",")
        .map((s) => s.trim() as PoolSite)
        .filter((s) => s in URL_POOL);
    }
  }

  return { sites, delayMs };
}

type UrlResult = {
  site: PoolSite;
  url: string;
  ok: boolean;
  durationMs: number;
  price: number | null;
  currency: string | null;
  title: string | null;
  error: string | null;
};

async function probeUrl(
  provider: ReturnType<typeof createPriceProvider>,
  site: PoolSite,
  url: string
): Promise<UrlResult> {
  const start = Date.now();
  try {
    const result = await provider.fetchPrice(url);
    return {
      site,
      url,
      ok: true,
      durationMs: Date.now() - start,
      price: result.price,
      currency: result.currency,
      title: result.title ?? null,
      error: null,
    };
  } catch (err) {
    return {
      site,
      url,
      ok: false,
      durationMs: Date.now() - start,
      price: null,
      currency: null,
      title: null,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

function shortUrl(url: string): string {
  try {
    const u = new URL(url);
    const itm = u.pathname.match(/itm[a-z0-9]*/i)?.[0] ?? u.pathname.slice(-24);
    const pid = u.searchParams.get("pid");
    return pid ? `pid=${pid.slice(0, 12)}…` : itm;
  } catch {
    return url.slice(0, 40);
  }
}

async function main() {
  const env = loadEnv();
  if (env.DECODO_API_KEY) process.env.DECODO_API_KEY = env.DECODO_API_KEY;
  if (env.DECODO_API_TOKEN) process.env.DECODO_API_TOKEN = env.DECODO_API_TOKEN;
  if (env.DECODO_USERNAME) process.env.DECODO_USERNAME = env.DECODO_USERNAME;
  if (env.DECODO_PASSWORD) process.env.DECODO_PASSWORD = env.DECODO_PASSWORD;

  const { sites, delayMs } = parseArgs(process.argv.slice(2));
  const provider = createPriceProvider();
  const planned = sites.reduce((n, s) => n + URL_POOL[s].length, 0);

  console.log("Multi-URL Decodo probe (1 run per URL)");
  console.log(`Sites: ${sites.join(", ")}`);
  console.log(`Planned requests: ${planned} (check Decodo dashboard before/after)`);
  console.log("");

  const allResults: UrlResult[] = [];

  for (const site of sites) {
    console.log(`=== ${site.toUpperCase()} (${URL_POOL[site].length} URLs) ===`);
    for (let i = 0; i < URL_POOL[site].length; i++) {
      const url = URL_POOL[site][i];
      const detected = detectSite(url);
      if (detected !== site) {
        console.log(`  SKIP ${shortUrl(url)}: detectSite=${detected}`);
        continue;
      }

      const r = await probeUrl(provider, site, url);
      allResults.push(r);

      const status = r.ok ? "OK" : "FAIL";
      const detail = r.ok
        ? `${r.currency} ${r.price}${r.title ? ` — ${r.title.slice(0, 40)}` : ""} (${r.durationMs}ms)`
        : `${r.error} (${r.durationMs}ms)`;
      console.log(`  ${status} [${i + 1}/${URL_POOL[site].length}] ${shortUrl(url)}: ${detail}`);

      if (i < URL_POOL[site].length - 1) {
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }
    console.log("");
  }

  console.log("=== SUMMARY BY SITE ===");
  for (const site of sites) {
    const siteResults = allResults.filter((r) => r.site === site);
    const ok = siteResults.filter((r) => r.ok);
    const avgMs =
      ok.length > 0
        ? Math.round(ok.reduce((a, r) => a + r.durationMs, 0) / ok.length)
        : 0;
    const errors = [...new Set(siteResults.filter((r) => !r.ok).map((r) => r.error))];
    console.log(
      `${site}: ${ok.length}/${siteResults.length} (${((ok.length / siteResults.length) * 100).toFixed(1)}%), avg ${avgMs}ms` +
        (errors.length ? ` | errors: ${errors.join(" | ")}` : "")
    );
  }

  console.log("");
  console.log("=== FAILED URLS ===");
  const failed = allResults.filter((r) => !r.ok);
  if (failed.length === 0) {
    console.log("(none)");
  } else {
    for (const r of failed) {
      console.log(`  ${r.site} ${shortUrl(r.url)}: ${r.error}`);
    }
  }

  console.log("");
  console.log(`Total requests: ${allResults.length}, successes: ${allResults.filter((r) => r.ok).length}`);
  console.log("Compare Decodo dashboard credits before/after for actual cost.");

  const anyFailed = allResults.some((r) => !r.ok);
  if (anyFailed) process.exit(1);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
