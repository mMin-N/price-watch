const ASIN_PATTERN = /[A-Z0-9]{10}/;

const ASIN_PATH_PATTERNS = [
  /\/dp\/([A-Z0-9]{10})/i,
  /\/gp\/product\/([A-Z0-9]{10})/i,
  /\/gp\/aw\/d\/([A-Z0-9]{10})/i,
  /\/product\/([A-Z0-9]{10})/i,
];

export function extractAmazonAsin(url: string): string | null {
  let hostname = "";
  try {
    hostname = new URL(url).hostname.toLowerCase();
  } catch {
    return null;
  }

  if (!hostname.includes("amazon.")) {
    return null;
  }

  for (const pattern of ASIN_PATH_PATTERNS) {
    const match = url.match(pattern);
    if (match?.[1] && ASIN_PATTERN.test(match[1].toUpperCase())) {
      return match[1].toUpperCase();
    }
  }

  return null;
}
