import { NextRequest, NextResponse } from "next/server";
import { requireApiAuth } from "@/lib/auth/api-guard";
import { questionFilterSchema } from "@/lib/validations/schemas";
import { searchPublishedQuestions } from "@/features/question-bank/service";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const auth = await requireApiAuth();
  if (!auth.authorized) return auth.response;

  const rawParams = Object.fromEntries(request.nextUrl.searchParams.entries());
  const parsed = questionFilterSchema.safeParse({
    ...rawParams,
    trackCode: rawParams.trackCode || rawParams.track || undefined,
  });

  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "INVALID_FILTERS",
        message: "Parâmetros de filtro inválidos.",
        issues: parsed.error.issues,
      },
      { status: 400 }
    );
  }

  const result = await searchPublishedQuestions({
    userId: auth.user.id,
    filters: parsed.data,
  });

  return NextResponse.json(result);
}
