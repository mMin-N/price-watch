import { NextResponse } from "next/server";
import { isEmailVerified, requireUserFromRequest } from "@/lib/api/auth";

export async function GET(request: Request) {
  const { user, response } = await requireUserFromRequest(request);
  if (response) return response;

  return NextResponse.json({
    email: user.email,
    emailVerified: isEmailVerified(user),
  });
}
