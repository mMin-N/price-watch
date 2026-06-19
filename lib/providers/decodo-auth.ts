export function decodoAuthorizationHeader(): string {
  const token = process.env.DECODO_API_TOKEN ?? process.env.DECODO_API_KEY;
  if (token) {
    return token.startsWith("Basic ") ? token : `Basic ${token}`;
  }

  const username = process.env.DECODO_USERNAME;
  const password = process.env.DECODO_PASSWORD;
  if (username && password) {
    return `Basic ${Buffer.from(`${username}:${password}`).toString("base64")}`;
  }

  throw new Error("Decodo credentials not configured");
}

export function isDecodoConfigured(): boolean {
  return Boolean(
    process.env.DECODO_API_TOKEN ??
      process.env.DECODO_API_KEY ??
      (process.env.DECODO_USERNAME && process.env.DECODO_PASSWORD)
  );
}
