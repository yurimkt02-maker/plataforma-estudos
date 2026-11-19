import { NextRequest, NextResponse } from "next/server";
import { requireApiAuth } from "@/lib/auth/api-guard";
import { isDatabaseConfigured, prisma } from "@/lib/db/prisma";
import {
  gradeSimulationAttempt,
  OFFICIAL_RULESETS,
  type RulesetConfig,
  type SimulationGradingItem,
} from "@/features/scoring/engine";
import { logger } from "@/lib/utils/logger";

export const runtime = "nodejs";

export async function POST(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireApiAuth();
  if (!auth.authorized) return auth.response;

  if (!isDatabaseConfigured()) {
    return NextResponse.json(
      {
        error: "DATABASE_NOT_CONFIGURED",
        message: "Configure o Prisma Postgres para finalizar simulados.",
      },
      { status: 503 }
    );
  }

  const { id } = await context.params;

  const attempt = await prisma.simulationAttempt.findUnique({
    where: { id },
    include: {
      responses: true,
      simulation: {
        include: {
          items: {
            orderBy: { position: "asc" },
            include: {
              subject: true,
              examQuestionInstance: {
                include: {
                  answerKeys: {
                    orderBy: { revisionNumber: "desc" },
                    take: 1,
                  },
                },
              },
            },
          },
        },
      },
    },
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

  // Idempotência: caso já tenha sido encerrado, retorna o resultado consolidado
  if (attempt.status === "COMPLETED") {
    return NextResponse.json({
      idempotentReplay: true,
      attempt,
    });
  }

  if (attempt.status !== "IN_PROGRESS") {
    return NextResponse.json(
      {
        error: "INVALID_ATTEMPT_STATE",
        message: `O simulado está com status ${attempt.status} e não pode ser finalizado.`,
      },
      { status: 409 }
    );
  }

  const snapshot = attempt.simulation.rulesetSnapshot as Partial<RulesetConfig>;
  const ruleset: RulesetConfig = {
    code: snapshot.code ?? "VUNESP_STANDARD_5",
    name: snapshot.name ?? OFFICIAL_RULESETS.VUNESP_STANDARD_5!.name,
    questionType:
      snapshot.questionType === "TRUE_FALSE" ? "TRUE_FALSE" : "MULTIPLE_CHOICE",
    correctPoints: Number(snapshot.correctPoints ?? 1.0),
    wrongPoints: Number(snapshot.wrongPoints ?? 0.0),
    blankPoints: Number(snapshot.blankPoints ?? 0.0),
    annulledPolicy: snapshot.annulledPolicy ?? "AWARD_TO_ALL",
    minPassingPercentage: Number(snapshot.minPassingPercentage ?? 50.0),
  };

  const responseByItemId = new Map(
    attempt.responses.map((r) => [r.simulationItemId, r])
  );

  const gradingItems: SimulationGradingItem[] = [];
  for (const item of attempt.simulation.items) {
    const latestKey = item.examQuestionInstance.answerKeys[0];
    if (!latestKey) {
      return NextResponse.json(
        {
          error: "MISSING_OFFICIAL_KEY",
          message: `Questão na posição ${item.position} não possui gabarito oficial cadastrado.`,
        },
        { status: 422 }
      );
    }

    const resp = responseByItemId.get(item.id);
    gradingItems.push({
      simulationItemId: item.id,
      questionId: item.questionId,
      subjectId: item.subjectId ?? "general",
      subjectName: item.subject?.name ?? "Disciplina Geral",
      selectedAnswer: resp?.selectedAnswer ?? null,
      officialKey: {
        id: latestKey.id,
        answerValue: latestKey.answerValue,
        status: latestKey.status,
        revisionNumber: latestKey.revisionNumber,
        isDefinitive: latestKey.isDefinitive,
      },
      isInstanceAnnulled: item.examQuestionInstance.isAnnulled,
      optionMapping:
        (item.examQuestionInstance.optionMapping as Record<
          string,
          string
        > | null) ?? null,
      weight: Number(item.weight),
    });
  }

  const report = gradeSimulationAttempt({
    attemptStatus: attempt.status,
    ruleset,
    items: gradingItems,
  });

  const finishedAttempt = await prisma.$transaction(async (tx) => {
    for (const itemRes of report.itemResults) {
      await tx.simulationResponse.upsert({
        where: {
          simulationAttemptId_simulationItemId: {
            simulationAttemptId: attempt.id,
            simulationItemId: itemRes.simulationItemId,
          },
        },
        update: {
          officialKeyRevisionId: itemRes.officialKeyRevisionId,
          selectedAnswer: itemRes.normalizedSelectedAnswer,
          isBlank: itemRes.isBlank,
          isCorrect: itemRes.isCorrect,
          isAnnulled: itemRes.isAnnulled,
          awardedPoints: itemRes.awardedPoints,
        },
        create: {
          simulationAttemptId: attempt.id,
          simulationItemId: itemRes.simulationItemId,
          officialKeyRevisionId: itemRes.officialKeyRevisionId,
          selectedAnswer: itemRes.normalizedSelectedAnswer,
          isBlank: itemRes.isBlank,
          isCorrect: itemRes.isCorrect,
          isAnnulled: itemRes.isAnnulled,
          awardedPoints: itemRes.awardedPoints,
        },
      });
    }

    return tx.simulationAttempt.update({
      where: { id: attempt.id },
      data: {
        status: "COMPLETED",
        finishedAt: new Date(),
        rawScore: report.rawScore,
        netScore: report.netScore,
        maxScore: report.maxScore,
        percentageScore: report.percentageScore,
        correctCount: report.correctCount,
        wrongCount: report.wrongCount,
        blankCount: report.blankCount,
        annulledCount: report.annulledCount,
        breakdownJson: {
          bySubject: report.bySubject,
          passed: report.passed,
        },
      },
    });
  });

  logger.info("SIMULATION_FINISHED", {
    attemptId: finishedAttempt.id,
    netScore: report.netScore,
    maxScore: report.maxScore,
    percentageScore: report.percentageScore,
  });

  return NextResponse.json({
    attempt: finishedAttempt,
    report,
  });
}
