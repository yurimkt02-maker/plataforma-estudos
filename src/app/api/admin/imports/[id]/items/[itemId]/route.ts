import { NextRequest, NextResponse } from "next/server";
import { requireApiAdmin } from "@/lib/auth/api-guard";
import { isDatabaseConfigured, prisma } from "@/lib/db/prisma";
import {
  computeQuestionCanonicalHash,
  validateExtractedQuestionItem,
  type ImportItemReviewState,
} from "@/features/imports/pipeline";
import { CLASSIFICATION_PENDING_SLUG } from "@/features/imports/pdf-parser";

export const runtime = "nodejs";

type StoredItemPayload = {
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
  visualWarning?: string | null;
  answerKeyVerified?: boolean;
  reviewState?: ImportItemReviewState;
  reviewedByUserId?: string;
  reviewedByName?: string;
  reviewNotes?: string | null;
  pageNumber?: number;
  canonicalHash?: string;
};

/**
 * Curadoria individual de item importado:
 * - EDIT: corrige enunciado, texto de apoio, alternativas, numeração, gabarito, disciplina ou flags
 * - APPROVE: promove explicitamente para VERIFIED somente se disciplina, visual e gabarito estiverem conferidos
 * - REJECT: marca o item como REJECTED impedindo publicação
 */
