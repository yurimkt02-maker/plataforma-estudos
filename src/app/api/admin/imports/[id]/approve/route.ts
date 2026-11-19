import { NextRequest, NextResponse } from "next/server";
import { requireApiAdmin } from "@/lib/auth/api-guard";
import { isDatabaseConfigured, prisma } from "@/lib/db/prisma";
import { logger } from "@/lib/utils/logger";

export const runtime = "nodejs";

type StructuredItemPayload = {
  originalNumber: number;
  questionType: "MULTIPLE_CHOICE" | "TRUE_FALSE";
  statement: string;
  supportText?: string;
  instruction?: string;
  options: Array<{ label: string; content: string }>;
  officialAnswer: string;
  isAnnulled?: boolean;
  subjectSlug: string;
  pageNumber?: number;
  canonicalHash: string;
};

export async function POST(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireApiAdmin();
  if (!auth.authorized) return auth.response;

  if (!isDatabaseConfigured()) {
    return NextResponse.json(
      {
        error: "DATABASE_NOT_CONFIGURED",
        message: "Configure o Prisma Postgres para aprovar e publicar importações.",
      },
      { status: 503 }
    );
  }

  const { id } = await context.params;
  const job = await prisma.importJob.findUnique({
    where: { id },
    include: {
      items: { orderBy: { originalNumber: "asc" } },
    },
  });

  if (!job) {
    return NextResponse.json(
      { error: "NOT_FOUND", message: "Job de importação não encontrado." },
      { status: 404 }
    );
  }

  if (job.status === "PUBLISHED") {
    return NextResponse.json({
      idempotentReplay: true,
      job,
    });
  }

  const validItems = job.items.filter((i) => i.validationStatus === "VERIFIED");
  if (validItems.length === 0) {
    return NextResponse.json(
      {
        error: "NO_VALID_ITEMS",
        message:
          "Nenhum item deste job passou na validação de integridade documental (Seção 9.5). Corrija os itens antes de publicar.",
      },
      { status: 422 }
    );
  }

  const publishedJob = await prisma.$transaction(async (tx) => {
    let publishedCount = 0;

    for (const item of validItems) {
      const payload = item.structuredPayloadJson as unknown as StructuredItemPayload;

      // Deduplicação por canonicalHash: reutiliza a Question se já existir em outra versão de caderno
      let question = await tx.question.findUnique({
        where: { canonicalHash: payload.canonicalHash },
      });

      if (!question) {
        question = await tx.question.create({
          data: {
            questionType: payload.questionType,
            statement: payload.statement,
            supportText: payload.supportText ?? null,
            instruction: payload.instruction ?? null,
            status: "PUBLISHED",
            difficulty: "MEDIUM",
            canonicalHash: payload.canonicalHash,
            validatedAt: new Date(),
            publishedAt: new Date(),
            options: {
              create: payload.options.map((opt, index) => ({
                label: opt.label.trim().toUpperCase(),
                content: opt.content.trim(),
                displayOrder: index + 1,
              })),
            },
          },
        });
      }

      // Vincula ao documento de origem oficial com número de página
      await tx.questionSource.upsert({
        where: {
          questionId_sourceDocumentId: {
            questionId: question.id,
            sourceDocumentId: job.examPdfDocumentId,
          },
        },
        update: {
          pageNumber: payload.pageNumber ?? null,
          sourceReference: `Questão ${payload.originalNumber}`,
        },
        create: {
          questionId: question.id,
          sourceDocumentId: job.examPdfDocumentId,
          pageNumber: payload.pageNumber ?? null,
          sourceReference: `Questão ${payload.originalNumber}`,
        },
      });

      // Vincula à disciplina/assunto
      const subject = await tx.subject.findUnique({
        where: { slug: payload.subjectSlug },
      });

      if (subject) {
        await tx.questionSubject.upsert({
          where: {
            questionId_subjectId: {
              questionId: question.id,
              subjectId: subject.id,
            },
          },
          update: { isPrimary: true },
          create: {
            questionId: question.id,
            subjectId: subject.id,
            isPrimary: true,
          },
        });
      }

      // Registra a instância na versão específica do caderno (ExamForm)
      const instance = await tx.examQuestionInstance.upsert({
        where: {
          examFormId_originalNumber: {
            examFormId: job.examFormId,
            originalNumber: payload.originalNumber,
          },
        },
        update: {
          questionId: question.id,
          isAnnulled: Boolean(payload.isAnnulled),
        },
        create: {
          examFormId: job.examFormId,
          questionId: question.id,
          originalNumber: payload.originalNumber,
          displayOrder: payload.originalNumber,
          isAnnulled: Boolean(payload.isAnnulled),
        },
      });

      // Cria a revisão oficial do gabarito sem sobrescrever histórico
      const existingKeysCount = await tx.officialAnswerKey.count({
        where: { examQuestionInstanceId: instance.id },
      });

      await tx.officialAnswerKey.create({
        data: {
          examQuestionInstanceId: instance.id,
          sourceDocumentId: job.answerKeyDocumentId ?? job.examPdfDocumentId,
          answerValue: payload.officialAnswer.trim().toUpperCase(),
          status: payload.isAnnulled ? "ANNULLED" : "DEFINITIVE",
          revisionNumber: existingKeysCount + 1,
          isDefinitive: true,
        },
      });

      await tx.importJobItem.update({
        where: { id: item.id },
        data: {
          questionId: question.id,
          reviewedAt: new Date(),
        },
      });

      publishedCount += 1;
    }

    const updated = await tx.importJob.update({
      where: { id: job.id },
      data: {
        status: "PUBLISHED",
        currentStage: "PUBLISHED",
        totalPublished: publishedCount,
        finishedAt: new Date(),
      },
    });

    await tx.contentReviewLog.create({
      data: {
        entityType: "IMPORT_JOB",
        entityId: job.id,
        action: "IMPORT_JOB_APPROVED_AND_PUBLISHED",
        previousStatus: job.status,
        newStatus: "PUBLISHED",
        notes: `${publishedCount} questões oficiais validadas e publicadas no acervo.`,
        reviewerUserId: auth.user.id,
      },
    });

    return updated;
  });

  logger.info("IMPORT_JOB_PUBLISHED", {
    jobId: publishedJob.id,
    totalPublished: publishedJob.totalPublished,
  });

  return NextResponse.json({
    published: true,
    job: publishedJob,
  });
}
