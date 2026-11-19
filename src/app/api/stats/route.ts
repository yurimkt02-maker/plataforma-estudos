import { NextRequest, NextResponse } from "next/server";
import { requireApiAuth } from "@/lib/auth/api-guard";
import { getDashboardOverview } from "@/features/question-bank/service";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const auth = await requireApiAuth();
  if (!auth.authorized) return auth.response;

  const trackCode = request.nextUrl.searchParams.get("trackCode") ?? undefined;
  const overview = await getDashboardOverview({
    userId: auth.user.id,
    trackCode,
  });

  return NextResponse.json(overview);
}
