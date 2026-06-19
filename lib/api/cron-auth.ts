import { timingSafeEqual } from "crypto";

export function verifyCronAuth(request: Request): Response | null {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    console.error(JSON.stringify({ step: "cron_auth", error: "CRON_SECRET not configured" }));
    return Response.json({ error: "Cron not configured" }, { status: 503 });
  }

  const auth = request.headers.get("authorization");
  if (!auth?.startsWith("Bearer ")) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const token = auth.slice("Bearer ".length);
  const expected = Buffer.from(secret, "utf8");
  const received = Buffer.from(token, "utf8");

  if (expected.length !== received.length || !timingSafeEqual(expected, received)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  return null;
}
