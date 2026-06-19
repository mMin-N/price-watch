import { describe, it, expect } from "vitest";
import { rateLimitResponse } from "./rate-limit";

describe("rateLimitResponse", () => {
  it("returns 429 with retryAfterSeconds in body and Retry-After header", async () => {
    const res = rateLimitResponse(120);
    expect(res.status).toBe(429);
    expect(res.headers.get("Retry-After")).toBe("120");
    const body = await res.json();
    expect(body.retryAfterSeconds).toBe(120);
    expect(body.error).toBe("Rate limit exceeded");
  });
});
