import { NextRequest, NextResponse } from "next/server";
import { requireApiAdmin } from "@/lib/auth/api-guard";
import { isDatabaseConfigured, prisma } from "@/lib/db/prisma";
import { createImportJobSchema } from "@/lib/validations/schemas";
import { validateExtractedQuestionItem } from "@/features/imports/pipeline";
import { logger } from "@/lib/utils/logger";

export const runtime = "nodejs";

export async function GET() {
  const auth = await requireApiAdmin();
  if (!auth.authorized) return auth.response;

  if (!isDatabaseConfigured()) {
    return NextResponse.json({
      dbConnected: false,
      jobs: [],
    });
  }

  const jobs = await prisma.importJob.findMany({
    include: {
      examEdition: {
        include: {
          examBoard: true,
          position: { include: { studyTrack: true } },
        },
      },
      examForm: true,
      examPdfDocument: true,
      answerKeyDocument: true,
      items: {
        orderBy: { originalNumber: "asc" },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({
    dbConnected: true,
    jobs,
  });
}

export async function POST(request: NextRequest) {
  const auth = await requireApiAdmin();
  if (!auth.authorized) return auth.response;

  if (!isDatabaseConfigured()) {
    return NextResponse.json(
      {
        error: "DATABASE_NOT_CONFIGURED",
        message: "Configure o Prisma Postgres para registrar jobs de importação.",
      },
      { status: 503 }
    );
  }

  try {
    const body = await request.json();
    const parsed = createImportJobSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "VALIDATION_ERROR",
          message:
            parsed.error.issues[0]?.message ?? "Payload de importação inválido.",
          issues: parsed.error.issues,
        },
        { status: 400 }
      );
    }

    const data = parsed.data;

    // Idempotência: permite retomar uma importação interrompida sem duplicar registros (Seção 7.3 e 9.4)
    const existingJob = await prisma.importJob.findUnique({
      where: { idempotencyKey: data.idempotencyKey },
      include: { items: true },
    });

    if (existingJob) {
      return NextResponse.json({
        idempotentReplay: true,
        job: existingJob,
      });
    }

    const examForm = await prisma.examForm.findUnique({
      where: { id: data.examFormId },
    });

    if (!examForm || examForm.examEditionId !== data.examEditionId) {
      return NextResponse.json(
        {
          error: "EXAM_FORM_MISMATCH",
          message:
            "A versão do caderno informada não pertence à edição de prova selecionada.",
        },
        { status: 422 }
      );
    }

    const job = await prisma.$transaction(async (tx) => {
      const examDoc = await tx.sourceDocument.upsert({
        where: { sha256: data.examPdfSha256.toLowerCase() },
        update: {
          title: data.examPdfTitle,
          officialUrl: data.examPdfOfficialUrl,
        },
        create: {
          examEditionId: data.examEditionId,
          examFormId: data.examFormId,
          documentType: "EXAM_BOOKLET",
          title: data.examPdfTitle,
          officialUrl: data.examPdfOfficialUrl,
          sha256: data.examPdfSha256.toLowerCase(),
          versionLabel: examForm.versionLabel,
          rightsNotes: data.rightsNotes ?? null,
          verificationStatus: "VERIFIED",
        },
      });

      const keyDoc = await tx.sourceDocument.upsert({
        where: { sha256: data.answerKeySha256.toLowerCase() },
        update: {
          officialUrl: data.answerKeyOfficialUrl,
        },
        create: {
          examEditionId: data.examEditionId,
          examFormId: data.examFormId,
          documentType: "OFFICIAL_ANSWER_KEY",
          title: `Gabarito Oficial Definitivo — ${data.examPdfTitle}`,
          officialUrl: data.answerKeyOfficialUrl,
          sha256: data.answerKeySha256.toLowerCase(),
          versionLabel: examForm.versionLabel,
          rightsNotes: data.rightsNotes ?? null,
          verificationStatus: "VERIFIED",
        },
      });

      let validCount = 0;
      const itemsToCreate = data.extractedItems.map((rawItem) => {
        const validation = validateExtractedQuestionItem({
          originalNumber: rawItem.originalNumber,
          questionType: rawItem.questionType,
          statement: rawItem.statement,
          supportText: rawItem.supportText,
          instruction: rawItem.instruction,
          options: rawItem.options,
          officialAnswer: rawItem.officialAnswer,
          isAnnulled: rawItem.isAnnulled,
          subjectSlug: rawItem.subjectSlug,
          pageNumber: rawItem.pageNumber,
          sourceDocumentSha256: data.examPdfSha256,
          examFormVersionLabel: examForm.versionLabel,
        });

        if (validation.isValid) validCount += 1;

        return {
          originalNumber: rawItem.originalNumber,
          rawExtractedText: rawItem.statement,
          structuredPayloadJson: {
            ...rawItem,
            canonicalHash: validation.canonicalHash,
          },
          detectedAnswerKey: rawItem.officialAnswer,
          validationStatus: validation.isValid
            ? ("VERIFIED" as const)
            : ("REJECTED" as const),
          validationErrorsJson: validation.issues,
        };
      });

      const createdJob = await tx.importJob.create({
        data: {
          examEditionId: data.examEditionId,
          examFormId: data.examFormId,
          examPdfDocumentId: examDoc.id,
          answerKeyDocumentId: keyDoc.id,
          status: "AWAITING_REVIEW",
          currentStage: "AWAITING_REVIEW",
          totalDetected: data.extractedItems.length,
          totalStructured: data.extractedItems.length,
          totalValidated: validCount,
          idempotencyKey: data.idempotencyKey,
          startedAt: new Date(),
          items: {
            create: itemsToCreate,
          },
        },
        include: { items: true },
      });

      await tx.contentReviewLog.create({
        data: {
          entityType: "IMPORT_JOB",
          entityId: createdJob.id,
          action: "IMPORT_JOB_REGISTERED",
          previousStatus: "PENDING",
          newStatus: "AWAITING_REVIEW",
          notes: `Job criado com ${data.extractedItems.length} itens extraídos (${validCount} válidos para curadoria).`,
          reviewerUserId: auth.user.id,
        },
      });

      return createdJob;
    });

    logger.info("IMPORT_JOB_CREATED", {
      jobId: job.id,
      totalDetected: job.totalDetected,
      totalValidated: job.totalValidated,
    });

    return NextResponse.json({ job }, { status: 201 });
  } catch (error) {
    logger.error("CREATE_IMPORT_JOB_ERROR", error);
    return NextResponse.json(
      {
        error: "INTERNAL_ERROR",
        message: "Erro ao processar registro de importação.",
      },
      { status: 500 }
    );
  }
}
