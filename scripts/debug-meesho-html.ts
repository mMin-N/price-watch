import { readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { buildDecodoScrapeBody } from "../lib/providers/decodo-scrape-config";
import { decodoAuthorizationHeader } from "../lib/providers/decodo-auth";
import { parseMeeshoPage } from "../lib/providers/sites/meesho";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const env = Object.fromEntries(
  readFileSync(resolve(root, ".env.local"), "utf8")
    .split(/\r?\n/)
    .filter((line) => line && !line.startsWith("#"))
    .map((line) => {
      const index = line.indexOf("=");
      return [line.slice(0, index), line.slice(index + 1)];
    })
);
if (env.DECODO_API_KEY) process.env.DECODO_API_KEY = env.DECODO_API_KEY;
if (env.DECODO_API_TOKEN) process.env.DECODO_API_TOKEN = env.DECODO_API_TOKEN;

async function main() {
const url = process.argv[2] ?? "https://www.meesho.com/kurti/p/6dy8dt";
const body = buildDecodoScrapeBody(url, "meesho", "India");
console.log("geo:", body.geo, "url:", url);

const res = await fetch("https://scraper-api.decodo.com/v2/scrape", {
  method: "POST",
  headers: {
    Accept: "application/json",
    "Content-Type": "application/json",
    Authorization: decodoAuthorizationHeader(),
  },
  body: JSON.stringify(body),
});
const payload = await res.json();
const result = payload.results?.[0];
const html = result?.content ?? "";

console.log("http", res.status, "page", result?.status_code, "bytes", html.length);
console.log("title", html.match(/<title>([^<]*)</i)?.[1] ?? "(none)");
console.log("has __NEXT_DATA__", html.includes("__NEXT_DATA__"));
console.log("has Akamai", /akamai|Access Denied|Powered and protected/i.test(html));
console.log("parsed", parseMeeshoPage(html));

const out = resolve(root, "tmp-meesho-debug.html");
writeFileSync(out, html.slice(0, 500_000));
console.log("wrote", out);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
