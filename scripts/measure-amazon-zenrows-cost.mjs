/**
 * Measure ZenRows balance cost for one Amazon product fetch (same path as production).
 *
 * Usage:
 *   npm run measure:amazon-cost
 *   npm run measure:amazon-cost -- "https://www.amazon.com/dp/B0FB15XXWX"
 *   npm run measure:amazon-cost -- --runs 3
 *
 * Reads ZENROWS_API_KEY from .env.local. Each successful run consumes real credits.
 */

import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const DEFAULT_URL = "https://www.amazon.com/dp/B0FB15XXWX";

const ASIN_PATH_PATTERNS = [
  /\/dp\/([A-Z0-9]{10})/i,
  /\/gp\/product\/([A-Z0-9]{10})/i,
  /\/gp\/aw\/d\/([A-Z0-9]{10})/i,
  /\/product\/([A-Z0-9]{10})/i,
];

const AMAZON_TLD_TO_COUNTRY = {
  com: "us",
  "co.uk": "gb",
  de: "de",
  fr: "fr",
  it: "it",
  es: "es",
  ca: "ca",
  "com.au": "au",
  "co.jp": "jp",
  in: "in",
};

function loadEnv() {
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
      }),
  );
}

function parseArgs(argv) {
  let url = DEFAULT_URL;
  let runs = 1;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--runs" && argv[i + 1]) {
      runs = Math.max(1, Number.parseInt(argv[++i], 10) || 1);
    } else if (!arg.startsWith("--")) {
      url = arg;
    }
  }

  return { url, runs };
}

function extractAsin(url) {
  for (const pattern of ASIN_PATH_PATTERNS) {
    const match = url.match(pattern);
    if (match?.[1]) return match[1].toUpperCase();
  }
  return null;
}

function amazonCountryFromUrl(url) {
  try {
    const hostname = new URL(url).hostname.toLowerCase();
    const host = hostname.replace(/^www\./, "");
    const suffix = host.replace(/^amazon\./, "");
    return AMAZON_TLD_TO_COUNTRY[suffix] ?? "us";
  } catch {
    return "us";
  }
}

function pickCostHeaders(headers) {
  const interesting = [
    "x-request-cost",
    "x-request-id",
    "concurrency-limit",
    "concurrency-remaining",
    "zr-final-url",
  ];
  const out = {};
  for (const key of interesting) {
    const value = headers.get(key);
    if (value != null) out[key] = value;
  }
  return out;
}

async function fetchSubscription(apiKey) {
  const res = await fetch("https://api.zenrows.com/v1/subscriptions/self/details", {
    headers: { "X-API-Key": apiKey },
  });
  if (!res.ok) {
    return { error: `${res.status} ${await res.text()}` };
  }
  return { data: await res.json() };
}

function summarizeSubscription(data) {
  if (!data || typeof data !== "object") return data;
  const dataApis = data.plan?.products?.data_apis;
  const webApi = data.plan?.products?.api;
  return {
    totalUsageUsd: data.usage,
    usagePercent: data.usage_percent,
    planName: data.plan?.name,
    dataApisUsageUsd: dataApis?.usage,
    webScrapingApiUsageUsd: webApi?.usage,
    periodEndsAt: data.period_ends_at,
  };
}

async function fetchAmazonProduct(apiKey, url) {
  const asin = extractAsin(url);
  if (!asin) {
    throw new Error(`Could not extract ASIN from URL: ${url}`);
  }

  const country = amazonCountryFromUrl(url);
  const params = new URLSearchParams({ apikey: apiKey, country });
  const endpoint = `https://ecommerce.api.zenrows.com/v1/targets/amazon/products/${asin}?${params}`;
  const start = Date.now();
  const res = await fetch(endpoint);
  const durationMs = Date.now() - start;

  let body = null;
  const contentType = res.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    body = await res.json();
  } else {
    body = await res.text();
  }

  return {
    ok: res.ok,
    status: res.status,
    asin,
    country,
    durationMs,
    headers: pickCostHeaders(res.headers),
    product:
      res.ok && body && typeof body === "object"
        ? {
            title: body.product_name ?? null,
            price: body.product_price ?? null,
            currency: body.price_currency_code ?? null,
            isAvailable: body.is_available,
          }
        : null,
    errorBody: res.ok ? null : body,
  };
}

async function main() {
  const env = loadEnv();
  const apiKey = env.ZENROWS_API_KEY;
  if (!apiKey) {
    throw new Error("ZENROWS_API_KEY is not set in .env.local");
  }

  const { url, runs } = parseArgs(process.argv.slice(2));

  console.log("ZenRows Amazon credit probe");
  console.log("URL:", url);
  console.log("Runs:", runs);
  console.log("");

  const before = await fetchSubscription(apiKey);
  if (before.data) {
    console.log("Subscription (before):", JSON.stringify(summarizeSubscription(before.data), null, 2));
  } else {
    console.warn("Subscription (before) unavailable:", before.error);
  }
  console.log("");

  const results = [];
  let totalHeaderCost = 0;

  for (let i = 0; i < runs; i++) {
    const result = await fetchAmazonProduct(apiKey, url);
    results.push(result);

    const headerCost = Number.parseFloat(result.headers["x-request-cost"] ?? "");
    if (!Number.isNaN(headerCost)) totalHeaderCost += headerCost;

    console.log(`Run ${i + 1}/${runs}:`);
    console.log(JSON.stringify(result, null, 2));
    console.log("");

    if (i < runs - 1) {
      await new Promise((r) => setTimeout(r, 1500));
    }
  }

  const after = await fetchSubscription(apiKey);
  if (after.data) {
    console.log("Subscription (after):", JSON.stringify(summarizeSubscription(after.data), null, 2));
  } else {
    console.warn("Subscription (after) unavailable:", after.error);
  }
  console.log("");

  const succeeded = results.filter((r) => r.ok).length;
  const failed = results.length - succeeded;

  console.log("Summary:");
  console.log(`  Successful runs: ${succeeded}/${runs}`);
  console.log(`  Failed runs: ${failed}`);
  if (totalHeaderCost > 0) {
    console.log(`  Sum of X-Request-Cost headers: $${totalHeaderCost.toFixed(6)}`);
    console.log(`  Avg X-Request-Cost per success: $${(totalHeaderCost / Math.max(succeeded, 1)).toFixed(6)}`);
  } else {
    console.log("  X-Request-Cost header not returned (check raw headers above).");
  }

  if (before.data && after.data) {
    const b = summarizeSubscription(before.data);
    const a = summarizeSubscription(after.data);
    if (b.totalUsageUsd != null && a.totalUsageUsd != null) {
      const delta = Number(a.totalUsageUsd) - Number(b.totalUsageUsd);
      console.log(`  Total usage delta (USD): ${delta}`);
    }
    if (b.dataApisUsageUsd != null && a.dataApisUsageUsd != null) {
      const delta = Number(a.dataApisUsageUsd) - Number(b.dataApisUsageUsd);
      console.log(`  Data APIs usage delta (USD): ${delta}`);
    }
  }

  console.log("");
  console.log("Notes:");
  console.log("  - Amazon uses ZenRows Data APIs (ecommerce), not Universal Scraper.");
  console.log("  - X-Request-Cost may be absent on this endpoint; use usage delta above.");
  console.log("  - Repeat the same ASIN may be cached; use --runs 1 with different URLs to compare.");

  if (failed > 0) process.exit(1);
}

main().catch((error) => {
  console.error(error.message ?? error);
  process.exit(1);
});
