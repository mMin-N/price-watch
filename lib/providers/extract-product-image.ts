function firstHttpUrl(value: unknown): string | undefined {
  if (typeof value === "string" && value.startsWith("http")) {
    return value.trim();
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      const url = firstHttpUrl(item);
      if (url) return url;
    }
  }
  if (value && typeof value === "object" && "url" in value) {
    return firstHttpUrl((value as { url?: unknown }).url);
  }
  return undefined;
}

export function extractImageFromHtml(html: string): string | undefined {
  const ogImage =
    html.match(/property=["']og:image["']\s+content=["']([^"']+)["']/i) ??
    html.match(/content=["']([^"']+)["']\s+property=["']og:image["']/i);
  if (ogImage?.[1]) {
    return ogImage[1].trim();
  }

  const twitterImage =
    html.match(/property=["']twitter:image["']\s+content=["']([^"']+)["']/i) ??
    html.match(/content=["']([^"']+)["']\s+property=["']twitter:image["']/i) ??
    html.match(/name=["']twitter:image["']\s+content=["']([^"']+)["']/i);
  if (twitterImage?.[1]) {
    return twitterImage[1].trim();
  }

  const scripts = html.matchAll(
    /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi
  );

  for (const match of scripts) {
    try {
      const data = JSON.parse(match[1]) as unknown;
      const nodes = Array.isArray(data) ? data : [data];
      for (const node of nodes) {
        const url = firstHttpUrl((node as { image?: unknown })?.image);
        if (url) return url;
      }
    } catch {
      // ignore invalid JSON-LD blocks
    }
  }

  return undefined;
}
