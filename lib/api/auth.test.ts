import { describe, it, expect } from "vitest";
import { bearerTokenFromRequest, isEmailVerified } from "./auth";
import type { User } from "@supabase/supabase-js";

function user(overrides: Partial<User>): User {
  return {
    id: "u1",
    aud: "authenticated",
    role: "authenticated",
    email: "a@b.com",
    app_metadata: {},
    user_metadata: {},
    created_at: "",
    ...overrides,
  } as User;
}

describe("bearerTokenFromRequest", () => {
  it("returns token from Authorization header", () => {
    const req = new Request("https://x/api/products", {
      headers: { Authorization: "Bearer abc123" },
    });
    expect(bearerTokenFromRequest(req)).toBe("abc123");
  });

  it("returns null when header missing", () => {
    const req = new Request("https://x/api/products");
    expect(bearerTokenFromRequest(req)).toBeNull();
  });
});

describe("isEmailVerified", () => {
  it("returns true when email_confirmed_at is set", () => {
    expect(isEmailVerified(user({ email_confirmed_at: "2026-01-01" }))).toBe(true);
  });

  it("returns false when email not confirmed", () => {
    expect(isEmailVerified(user({ email_confirmed_at: undefined }))).toBe(false);
  });

  it("returns true for google oauth users", () => {
    expect(
      isEmailVerified(user({ app_metadata: { providers: ["google"] }, email_confirmed_at: undefined }))
    ).toBe(true);
  });
});
