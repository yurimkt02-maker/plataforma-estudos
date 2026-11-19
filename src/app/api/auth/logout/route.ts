import { NextResponse } from "next/server";
import { clearSessionCookie, getServerSession } from "@/lib/auth/session";
import { revokeSessionServerless } from "@/lib/auth/session-revocation";

export const runtime = "nodejs";

export async function POST() {
  const session = await getServerSession();
  if (session) {
    await revokeSessionServerless(session);
  }
  await clearSessionCookie();
  return NextResponse.json({ authenticated: false, revoked: true });
}
