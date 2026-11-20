import dotenv from "dotenv";
dotenv.config({ path: [".env.local", ".env"] });

import { prisma } from "../../src/lib/db/prisma";
import {
  extractPdfPages,
  parseAnswerKeyText,
  parseExamBookletText,
} from "../../src/features/imports/pdf-parser";
import {
  auditExamCompleteness,
  validateExtractedQuestionItem,
  type ImportItemReviewState,
} from "../../src/features/imports/pipeline";

async function main(): Promise<void> {
  const job = await prisma.importJob.findFirst({
    where: { examEdition: { editionCode: "TJSP-2025-ESCREVENTE" } },
    include: {
      examEdition: true,
      examForm: true,
      examPdfDocument: true,
      answerKeyDocument: true,
    },
    orderBy: { createdAt: "desc" },
  });

  if (!job || !job.answerKeyDocument) {
    throw new Error("ImportJob do TJSP 2025 não encontrado.");
  }

  const [examStored, keyStored] = await Promise.all([
    prisma.storedDocumentFile.findFirst({
      where: {
        OR: [
          ...(job.examPdfDocument.storageKey ? [{ id: job.examPdfDocument.storageKey }] : []),
          { sha256: job.examPdfDocument.sha256 },
        ],
      },
    }),
    prisma.storedDocumentFile.findFirst({
      where: {
        OR: [
          ...(job.answerKeyDocument.storageKey ? [{ id: job.answerKeyDocument.storageKey }] : []),
          { sha256: job.answerKeyDocument.sha256 },
        ],
      },
    }),
  ]);

  if (!examStored || !keyStored) {
    throw new Error("Binários privados dos PDFs do TJSP 2025 não encontrados em StoredDocumentFile.");
  }

  const [examPages, keyPages] = await Promise.all([
    extractPdfPages(Buffer.from(examStored.content)),
    extractPdfPages(Buffer.from(keyStored.content)),
  ]);

  const answerMap = parseAnswerKeyText(
    keyPages.join("\n"),
    "MULTIPLE_CHOICE",
    job.examForm.versionLabel
  );
  const extractedItems = parseExamBookletText({
    pages: examPages,
    answerMap,
    questionType: "MULTIPLE_CHOICE",
  });

  const completeness = auditExamCompleteness({
    expectedCount: job.examEdition.expectedQuestionCount ?? 70,
    items: extractedItems,
  });

  console.info("=== REPROCESSAMENTO TJSP 2025 (SEM DUPLICAR JOB/DOCUMENTOS) ===");
  console.info("Completude:", completeness);

  let structurallyValidCount = 0;
  let visualFlaggedCount = 0;
  let pendingClassCount = 0;
  let withSupportCount = 0;

  // Atualizar/criar cada ImportJobItem de forma idempotente (upsert por importJobId + originalNumber)
  for (const rawItem of extractedItems) {
    const validation = validateExtractedQuestionItem({
      originalNumber: rawItem.originalNumber,
      questionType: "MULTIPLE_CHOICE",
      statement: rawItem.statement,
      supportText: rawItem.supportText,
      options: rawItem.options,
      officialAnswer: rawItem.officialAnswer,
      isAnnulled: rawItem.isAnnulled,
      subjectSlug: rawItem.subjectSlug,
      pageNumber: rawItem.pageNumber,
      sourceDocumentSha256: job.examPdfDocument.sha256,
      examFormVersionLabel: job.examForm.versionLabel,
    });

    if (validation.isValid) structurallyValidCount += 1;
    if (rawItem.hasMissingVisualOrTable) visualFlaggedCount += 1;
    if (rawItem.classificationStatus === "CLASSIFICATION_PENDING") pendingClassCount += 1;
    if (rawItem.supportText) withSupportCount += 1;

    const needsSpecialReview =
      rawItem.classificationStatus === "CLASSIFICATION_PENDING" ||
      rawItem.hasMissingVisualOrTable ||
      !rawItem.officialAnswer;

    const reviewState: ImportItemReviewState = !validation.isValid
      ? "REJECTED"
      : needsSpecialReview
        ? "AWAITING_REVIEW"
        : "STRUCTURALLY_VALID";

    const payloadJson = {
      ...rawItem,
      canonicalHash: validation.canonicalHash,
      reviewState,
      answerKeyVerified: false,
    };

    await prisma.importJobItem.upsert({
      where: {
        importJobId_originalNumber: {
          importJobId: job.id,
          originalNumber: rawItem.originalNumber,
        },
      },
      update: {
        rawExtractedText: rawItem.statement,
        structuredPayloadJson: payloadJson,
        detectedAnswerKey: rawItem.officialAnswer || null,
        validationStatus: validation.isValid ? "PENDING" : "REJECTED",
        validationErrorsJson: validation.issues,
        reviewedAt: null,
      },
      create: {
        importJobId: job.id,
        originalNumber: rawItem.originalNumber,
        rawExtractedText: rawItem.statement,
        structuredPayloadJson: payloadJson,
        detectedAnswerKey: rawItem.officialAnswer || null,
        validationStatus: validation.isValid ? "PENDING" : "REJECTED",
        validationErrorsJson: validation.issues,
      },
    });
  }

  await prisma.importJob.update({
    where: { id: job.id },
    data: {
      status: "AWAITING_REVIEW",
      currentStage: "AWAITING_REVIEW",
      totalDetected: extractedItems.length,
      totalStructured: structurallyValidCount,
      totalValidated: 0,
      totalPublished: 0,
    },
  });

  const owner = await prisma.user.findFirst();
  if (owner) {
    await prisma.contentReviewLog.create({
      data: {
        entityType: "IMPORT_JOB",
        entityId: job.id,
        action: "IMPORT_JOB_REPROCESSED_TWO_COLUMN_FIX",
        previousStatus: job.status,
        newStatus: "AWAITING_REVIEW",
        notes: `Lote TJSP 2025 reprocessado em local sem duplicação: ${extractedItems.length}/70 questões extraídas (${structurallyValidCount} estruturalmente válidas, ${visualFlaggedCount} com figura/tabela/planilha sinalizada, ${pendingClassCount} aguardando classificação manual, ${withSupportCount} com texto de apoio). 0 publicadas automaticamente.`,
        reviewerUserId: owner.id,
      },
    });
  }

  console.info("\n=== RESULTADO FINAL DO REPROCESSAMENTO TJSP 2025 ===", {
    jobId: job.id,
    totalDetected: extractedItems.length,
    totalStructured: structurallyValidCount,
    totalValidated: 0,
    totalPublished: 0,
    visualFlaggedCount,
    pendingClassCount,
    withSupportCount,
  });
}

main()
  .catch((err) => {
    console.error("[ERRO REPROCESSAMENTO]", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
