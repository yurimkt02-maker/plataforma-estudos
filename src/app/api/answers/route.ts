import { NextRequest, NextResponse } from "next/server";
import { requireApiAuth } from "@/lib/auth/api-guard";
import { isDatabaseConfigured, prisma } from "@/lib/db/prisma";
import { submitAnswerSchema } from "@/lib/validations/schemas";
import {
  evaluateSingleAnswer,
  OFFICIAL_RULESETS,
  type RulesetConfig,
} from "@/features/scoring/engine";
import { calculateNextReviewSchedule } from "@/features/review/spaced-repetition";
import { logger } from "@/lib/utils/logger";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const auth = await requireApiAuth();
  if (!auth.authorized) return auth.response;

  if (!isDatabaseConfigured()) {
    return NextResponse.json(
      {
        error: "DATABASE_NOT_CONFIGURED",
        message:
          "Configure DATABASE_URL_POOLED no .env.local para persistir o histórico de respostas no Prisma Postgres.",
      },
      { status: 503 }
    );
  }

  try {
    const body = await request.json();
    const parsed = submitAnswerSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "VALIDATION_ERROR",
          message: parsed.error.issues[0]?.message ?? "Payload inválido.",
          issues: parsed.error.issues,
        },
        { status: 400 }
      );
    }

    const {
      questionId,
      examQuestionInstanceId,
      selectedAnswer,
      timeSpentSeconds,
      studySessionId,
      declaredDifficulty,
      idempotencyKey,
    } = parsed.data;

    // Verificar idempotência para evitar duplicação em reenvios de rede
    if (idempotencyKey) {
      const existingAttempt = await prisma.questionAttempt.findUnique({
        where: { idempotencyKey },
        include: { officialKeyRevision: true },
      });
      if (existingAttempt) {
        return NextResponse.json({
          idempotentReplay: true,
          attempt: existingAttempt,
        });
      }
    }

    const instance = await prisma.examQuestionInstance.findUnique({
      where: { id: examQuestionInstanceId },
      include: {
        answerKeys: {
          orderBy: { revisionNumber: "desc" },
          take: 1,
        },
        examForm: {
          include: {
            examEdition: {
              include: {
                ruleset: true,
              },
            },
          },
        },
      },
    });

    if (!instance || instance.questionId !== questionId) {
      return NextResponse.json(
        {
          error: "INSTANCE_NOT_FOUND",
          message:
            "Instância de prova/caderno não encontrada para a questão informada.",
        },
        { status: 404 }
      );
    }

    const latestKey = instance.answerKeys[0];
    if (!latestKey) {
      return NextResponse.json(
        {
          error: "OFFICIAL_KEY_MISSING",
          message:
            "Esta questão não possui gabarito oficial cadastrado. O sistema não utiliza gabaritos não verificados.",
        },
        { status: 422 }
      );
    }

    const dbRuleset = instance.examForm.examEdition.ruleset;
    const rulesetConfig: RulesetConfig = {
      code: dbRuleset.code,
      name: dbRuleset.name,
      questionType:
        dbRuleset.questionType === "TRUE_FALSE"
          ? "TRUE_FALSE"
          : "MULTIPLE_CHOICE",
      correctPoints: Number(dbRuleset.correctPoints),
      wrongPoints: Number(dbRuleset.wrongPoints),
      blankPoints: Number(dbRuleset.blankPoints),
      annulledPolicy: dbRuleset.annulledPolicy,
      minPassingPercentage: Number(dbRuleset.minPassingPercentage),
    };

    const evaluation = evaluateSingleAnswer({
      selectedAnswer,
      officialKey: {
        id: latestKey.id,
        answerValue: latestKey.answerValue,
        status: latestKey.status,
        revisionNumber: latestKey.revisionNumber,
        isDefinitive: latestKey.isDefinitive,
      },
      ruleset: rulesetConfig ?? OFFICIAL_RULESETS.VUNESP_STANDARD_5!,
      isInstanceAnnulled: instance.isAnnulled,
      optionMapping:
        (instance.optionMapping as Record<string, string> | null) ?? null,
      mode: "STUDY_FREE",
    });

    const previousAttemptCount = await prisma.questionAttempt.count({
      where: {
        userId: auth.user.id,
        questionId,
      },
    });

    const existingReview = await prisma.reviewQueue.findUnique({
      where: {
        userId_questionId: {
          userId: auth.user.id,
          questionId,
        },
      },
    });

    const nextSchedule = calculateNextReviewSchedule({
      isCorrect: evaluation.isCorrect,
      previousIntervalDays: existingReview?.intervalDays ?? 1,
      previousEaseFactor: Number(existingReview?.easeFactor ?? 2.5),
      previousConsecutiveCorrect: existingReview?.consecutiveCorrect ?? 0,
      previousErrorCount: existingReview?.errorCount ?? 0,
      declaredDifficulty,
    });

    const createdAttempt = await prisma.$transaction(async (tx) => {
      const attempt = await tx.questionAttempt.create({
        data: {
          userId: auth.user.id,
          questionId,
          examQuestionInstanceId,
          studySessionId: studySessionId ?? null,
          officialKeyRevisionId: evaluation.officialKeyRevisionId,
          selectedAnswer: evaluation.normalizedSelectedAnswer,
          isBlank: evaluation.isBlank,
          isCorrect: evaluation.isCorrect,
          awardedPoints: evaluation.awardedPoints,
          timeSpentSeconds,
          attemptNumber: previousAttemptCount + 1,
          idempotencyKey: idempotencyKey ?? null,
        },
      });

      // Se a resposta foi incorreta ou já estava na fila de revisão, atualiza a fila de revisão espaçada
      if (!evaluation.isCorrect || existingReview) {
        await tx.reviewQueue.upsert({
          where: {
            userId_questionId: {
              userId: auth.user.id,
              questionId,
            },
          },
          update: {
            examQuestionInstanceId,
            status: nextSchedule.status,
            priority: nextSchedule.priority,
            intervalDays: nextSchedule.intervalDays,
            easeFactor: nextSchedule.easeFactor,
            consecutiveCorrect: nextSchedule.consecutiveCorrect,
            errorCount: nextSchedule.errorCount,
            declaredDifficulty: declaredDifficulty ?? undefined,
            lastReviewedAt: new Date(),
            nextReviewAt: nextSchedule.nextReviewAt,
          },
          create: {
            userId: auth.user.id,
            questionId,
            examQuestionInstanceId,
            status: nextSchedule.status,
            priority: nextSchedule.priority,
            intervalDays: nextSchedule.intervalDays,
            easeFactor: nextSchedule.easeFactor,
            consecutiveCorrect: nextSchedule.consecutiveCorrect,
            errorCount: nextSchedule.errorCount,
            declaredDifficulty: declaredDifficulty ?? null,
            lastReviewedAt: new Date(),
            nextReviewAt: nextSchedule.nextReviewAt,
          },
        });
      }

      // Alimenta o Caderno Automático de Erros quando o usuário erra a questão
      if (!evaluation.isCorrect && !evaluation.isAnnulled) {
        let autoNotebook = await tx.notebook.findFirst({
          where: {
            userId: auth.user.id,
            isSystemAutoErrors: true,
          },
        });

        if (!autoNotebook) {
          autoNotebook = await tx.notebook.create({
            data: {
              userId: auth.user.id,
              name: "Caderno Automático de Erros",
              description:
                "Alimentado automaticamente pelas questões respondidas incorretamente.",
              notebookType: "AUTO_ERRORS",
              isSystemAutoErrors: true,
              colorHex: "#D65A53",
            },
          });
        }

        await tx.notebookQuestion.upsert({
          where: {
            notebookId_questionId: {
              notebookId: autoNotebook.id,
              questionId,
            },
          },
          update: {
            examQuestionInstanceId,
            addedReason: `Resposta incorreta (${evaluation.normalizedSelectedAnswer ?? "Em branco"} vs Gabarito Oficial ${evaluation.resolvedOfficialAnswer})`,
          },
          create: {
            notebookId: autoNotebook.id,
            questionId,
            examQuestionInstanceId,
            addedReason: `Resposta incorreta (${evaluation.normalizedSelectedAnswer ?? "Em branco"} vs Gabarito Oficial ${evaluation.resolvedOfficialAnswer})`,
          },
        });
      }

      return attempt;
    });

    logger.info("ANSWER_SUBMITTED", {
      userId: auth.user.id,
      questionId,
      isCorrect: evaluation.isCorrect,
      attemptNumber: createdAttempt.attemptNumber,
    });

    return NextResponse.json({
      attempt: createdAttempt,
      evaluation,
      nextReview: {
        intervalDays: nextSchedule.intervalDays,
        nextReviewAt: nextSchedule.nextReviewAt.toISOString(),
        status: nextSchedule.status,
      },
    });
  } catch (error) {
    logger.error("SUBMIT_ANSWER_ERROR", error);
    return NextResponse.json(
      {
        error: "INTERNAL_ERROR",
        message: "Erro ao registrar e corrigir resposta no servidor.",
      },
      { status: 500 }
    );
  }
}
