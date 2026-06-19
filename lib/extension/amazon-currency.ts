import { amazonCountryFromUrl } from "@/lib/providers/amazon-marketplace";

const COUNTRY_TO_CURRENCY: Record<string, string> = {
  us: "USD",
  ca: "CAD",
  mx: "MXN",
  br: "BRL",
  gb: "GBP",
  de: "EUR",
  fr: "EUR",
  it: "EUR",
  es: "EUR",
  nl: "EUR",
  se: "SEK",
  pl: "PLN",
  jp: "JPY",
  au: "AUD",
  in: "INR",
  sg: "SGD",
  ae: "AED",
  sa: "SAR",
  tr: "TRY",
  eg: "EGP",
};

export function defaultAmazonCurrency(url: string): string {
  const country = amazonCountryFromUrl(url);
  return COUNTRY_TO_CURRENCY[country] ?? "USD";
}
