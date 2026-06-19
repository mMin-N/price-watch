import { defaultAmazonCurrency } from "./amazon-currency";

const SYMBOL_CURRENCY: Record<string, string> = {
  "£": "GBP",
  "€": "EUR",
  "₹": "INR",
  "¥": "JPY",
  "₺": "TRY",
  "R$": "BRL",
};

export type ParsedDomPrice = {
  price: number;
  currency: string;
};

function parseNumericAmount(raw: string): number | null {
  const cleaned = raw
    .replace(/\u00a0/g, " ")
    .replace(/[^\d.,]/g, "")
    .trim();

  if (!cleaned) {
    return null;
  }

  const lastComma = cleaned.lastIndexOf(",");
  const lastDot = cleaned.lastIndexOf(".");

  let normalized = cleaned;
  if (lastComma !== -1 && lastDot !== -1) {
    if (lastComma > lastDot) {
      normalized = cleaned.replace(/\./g, "").replace(",", ".");
    } else {
      normalized = cleaned.replace(/,/g, "");
    }
  } else if (lastComma !== -1) {
    const parts = cleaned.split(",");
    if (parts.length === 2 && parts[1].length <= 2) {
      normalized = `${parts[0].replace(/\./g, "")}.${parts[1]}`;
    } else {
      normalized = cleaned.replace(/,/g, "");
    }
  } else if (lastDot !== -1) {
    const parts = cleaned.split(".");
    if (parts.length > 2) {
      const decimal = parts.pop() ?? "";
      normalized = `${parts.join("")}.${decimal}`;
    }
  }

  const value = Number.parseFloat(normalized);
  return Number.isFinite(value) && value >= 0 ? value : null;
}

function detectCurrencyFromSymbols(raw: string, fallbackCurrency: string): string {
  for (const [symbol, currency] of Object.entries(SYMBOL_CURRENCY)) {
    if (raw.includes(symbol)) {
      return currency;
    }
  }

  if (raw.includes("$")) {
    return fallbackCurrency === "CAD" ||
      fallbackCurrency === "AUD" ||
      fallbackCurrency === "MXN" ||
      fallbackCurrency === "SGD"
      ? fallbackCurrency
      : "USD";
  }

  return fallbackCurrency;
}

export function parseDomPrice(rawPrice: string, productUrl: string): ParsedDomPrice {
  const trimmed = rawPrice.trim();
  if (!trimmed) {
    throw new Error("Cannot parse price from page");
  }

  const fallbackCurrency = defaultAmazonCurrency(productUrl);
  const currency = detectCurrencyFromSymbols(trimmed, fallbackCurrency);
  const price = parseNumericAmount(trimmed);

  if (price === null) {
    throw new Error("Cannot parse price from page");
  }

  return { price, currency };
}
