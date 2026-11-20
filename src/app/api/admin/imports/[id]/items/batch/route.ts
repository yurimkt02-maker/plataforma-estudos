import { NextRequest, NextResponse } from "next/server";
import { requireApiAdmin } from "@/lib/auth/api-guard";
import { isDatabaseConfigured, prisma } from "@/lib/db/prisma";
import {
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
  assets?: Array<{
    url: string;
    caption?: string | null;
    assetType?: string;
    sha256?: string | null;
  }>;
  canonicalHash?: string;
};

/**
 * Revisão em lote com aprovação humana explícita:
 * - Exige sessão administrativa autenticada e declaração explícita de conferência humana
 * - Aplica rigorosamente todas as travas de disciplina, recurso visual e gabarito definitivo por item
 * - Nunca aprova itens com classificação pendente, figura ausente ou erro estrutural
 */
export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireApiAdmin();
  if (!auth.authorized) return auth.response;

  if (!isDatabaseConfigured()) {
    return NextResponse.json(
      { error: "DATABASE_NOT_CONFIGURED" },
      { status: 503 }
    );
  }

  const { id: jobId } = await context.params;
  const body = (await request.json().catch(() => ({}))) as {
    itemIds?: string[];
    action?: "APPROVE" | "REJECT";
    confirmHumanReview?: boolean;
    confirmAnswerKeyChecked?: boolean;
    reviewNotes?: string;
  };

  const itemIds = Array.isArray(body.itemIds)
    ? body.itemIds.filter((x): x is string => typeof x === "string" && x.length > 0)
    : [];

  if (itemIds.length === 0) {
    return NextResponse.json(
      { error: "NO_ITEMS_SELECTED", message: "Selecione ao menos um item para revisão em lote." },
      { status: 400 }
    );
  }

  if (body.action !== "APPROVE" && body.action !== "REJECT") {
    return NextResponse.json(
      { error: "INVALID_ACTION", message: "Ação inválida. Utilize APPROVE ou REJECT." },
      { status: 400 }
    );
  }

  if (!body.confirmHumanReview) {
    return NextResponse.json(
      {
        error: "HUMAN_CONFIRMATION_REQUIRED",
        message:
          "É obrigatório confirmar expressamente a revisão humana antes de aprovar ou rejeitar itens em lote.",
      },
      { status: 422 }
    );
  }

  if (body.action === "APPROVE" && !body.confirmAnswerKeyChecked) {
    return NextResponse.json(
      {
        error: "ANSWER_KEY_CONFIRMATION_REQUIRED",
        message:
          "Confirme que o gabarito definitivo oficial (incluindo eventuais retificações e anulações pós-recurso) foi conferido antes de aprovar os itens.",
      },
      { status: 422 }
    );
  }

  const job = await prisma.importJob.findUnique({
    where: { id: jobId },
    include: {
      examForm: true,
      examPdfDocument: true,
      answerKeyDocument: true,
      items: { where: { id: { in: itemIds } }, orderBy: { originalNumber: "asc" } },
    },
  });

  if (!job) {
    return NextResponse.json(
      { error: "NOT_FOUND", message: "Job de importação não encontrado." },
      { status: 404 }
    );
  }

  if (
    body.action === "APPROVE" &&
    (job.examPdfDocument.verificationStatus !== "VERIFIED" ||
      job.answerKeyDocument?.verificationStatus !== "VERIFIED")
  ) {
    return NextResponse.json(
      {
        error: "DOCUMENTS_NOT_VERIFIED",
        message:
          "Confirme primeiro os documentos oficiais (caderno e gabarito definitivo) antes de marcar questões como VERIFIED em lote.",
      },
      { status: 422 }
    );
  }

  const reviewedAt = new Date();
  const approvedNumbers: number[] = [];
  const rejectedNumbers: number[] = [];
  const skippedItems: Array<{ originalNumber: number; reasons: string[] }> = [];

  for (const item of job.items) {
    const payload =
      (item.structuredPayloadJson as unknown as StoredItemPayload) ?? {};

    if (body.action === "REJECT") {
      await prisma.importJobItem.update({
        where: { id: item.id },
        data: {
          validationStatus: "REJECTED",
          reviewedAt,
          structuredPayloadJson: {
            ...payload,
            reviewState: "REJECTED",
            reviewedByUserId: auth.user.id,
            reviewedByName: auth.user.name,
            reviewNotes: body.reviewNotes?.trim() || "Rejeitado em revisão em lote.",
          },
        },
      });
      rejectedNumbers.push(item.originalNumber);
      continue;
    }

    const reasons: string[] = [];
    const subjectSlug = (payload.subjectSlug ?? "").trim();
    if (
      !subjectSlug ||
      subjectSlug === CLASSIFICATION_PENDING_SLUG ||
      payload.classificationStatus === "CLASSIFICATION_PENDING"
    ) {
      reasons.push("Classificação de disciplina/assunto pendente.");
    }
    if (payload.hasMissingVisualOrTable) {
      reasons.push("Elemento visual/tabela ainda pendente de confirmação ou anexo.");
    }

    const structural = validateExtractedQuestionItem({
      originalNumber: item.originalNumber,
      questionType: payload.questionType ?? "MULTIPLE_CHOICE",
      statement: payload.statement ?? "",
      supportText: payload.supportText,
      options: payload.options ?? [],
      officialAnswer: payload.officialAnswer ?? item.detectedAnswerKey ?? "",
      isAnnulled: payload.isAnnulled,
      subjectSlug: subjectSlug || "pending",
      pageNumber: payload.pageNumber ?? 1,
      sourceDocumentSha256: job.examPdfDocument.sha256,
      examFormVersionLabel: job.examForm.versionLabel,
    });

    if (!structural.isValid) {
      reasons.push(...structural.issues.map((i) => i.message));
    }

    if (reasons.length > 0) {
      skippedItems.push({ originalNumber: item.originalNumber, reasons });
      continue;
    }

    await prisma.importJobItem.update({
      where: { id: item.id },
      data: {
        validationStatus: "VERIFIED",
        reviewedAt,
        structuredPayloadJson: {
          ...payload,
          answerKeyVerified: true,
          reviewState: "VERIFIED",
          reviewedByUserId: auth.user.id,
          reviewedByName: auth.user.name,
          reviewNotes:
            body.reviewNotes?.trim() ||
            payload.reviewNotes ||
            "Conferido e aprovado em revisão humana em lote.",
        },
      },
    });
    approvedNumbers.push(item.originalNumber);
  }

  const allItems = await prisma.importJobItem.findMany({
    where: { importJobId: jobId },
    select: { validationStatus: true, reviewedAt: true, structuredPayloadJson: true },
  });

  const totalValidated = allItems.filter((it) => {
    const p = (it.structuredPayloadJson as Record<string, unknown>) ?? {};
    return (
      it.validationStatus === "VERIFIED" &&
      Boolean(it.reviewedAt) &&
      p.reviewState === "VERIFIED"
    );
  }).length;

  await prisma.importJob.update({
    where: { id: jobId },
    data: { totalValidated },
  });

  await prisma.contentReviewLog.create({
    data: {
      entityType: "ImportJob",
      entityId: jobId,
      action: body.action === "APPROVE" ? "BATCH_VERIFY_ITEMS" : "BATCH_REJECT_ITEMS",
      notes: `Revisão humana em lote por ${auth.user.name}: ${
        body.action === "APPROVE"
          ? `${approvedNumbers.length} aprovados (${approvedNumbers.join(", ")}), ${skippedItems.length} mantidos pendentes`
          : `${rejectedNumbers.length} rejeitados (${rejectedNumbers.join(", ")})`
      }.`,
      reviewerUserId: auth.user.id,
    },
  });

  return NextResponse.json({
    ok: true,
    action: body.action,
    approvedCount: approvedNumbers.length,
    rejectedCount: rejectedNumbers.length,
    approvedNumbers,
    rejectedNumbers,
    skippedItems,
    totalValidated,
  });
}