export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string; itemId: string }> }
) {
  const auth = await requireApiAdmin();
  if (!auth.authorized) return auth.response;

  if (!isDatabaseConfigured()) {
    return NextResponse.json(
      { error: "DATABASE_NOT_CONFIGURED" },
      { status: 503 }
    );
  }

  const { id: jobId, itemId } = await context.params;
  const body = (await request.json().catch(() => ({}))) as {
    action: "EDIT" | "APPROVE" | "REJECT";
    originalNumber?: number;
    statement?: string;
    supportText?: string | null;
    options?: Array<{ label: string; content: string }>;
    officialAnswer?: string;
    isAnnulled?: boolean;
    subjectSlug?: string;
    hasMissingVisualOrTable?: boolean;
    answerKeyVerified?: boolean;
    pageNumber?: number;
    reviewNotes?: string;
  };

  const job = await prisma.importJob.findUnique({
    where: { id: jobId },
    include: {
      examForm: true,
      examPdfDocument: true,
    },
  });

  if (!job) {
    return NextResponse.json(
      { error: "NOT_FOUND", message: "Job de importação não encontrado." },
      { status: 404 }
    );
  }

  const existing = await prisma.importJobItem.findFirst({
    where: { id: itemId, importJobId: jobId },
  });

  if (!existing) {
    return NextResponse.json(
      { error: "NOT_FOUND", message: "Item de importação não encontrado." },
      { status: 404 }
    );
  }

  const currentPayload =
    (existing.structuredPayloadJson as unknown as StoredItemPayload) ?? {};

  const nextOriginalNumber =
    typeof body.originalNumber === "number" && body.originalNumber > 0
      ? body.originalNumber
      : existing.originalNumber;
  const nextStatement =
    typeof body.statement === "string"
      ? body.statement.trim()
      : currentPayload.statement ?? "";
  const nextSupportText =
    body.supportText !== undefined
      ? body.supportText?.trim() || undefined
      : currentPayload.supportText;
  const nextOptions = Array.isArray(body.options)
    ? body.options
    : currentPayload.options ?? [];
  const nextOfficialAnswer =
    typeof body.officialAnswer === "string"
      ? body.officialAnswer.trim().toUpperCase()
      : currentPayload.officialAnswer ?? "";
  const nextIsAnnulled =
    body.isAnnulled !== undefined
      ? Boolean(body.isAnnulled)
      : Boolean(currentPayload.isAnnulled) || nextOfficialAnswer === "ANULADA";
  const nextSubjectSlug =
    typeof body.subjectSlug === "string"
      ? body.subjectSlug.trim()
      : currentPayload.subjectSlug ?? CLASSIFICATION_PENDING_SLUG;
  const nextClassificationStatus: "CLASSIFIED" | "CLASSIFICATION_PENDING" =
    !nextSubjectSlug || nextSubjectSlug === CLASSIFICATION_PENDING_SLUG
      ? "CLASSIFICATION_PENDING"
      : "CLASSIFIED";
  const nextHasMissingVisual =
    body.hasMissingVisualOrTable !== undefined
      ? Boolean(body.hasMissingVisualOrTable)
      : Boolean(currentPayload.hasMissingVisualOrTable);
  const nextAnswerKeyVerified =
    body.answerKeyVerified !== undefined
      ? Boolean(body.answerKeyVerified)
      : Boolean(currentPayload.answerKeyVerified);
  const nextPageNumber =
    typeof body.pageNumber === "number" && body.pageNumber > 0
      ? body.pageNumber
      : currentPayload.pageNumber ?? 1;

  const structural = validateExtractedQuestionItem({
    originalNumber: nextOriginalNumber,
    questionType: currentPayload.questionType ?? "MULTIPLE_CHOICE",
    statement: nextStatement,
    supportText: nextSupportText,
    options: nextOptions,
    officialAnswer: nextOfficialAnswer,
    isAnnulled: nextIsAnnulled,
    subjectSlug:
      nextClassificationStatus === "CLASSIFIED" ? nextSubjectSlug : "pending",
    pageNumber: nextPageNumber,
    sourceDocumentSha256: job.examPdfDocument.sha256,
    examFormVersionLabel: job.examForm.versionLabel,
  });

  const canonicalHash = computeQuestionCanonicalHash({
    questionType: currentPayload.questionType ?? "MULTIPLE_CHOICE",
    statement: nextStatement,
    options: nextOptions,
  });

  let nextReviewState: ImportItemReviewState = "AWAITING_REVIEW";
  let nextValidationStatus: "PENDING" | "VERIFIED" | "REJECTED" = "PENDING";
  let reviewedAt: Date | null = null;

  if (body.action === "REJECT") {
    nextReviewState = "REJECTED";
    nextValidationStatus = "REJECTED";
    reviewedAt = new Date();
  } else if (body.action === "APPROVE") {
    const blockers: string[] = [];
    if (!structural.isValid) {
      blockers.push(...structural.issues.map((i) => i.message));
    }
    if (nextClassificationStatus === "CLASSIFICATION_PENDING") {
      blockers.push(
        "Selecione uma disciplina válida antes de aprovar (atualmente CLASSIFICATION_PENDING)."
      );
    }
    if (nextHasMissingVisual) {
      blockers.push(
        "Item sinalizado com figura/tabela pendente. Confira no PDF original e desmarque a pendência visual apenas quando o conteúdo estiver completo."
      );
    }
    if (!nextAnswerKeyVerified) {
      blockers.push(
        "Confirme a conferência do gabarito definitivo para este item antes de aprovar."
      );
    }

    if (blockers.length > 0) {
      return NextResponse.json(
        {
          error: "APPROVAL_BLOCKED",
          message: blockers[0],
          blockers,
        },
        { status: 422 }
      );
    }

    nextReviewState = "VERIFIED";
    nextValidationStatus = "VERIFIED";
    reviewedAt = new Date();
  } else {
    // EDIT: salva correções mas mantém aguardando aprovação humana explícita
    nextReviewState =
      !structural.isValid
        ? "REJECTED"
        : nextClassificationStatus === "CLASSIFICATION_PENDING" ||
            nextHasMissingVisual ||
            !nextAnswerKeyVerified
          ? "AWAITING_REVIEW"
          : "STRUCTURALLY_VALID";
    nextValidationStatus = structural.isValid ? "PENDING" : "REJECTED";
    reviewedAt = null;
  }

  const updatedPayload: StoredItemPayload = {
    ...currentPayload,
    originalNumber: nextOriginalNumber,
    statement: nextStatement,
    supportText: nextSupportText,
    options: nextOptions,
    officialAnswer: nextOfficialAnswer,
    isAnnulled: nextIsAnnulled,
    subjectSlug: nextSubjectSlug,
    classificationStatus: nextClassificationStatus,
    hasMissingVisualOrTable: nextHasMissingVisual,
    visualWarning: nextHasMissingVisual ? currentPayload.visualWarning : null,
    answerKeyVerified: nextAnswerKeyVerified,
    reviewState: nextReviewState,
    reviewedByUserId: auth.user.id,
    reviewedByName: auth.user.name,
    reviewNotes: body.reviewNotes ?? currentPayload.reviewNotes ?? null,
    pageNumber: nextPageNumber,
    canonicalHash,
  };

  const updatedItem = await prisma.$transaction(async (tx) => {
    const item = await tx.importJobItem.update({
      where: { id: existing.id },
      data: {
        originalNumber: nextOriginalNumber,
        rawExtractedText: nextStatement,
        structuredPayloadJson: updatedPayload,
        detectedAnswerKey: nextOfficialAnswer || null,
        validationStatus: nextValidationStatus,
        validationErrorsJson: structural.issues,
        reviewedAt,
      },
    });

    const verifiedCount = await tx.importJobItem.count({
      where: { importJobId: jobId, validationStatus: "VERIFIED" },
    });

    await tx.importJob.update({
      where: { id: jobId },
      data: { totalValidated: verifiedCount },
    });

    await tx.contentReviewLog.create({
      data: {
        entityType: "IMPORT_JOB_ITEM",
        entityId: item.id,
        action: `IMPORT_ITEM_${body.action}`,
        previousStatus: currentPayload.reviewState ?? existing.validationStatus,
        newStatus: nextReviewState,
        notes:
          body.reviewNotes?.trim() ||
          `Ação ${body.action} executada por ${auth.user.name} na questão #${nextOriginalNumber}.`,
        reviewerUserId: auth.user.id,
      },
    });

    return item;
  });

  return NextResponse.json({ item: updatedItem });
}
