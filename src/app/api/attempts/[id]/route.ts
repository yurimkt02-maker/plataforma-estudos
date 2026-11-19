import { NextRequest, NextResponse } from "next/server";
import { requireApiAuth } from "@/lib/auth/api-guard";
import { isDatabaseConfigured, prisma } from "@/lib/db/prisma";
import { saveSimulationResponsesSchema } from "@/lib/validations/schemas";

export const runtime = "nodejs";

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireApiAuth();
  if (!auth.authorized) return auth.response;

  if (!isDatabaseConfigured()) {
    return NextResponse.json(
      {
        error: "DATABASE_NOT_CONFIGURED",
        message: "Configure o Prisma Postgres para salvar respostas de simulado.",
      },
      { status: 503 }
    );
  }

  const { id } = await context.params;
  const attempt = await prisma.simulationAttempt.findUnique({
    where: { id },
  });

  if (!attempt || attempt.userId !== auth.user.id) {
    return NextResponse.json(
      {
        error: "NOT_FOUND",
        message: "Tentativa de simulado não encontrada.",
      },
      { status: 404 }
    );
  }

  if (attempt.status !== "IN_PROGRESS") {
    return NextResponse.json(
      {
        error: "SIMULATION_ALREADY_CLOSED",
        message:
          "Este simulado já foi encerrado e não pode receber novas respostas.",
      },
      { status: 409 }
    );
  }

  const body = await request.json();
  const parsed = saveSimulationResponsesSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "VALIDATION_ERROR",
        message: "Payload de salvamento inválido.",
        issues: parsed.error.issues,
      },
      { status: 400 }
    );
  }

  await prisma.$transaction(async (tx) => {
    if (typeof parsed.data.elapsedSeconds === "number") {
      await tx.simulationAttempt.update({
        where: { id: attempt.id },
        data: { timeSpentSeconds: parsed.data.elapsedSeconds },
      });
    }

    for (const resp of parsed.data.responses) {
      await tx.simulationResponse.upsert({
        where: {
          simulationAttemptId_simulationItemId: {
            simulationAttemptId: attempt.id,
            simulationItemId: resp.simulationItemId,
          },
        },
        update: {
          selectedAnswer: resp.selectedAnswer,
          isBlank: resp.selectedAnswer === null,
          markedForReview: resp.markedForReview,
          timeSpentSeconds: resp.timeSpentSeconds,
          answeredAt: new Date(),
        },
        create: {
          simulationAttemptId: attempt.id,
          simulationItemId: resp.simulationItemId,
          selectedAnswer: resp.selectedAnswer,
          isBlank: resp.selectedAnswer === null,
          markedForReview: resp.markedForReview,
          timeSpentSeconds: resp.timeSpentSeconds,
          answeredAt: new Date(),
        },
      });
    }
  });

  return NextResponse.json({
    saved: true,
    attemptId: attempt.id,
    savedAt: new Date().toISOString(),
  });
}
