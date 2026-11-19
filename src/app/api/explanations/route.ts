import { NextRequest, NextResponse } from "next/server";
import { requireApiAuth } from "@/lib/auth/api-guard";
import { isDatabaseConfigured, prisma } from "@/lib/db/prisma";
import { explanationRequestSchema } from "@/lib/validations/schemas";
import { generateAuditedLegalExplanation } from "@/lib/ai/explainer";
import { computeExplanationSnapshotHash } from "@/features/legal-knowledge/validator";
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
          "Configure o Prisma Postgres para consultar e persistir comentários jurídicos auditados.",
      },
      { status: 503 }
    );
  }

  try {
    const body = await request.json();
    const parsed = explanationRequestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "VALIDATION_ERROR",
          message: "Parâmetros inválidos para geração de explicação.",
          issues: parsed.error.issues,
        },
        { status: 400 }
      );
    }

    const { questionId, examQuestionInstanceId, command, userSelectedAnswer } =
      parsed.data;

    const question = await prisma.question.findUnique({
      where: { id: questionId },
      include: {
        options: { orderBy: { displayOrder: "asc" } },
        subjects: { include: { subject: true } },
        examInstances: {
          where: examQuestionInstanceId
            ? { id: examQuestionInstanceId }
            : undefined,
          include: {
            answerKeys: {
              orderBy: { revisionNumber: "desc" },
              take: 1,
            },
            examForm: {
              include: {
                examEdition: true,
              },
            },
          },
        },
      },
    });

    if (!question) {
      return NextResponse.json(
        { error: "NOT_FOUND", message: "Questão não encontrada." },
        { status: 404 }
      );
    }

    const instance = question.examInstances[0];
    const latestKey = instance?.answerKeys[0];

    if (!instance || !latestKey) {
      return NextResponse.json(
        {
          error: "OFFICIAL_KEY_MISSING",
          message:
            "Não é possível gerar comentário sem gabarito oficial definitivo associado à prova.",
        },
        { status: 422 }
      );
    }

    const legalSources = await prisma.legalSource.findMany({
      where: { verificationStatus: "VERIFIED" },
      include: { passages: true },
      take: 10,
    });

    const passageHashes = legalSources.flatMap((s) =>
      s.passages.map((p) => p.textHash)
    );
    const expectedSnapshotHash = computeExplanationSnapshotHash({
      questionId: question.id,
      officialKeyRevisionId: latestKey.id,
      passageHashes: passageHashes.length > 0 ? [passageHashes[0]!] : ["NO_SOURCES"],
    });

    // Otimização de custos e cache (Seção 9.7 e 11.4): reutiliza explicação já verificada se o hash coincidir
    if (command === "FULL_EXPLANATION") {
      const cached = await prisma.questionExplanation.findUnique({
        where: {
          questionId_officialKeyRevisionId_sourceSnapshotHash: {
            questionId: question.id,
            officialKeyRevisionId: latestKey.id,
            sourceSnapshotHash: expectedSnapshotHash,
          },
        },
        include: {
          citations: {
            include: {
              legalSource: true,
              legalPassage: true,
            },
          },
        },
      });

      if (cached) {
        return NextResponse.json({
          cached: true,
          explanation: cached,
        });
      }
    }

    const primarySubject =
      question.subjects.find((s) => s.isPrimary)?.subject ??
      question.subjects[0]?.subject;

    const generated = await generateAuditedLegalExplanation({
      questionId: question.id,
      officialKeyRevisionId: latestKey.id,
      statement: question.statement,
      options: question.options.map((o) => ({
        label: o.label,
        content: o.content,
      })),
      officialAnswerValue: latestKey.answerValue,
      subjectName: primarySubject?.name ?? "Direito",
      examTitle: instance.examForm.examEdition.title,
      examDate: instance.examForm.examEdition.examDate,
      command,
      userSelectedAnswer,
      retrievedSources: legalSources,
    });

    if (command === "FULL_EXPLANATION") {
      const saved = await prisma.questionExplanation.upsert({
        where: {
          questionId_officialKeyRevisionId_sourceSnapshotHash: {
            questionId: question.id,
            officialKeyRevisionId: latestKey.id,
            sourceSnapshotHash: generated.validation.sourceSnapshotHash,
          },
        },
        update: {
          status: generated.validation.status,
          summary: generated.summary,
          correctOptionAnalysis: generated.correctOptionAnalysis,
          wrongOptionsAnalysisJson: generated.wrongOptionsAnalysis,
          historicalUnderstanding: generated.historicalUnderstanding,
          currentUnderstanding: generated.currentUnderstanding,
          hasDivergenceOrUpdate: generated.validation.hasDivergenceOrUpdate,
          divergenceNote: generated.validation.divergenceNote,
          lastCheckedAt: new Date(),
          verifiedAt:
            generated.validation.status === "VERIFIED" ? new Date() : null,
        },
        create: {
          questionId: question.id,
          officialKeyRevisionId: latestKey.id,
          status: generated.validation.status,
          summary: generated.summary,
          correctOptionAnalysis: generated.correctOptionAnalysis,
          wrongOptionsAnalysisJson: generated.wrongOptionsAnalysis,
          historicalUnderstanding: generated.historicalUnderstanding,
          currentUnderstanding: generated.currentUnderstanding,
          hasDivergenceOrUpdate: generated.validation.hasDivergenceOrUpdate,
          divergenceNote: generated.validation.divergenceNote,
          modelId: generated.modelId,
          sourceSnapshotHash: generated.validation.sourceSnapshotHash,
          verifiedAt:
            generated.validation.status === "VERIFIED" ? new Date() : null,
          citations: {
            create: generated.citations.map((c) => ({
              legalSourceId: c.legalSourceId,
              legalPassageId: c.legalPassageId ?? null,
              claimReference: c.claimReference,
              quotedSnippet: c.quotedSnippet ?? null,
            })),
          },
        },
      });

      return NextResponse.json({
        cached: false,
        explanation: saved,
        generated,
      });
    }

    return NextResponse.json({
      cached: false,
      generated,
    });
  } catch (error) {
    logger.error("GENERATE_EXPLANATION_ERROR", error);
    return NextResponse.json(
      {
        error: "INTERNAL_ERROR",
        message: "Erro ao processar explicação jurídica.",
      },
      { status: 500 }
    );
  }
}
