import { describe, it, expect, vi } from "vitest";

vi.mock("firebase-admin/app", () => ({
  getApps: vi.fn(() => []),
  initializeApp: vi.fn(),
  cert: vi.fn(),
}));

vi.mock("firebase-admin/messaging", () => ({
  getMessaging: vi.fn(() => ({
    send: vi.fn().mockResolvedValue("msg-id"),
  })),
}));

import { sendFcmAlert } from "./send-fcm-alert";

describe("sendFcmAlert", () => {
  it("returns false when Firebase not configured", async () => {
    const result = await sendFcmAlert({
      token: "t",
      title: "Alert",
      body: "Price dropped",
      data: { productId: "p1" },
    });
    expect(result).toBe(false);
  });
});
