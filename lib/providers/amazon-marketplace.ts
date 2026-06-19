const HOSTNAME_TO_COUNTRY: Record<string, string> = {
  "amazon.com": "us",
  "amazon.ca": "ca",
  "amazon.com.mx": "mx",
  "amazon.com.br": "br",
  "amazon.co.uk": "gb",
  "amazon.de": "de",
  "amazon.fr": "fr",
  "amazon.it": "it",
  "amazon.es": "es",
  "amazon.nl": "nl",
  "amazon.se": "se",
  "amazon.pl": "pl",
  "amazon.co.jp": "jp",
  "amazon.com.au": "au",
  "amazon.in": "in",
  "amazon.sg": "sg",
  "amazon.ae": "ae",
  "amazon.sa": "sa",
  "amazon.com.tr": "tr",
  "amazon.eg": "eg",
};

export function amazonCountryFromUrl(url: string): string {
  try {
    const hostname = new URL(url).hostname.toLowerCase().replace(/^www\./, "");
    if (HOSTNAME_TO_COUNTRY[hostname]) {
      return HOSTNAME_TO_COUNTRY[hostname];
    }
    const suffixMatch = hostname.match(/amazon\.(.+)$/);
    if (suffixMatch) {
      const suffix = suffixMatch[1];
      if (suffix === "com") return "us";
      if (suffix === "co.uk") return "gb";
      if (suffix === "co.jp") return "jp";
      if (suffix === "com.au") return "au";
      if (suffix.length === 2) return suffix;
    }
  } catch {
    // fall through
  }
  return "us";
}
