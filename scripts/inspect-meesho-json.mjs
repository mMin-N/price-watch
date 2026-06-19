import { readFileSync, writeFileSync } from "node:fs";

const html = readFileSync("tmp-meesho-debug.html", "utf8");
const match = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/i);
if (!match) {
  console.log("no __NEXT_DATA__");
  process.exit(1);
}

const data = JSON.parse(match[1]);
const pp = data.props?.pageProps ?? {};
const lines = [];
lines.push(`pageProps keys: ${Object.keys(pp).join(", ")}`);

function walk(obj, path, depth = 0) {
  if (depth > 6 || !obj || typeof obj !== "object") return;
  if ("price" in obj && (typeof obj.price === "number" || typeof obj.price === "string")) {
    lines.push(`price at ${path}: ${obj.price} name=${obj.name ?? obj.product_name ?? "?"}`);
  }
  if ("selling_price" in obj) {
    lines.push(`selling_price at ${path}: ${obj.selling_price}`);
  }
  for (const [k, v] of Object.entries(obj)) {
    if (v && typeof v === "object") walk(v, `${path}.${k}`, depth + 1);
  }
}

walk(pp, "pageProps");
writeFileSync("tmp-meesho-inspect.txt", lines.join("\n"));
console.log(lines.slice(0, 30).join("\n"));
