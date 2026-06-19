import type { SupportedSite } from "./detect-site";
import { proxyCountryForSite } from "./sites/proxy-country";

const COUNTRY_CODE_TO_DECODO_GEO: Record<string, string> = {
  in: "India",
  us: "United States",
  gb: "United Kingdom",
  de: "Germany",
  fr: "France",
  it: "Italy",
  es: "Spain",
  ca: "Canada",
  au: "Australia",
  jp: "Japan",
};

export function decodoGeoForSite(url: string, site: SupportedSite): string {
  const code = proxyCountryForSite(url, site);
  return COUNTRY_CODE_TO_DECODO_GEO[code] ?? "United States";
}
