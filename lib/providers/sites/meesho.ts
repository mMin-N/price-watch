import { detectOutOfStock, parseInrPrice, type SiteParseResult } from "./shared";

const OUT_OF_STOCK_PATTERNS = [
  /out of stock/i,
  /sold out/i,
  /currently unavailable/i,
];

function extractMeeshoProduct(data: unknown): Record<string, unknown> | null {
  if (!data || typeof data !== "object") return null;
  const pageProps = (data as { props?: { pageProps?: Record<string, unknown> } }).props
    ?.pageProps;
  if (!pageProps) return null;

  const candidates = [
    pageProps.product,
    (pageProps.initialState as { product?: { details?: { data?: unknown } } } | undefined)
      ?.product?.details?.data,
    (pageProps.initialState as { product?: { product?: unknown } } | undefined)?.product
      ?.product,
    (pageProps.data as { product?: unknown } | undefined)?.product,
  ];

  for (const candidate of candidates) {
    if (candidate && typeof candidate === "object") {
      return candidate as Record<string, unknown>;
    }
  }

  return null;
}

function parseMeeshoNextData(html: string): SiteParseResult | null {
  const match = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/i);
  if (!match) return null;

  try {
    const data = JSON.parse(match[1]);
    const product = extractMeeshoProduct(data);
    if (!product) return null;

    const price =
      product.price ?? product.selling_price ?? product.final_price ?? product.min_product_price;
    if (price === undefined || price === null) return null;

    const parsed = parseInrPrice(String(price));
    if (!parsed) return null;

    const inStock = product.in_stock ?? product.is_in_stock ?? product.inStock;
    const title =
      typeof product.name === "string"
        ? product.name
        : typeof product.product_name === "string"
          ? product.product_name
          : undefined;

    return {
      price: parsed,
      currency: "INR",
      title,
      isAvailable: inStock === undefined ? true : Boolean(inStock),
    };
  } catch {
    return null;
  }
}

export function parseMeeshoPage(html: string): SiteParseResult | null {
  const nextData = parseMeeshoNextData(html);
  if (nextData) {
    if (detectOutOfStock(html, OUT_OF_STOCK_PATTERNS)) {
      return { ...nextData, isAvailable: false };
    }
    return nextData;
  }

  const metaPrice =
    html.match(/property="product:price:amount"\s+content="([\d.]+)"/i) ??
    html.match(/content="([\d.]+)"\s+property="product:price:amount"/i);

  if (metaPrice) {
    const price = parseInrPrice(metaPrice[1]);
    if (!price) return null;
    return {
      price,
      currency: "INR",
      isAvailable: !detectOutOfStock(html, OUT_OF_STOCK_PATTERNS),
    };
  }

  return null;
}
