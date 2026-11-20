import { NextRequest, NextResponse } from "next/server";
import { requireApiAdmin } from "@/lib/auth/api-guard";
import { isDatabaseConfigured, prisma } from "@/lib/db/prisma";
import {
  evaluateItemPublishEligibility,
  resolveExpectedQuestionCount,
  type ImportItemReviewState,
} from "@/features/imports/pipeline";
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
  classificationStatus?: "CLASSIFIED" | "CLASSIFICATION_PENDING";
  hasMissingVisualOrTable?: boolean;
  answerKeyVerified?: boolean;
  reviewState?: ImportItemReviewState;
  pageNumber?: number;
  assets?: Array<{
    url: string;
    caption?: string | null;
    assetType?: string;
    sha256?: string | null;
  }>;
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
      examEdition: {
        include: {
          position: { include: { studyTrack: { select: { code: true } } } },
          ruleset: { select: { passingRulesJson: true } },
        },
      },
      examForm: true,
      examPdfDocument: true,
      answerKeyDocument: true,
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

  const examDocStatus = job.examPdfDocument.verificationStatus;
  const keyDocStatus = job.answerKeyDocument?.verificationStatus ?? "PENDING";

  if (examDocStatus !== "VERIFIED" || keyDocStatus !== "VERIFIED") {
    return NextResponse.json(
      {
        error: "DOCUMENTS_NOT_VERIFIED",
        message:
          "Confirme primeiro os documentos oficiais (edição, data de aplicação, versão do caderno e integridade do gabarito definitivo) antes de publicar qualquer questão.",
      },
      { status: 422 }
    );
  }

  const eligibleItems: typeof job.items = [];
  const blockedItems: Array<{ originalNumber: number; reasons: string[] }> = [];

  for (const item of job.items) {
    const payload =
      (item.structuredPayloadJson as unknown as StructuredItemPayload) ?? {};
    const check = evaluateItemPublishEligibility({
      originalNumber: item.originalNumber,
      questionType: payload.questionType ?? "MULTIPLE_CHOICE",
      statement: payload.statement ?? "",
      options: payload.options ?? [],
      officialAnswer: payload.officialAnswer ?? item.detectedAnswerKey ?? "",
      isAnnulled: payload.isAnnulled,
      subjectSlug: payload.subjectSlug ?? "",
      classificationStatus: payload.classificationStatus,
      hasMissingVisualOrTable: payload.hasMissingVisualOrTable,
      answerKeyVerified: payload.answerKeyVerified,
      reviewState: payload.reviewState,
      validationStatus: item.validationStatus,
      reviewedAt: item.reviewedAt,
      examDocVerificationStatus: examDocStatus,
      answerKeyDocVerificationStatus: keyDocStatus,
    });

    if (check.eligible) {
      eligibleItems.push(item);
    } else {
      blockedItems.push({
        originalNumber: item.originalNumber,
        reasons: check.blockingReasons,
      });
    }
  }

  if (eligibleItems.length === 0) {
    return NextResponse.json(
      {
        error: "NO_VERIFIED_ITEMS",
        message:
          "Nenhum item deste lote foi explicitamente verificado e aprovado por um revisor humano (estado VERIFIED com disciplina, visual e gabarito conferidos).",
        blockedItems: blockedItems.slice(0, 10),
      },
      { status: 422 }
    );
  }

  const publishedAt = new Date();

  const publishedJob = await prisma.$transaction(async (tx) => {
    let publishedCount = 0;

    for (const item of eligibleItems) {
      const payload = item.structuredPayloadJson as unknown as StructuredItemPayload;

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
            validatedAt: publishedAt,
            publishedAt,
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

      if (Array.isArray(payload.assets) && payload.assets.length > 0) {
        const existingAssets = await tx.questionAsset.findMany({
          where: { questionId: question.id },
          select: { storagePath: true },
        });
        const existingPaths = new Set(existingAssets.map((a) => a.storagePath));
        for (let idx = 0; idx < payload.assets.length; idx++) {
          const asset = payload.assets[idx]!;
          if (!asset.url || existingPaths.has(asset.url)) continue;
          await tx.questionAsset.create({
            data: {
              questionId: question.id,
              assetType: asset.assetType || "IMAGE",
              storagePath: asset.url,
              objectUrl: asset.url,
              sha256: asset.sha256 ?? null,
              caption: asset.caption ?? null,
              position: idx,
            },
          });
        }
      }

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
        data: { questionId: question.id },
      });

      publishedCount += 1;
    }

    const expectedCount = resolveExpectedQuestionCount({
      formExpectedCount: job.examForm.expectedQuestionCount,
      editionExpectedCount: job.examEdition.expectedQuestionCount,
      rulesetPassingRules: job.examEdition.ruleset.passingRulesJson,
      trackCode: job.examEdition.position.studyTrack.code,
    });
    const isCompleteExtraction =
      job.totalDetected >= expectedCount && blockedItems.length === 0;
    const updated = await tx.importJob.update({
      where: { id: job.id },
      data: {
        status: isCompleteExtraction ? "PUBLISHED" : "AWAITING_REVIEW",
        currentStage: isCompleteExtraction ? "PUBLISHED" : "AWAITING_REVIEW",
        totalPublished: publishedCount,
        finishedAt: isCompleteExtraction ? publishedAt : null,
      },
    });

    await tx.contentReviewLog.create({
      data: {
        entityType: "IMPORT_JOB",
        entityId: job.id,
        action: "IMPORT_JOB_PUBLISHED_VERIFIED_ONLY",
        previousStatus: job.status,
        newStatus: updated.status,
        notes: `${publishedCount} questão(ões) verificadas publicadas por ${auth.user.name} (${auth.user.email}) em ${publishedAt.toISOString()}. ${blockedItems.length} item(ns) mantido(s) fora da publicação por pendências.`,
        metadataJson: {
          approvedByUserId: auth.user.id,
          approvedByEmail: auth.user.email,
          approvedAt: publishedAt.toISOString(),
          publishedCount,
          blockedCount: blockedItems.length,
        },
        reviewerUserId: auth.user.id,
      },
    });

    return updated;
  });

  logger.info("IMPORT_JOB_PUBLISHED", {
    jobId: publishedJob.id,
    totalPublished: publishedJob.totalPublished,
    blockedCount: blockedItems.length,
  });

  return NextResponse.json({
    published: true,
    publishedCount: publishedJob.totalPublished,
    blockedCount: blockedItems.length,
    blockedItems,
    job: publishedJob,
  });
}
