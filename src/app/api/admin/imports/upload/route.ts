import { createHash } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { requireApiAdmin } from "@/lib/auth/api-guard";
import { isDatabaseConfigured, prisma } from "@/lib/db/prisma";
import {
  auditExamCompleteness,
  validateExtractedQuestionItem,
} from "@/features/imports/pipeline";
import {
  extractPdfPages,
  parseAnswerKeyText,
  parseExamBookletText,
} from "@/features/imports/pdf-parser";
import { logger } from "@/lib/utils/logger";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_PDF_BYTES = 20 * 1024 * 1024; // 20 MB

function sha256Buffer(buf: Buffer): string {
  return createHash("sha256").update(buf).digest("hex");
}

export async function POST(request: NextRequest) {
  const auth = await requireApiAdmin();
  if (!auth.authorized) return auth.response;

  if (!isDatabaseConfigured()) {
    return NextResponse.json(
      {
        error: "DATABASE_NOT_CONFIGURED",
        message: "Configure o Prisma Postgres para importar PDFs oficiais.",
      },
      { status: 503 }
    );
  }

  try {
    const formData = await request.formData();

    const examEditionId = String(formData.get("examEditionId") ?? "").trim();
    const examFormId = String(formData.get("examFormId") ?? "").trim();
    const questionTypeRaw = String(
      formData.get("questionType") ?? "MULTIPLE_CHOICE"
    ).trim();
    const questionType: "MULTIPLE_CHOICE" | "TRUE_FALSE" =
      questionTypeRaw === "TRUE_FALSE" ? "TRUE_FALSE" : "MULTIPLE_CHOICE";
    const examPdfOfficialUrlInput = String(
      formData.get("examPdfOfficialUrl") ?? ""
    ).trim();
    const answerKeyOfficialUrlInput = String(
      formData.get("answerKeyOfficialUrl") ?? ""
    ).trim();

    const examFile = formData.get("examPdf");
    const keyFile = formData.get("answerKeyPdf");

    if (!examEditionId || !examFormId) {
      return NextResponse.json(
        {
          error: "VALIDATION_ERROR",
          message: "Selecione a edição da prova e a versão do caderno.",
        },
        { status: 400 }
      );
    }

    if (!(examFile instanceof File) || !(keyFile instanceof File)) {
      return NextResponse.json(
        {
          error: "MISSING_FILES",
          message:
            "Envie ambos os arquivos PDF: Caderno de Prova e Gabarito Definitivo.",
        },
        { status: 400 }
      );
    }

    if (examFile.size === 0 || keyFile.size === 0) {
      return NextResponse.json(
        { error: "EMPTY_FILE", message: "Os arquivos PDF não podem estar vazios." },
        { status: 400 }
      );
    }

    if (examFile.size > MAX_PDF_BYTES || keyFile.size > MAX_PDF_BYTES) {
      return NextResponse.json(
        {
          error: "FILE_TOO_LARGE",
          message: "Cada PDF deve ter no máximo 20 MB.",
        },
        { status: 413 }
      );
    }

    const [examBuf, keyBuf] = await Promise.all([
      Buffer.from(await examFile.arrayBuffer()),
      Buffer.from(await keyFile.arrayBuffer()),
    ]);

    if (
      examBuf.subarray(0, 4).toString("ascii") !== "%PDF" ||
      keyBuf.subarray(0, 4).toString("ascii") !== "%PDF"
    ) {
      return NextResponse.json(
        {
          error: "INVALID_PDF",
          message: "Os arquivos enviados devem ser documentos PDF válidos (%PDF).",
        },
        { status: 400 }
      );
    }

    const examEdition = await prisma.examEdition.findUnique({
      where: { id: examEditionId },
      include: {
        position: { include: { studyTrack: true } },
        examBoard: true,
        examForms: true,
      },
    });

    if (!examEdition) {
      return NextResponse.json(
        { error: "NOT_FOUND", message: "Edição de prova não encontrada." },
        { status: 404 }
      );
    }

    const examForm = examEdition.examForms.find((f) => f.id === examFormId);
    if (!examForm) {
      return NextResponse.json(
        {
          error: "EXAM_FORM_MISMATCH",
          message: "Versão do caderno não pertence à edição selecionada.",
        },
        { status: 422 }
      );
    }

    const examSha = sha256Buffer(examBuf);
    const keySha = sha256Buffer(keyBuf);
    const idempotencyKey = `${examEdition.editionCode}::${examForm.versionLabel}::${examSha.slice(0, 16)}::${keySha.slice(0, 16)}`;

    const existingJob = await prisma.importJob.findUnique({
      where: { idempotencyKey },
      include: {
        examEdition: true,
        examForm: true,
        examPdfDocument: true,
        answerKeyDocument: true,
        items: { orderBy: { originalNumber: "asc" } },
      },
    });

    if (existingJob) {
      return NextResponse.json({
        idempotentReplay: true,
        job: existingJob,
        completeness: auditExamCompleteness({
          expectedCount:
            examEdition.position.studyTrack.code === "PRF"
              ? 120
              : examEdition.position.studyTrack.code === "TJSP"
                ? 100
                : 80,
          items: existingJob.items.map((it) => ({
            originalNumber: it.originalNumber,
            officialAnswer: it.detectedAnswerKey,
          })),
        }),
      });
    }

    // Extração serverless com unpdf
    const [examPages, keyPages] = await Promise.all([
      extractPdfPages(examBuf),
      extractPdfPages(keyBuf),
    ]);

    const keyFullText = keyPages.join("\n");
    const answerMap = parseAnswerKeyText(
      keyFullText,
      questionType,
      examForm.versionLabel
    );

    const extractedItems = parseExamBookletText({
      pages: examPages,
      answerMap,
      questionType,
      trackCode: examEdition.position.studyTrack.code,
    });

    if (extractedItems.length === 0) {
      return NextResponse.json(
        {
          error: "EXTRACTION_EMPTY",
          message:
            "Nenhuma questão estruturada foi detectada nos PDFs enviados. Verifique se o PDF possui texto selecionável (não escaneado como imagem) e se corresponde ao tipo de questão selecionado.",
          detectedAnswersCount: Object.keys(answerMap).length,
          examPagesCount: examPages.length,
        },
        { status: 422 }
      );
    }

    const defaultOfficialUrl =
      examEdition.officialNoticeUrl ||
      examEdition.examBoard.websiteUrl ||
      "https://www.vunesp.com.br/";

    const examPdfOfficialUrl = examPdfOfficialUrlInput || defaultOfficialUrl;
    const answerKeyOfficialUrl = answerKeyOfficialUrlInput || defaultOfficialUrl;

    const expectedCount =
      examEdition.position.studyTrack.code === "PRF"
        ? 120
        : examEdition.position.studyTrack.code === "TJSP"
          ? 100
          : 80;

    const completeness = auditExamCompleteness({
      expectedCount,
      items: extractedItems,
    });

    const job = await prisma.$transaction(async (tx) => {
      const examDoc = await tx.sourceDocument.upsert({
        where: { sha256: examSha },
        update: {
          title: `${examEdition.title} — ${examFile.name}`,
          officialUrl: examPdfOfficialUrl,
          verificationStatus: "VERIFIED",
        },
        create: {
          examEditionId: examEdition.id,
          examFormId: examForm.id,
          documentType: "EXAM_BOOKLET",
          title: `${examEdition.title} — ${examFile.name}`,
          officialUrl: examPdfOfficialUrl,
          sha256: examSha,
          fileSizeBytes: examBuf.length,
          versionLabel: examForm.versionLabel,
          sourceDate: examEdition.examDate ?? new Date(),
          rightsNotes:
            "PDF oficial enviado manualmente pelo proprietário via painel /admin/importacoes para uso estritamente pessoal.",
          verificationStatus: "VERIFIED",
        },
      });

      const keyDoc = await tx.sourceDocument.upsert({
        where: { sha256: keySha },
        update: {
          title: `Gabarito Oficial Definitivo — ${examEdition.editionCode} (${keyFile.name})`,
          officialUrl: answerKeyOfficialUrl,
          verificationStatus: "VERIFIED",
        },
        create: {
          examEditionId: examEdition.id,
          examFormId: examForm.id,
          documentType: "OFFICIAL_ANSWER_KEY",
          title: `Gabarito Oficial Definitivo — ${examEdition.editionCode} (${keyFile.name})`,
          officialUrl: answerKeyOfficialUrl,
          sha256: keySha,
          fileSizeBytes: keyBuf.length,
          versionLabel: examForm.versionLabel,
          sourceDate: examEdition.examDate ?? new Date(),
          rightsNotes:
            "Gabarito definitivo oficial enviado manualmente pelo proprietário via painel /admin/importacoes.",
          verificationStatus: "VERIFIED",
        },
      });

      let validCount = 0;
      const itemsToCreate = extractedItems.map((rawItem) => {
        const validation = validateExtractedQuestionItem({
          originalNumber: rawItem.originalNumber,
          questionType: rawItem.questionType,
          statement: rawItem.statement,
          supportText: rawItem.supportText,
          options: rawItem.options,
          officialAnswer: rawItem.officialAnswer,
          isAnnulled: rawItem.isAnnulled,
          subjectSlug: rawItem.subjectSlug,
          pageNumber: rawItem.pageNumber,
          sourceDocumentSha256: examSha,
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
          detectedAnswerKey: rawItem.officialAnswer || null,
          validationStatus: validation.isValid
            ? ("VERIFIED" as const)
            : ("REJECTED" as const),
          validationErrorsJson: validation.issues,
        };
      });

      const createdJob = await tx.importJob.create({
        data: {
          examEditionId: examEdition.id,
          examFormId: examForm.id,
          examPdfDocumentId: examDoc.id,
          answerKeyDocumentId: keyDoc.id,
          status: "AWAITING_REVIEW",
          currentStage: "AWAITING_REVIEW",
          totalDetected: extractedItems.length,
          totalStructured: extractedItems.length,
          totalValidated: validCount,
          idempotencyKey,
          startedAt: new Date(),
          items: {
            create: itemsToCreate,
          },
        },
        include: {
          examEdition: true,
          examForm: true,
          examPdfDocument: true,
          answerKeyDocument: true,
          items: { orderBy: { originalNumber: "asc" } },
        },
      });

      await tx.contentReviewLog.create({
        data: {
          entityType: "IMPORT_JOB",
          entityId: createdJob.id,
          action: "BROWSER_PDF_UPLOAD_EXTRACTED",
          previousStatus: "PENDING",
          newStatus: "AWAITING_REVIEW",
          notes: `Upload via interface: ${extractedItems.length} questões extraídas (${validCount} válidas), ${Object.keys(answerMap).length} respostas no gabarito.`,
          reviewerUserId: auth.user.id,
        },
      });

      return createdJob;
    });

    logger.info("BROWSER_PDF_IMPORT_JOB_CREATED", {
      jobId: job.id,
      editionCode: examEdition.editionCode,
      detected: job.totalDetected,
      validated: job.totalValidated,
    });

    return NextResponse.json(
      {
        job,
        detectedAnswersCount: Object.keys(answerMap).length,
        completeness,
      },
      { status: 201 }
    );
  } catch (error) {
    logger.error("UPLOAD_PDF_IMPORT_ERROR", error);
    return NextResponse.json(
      {
        error: "INTERNAL_ERROR",
        message:
          error instanceof Error
            ? `Erro ao extrair PDFs: ${error.message}`
            : "Erro interno ao processar upload dos PDFs.",
      },
      { status: 500 }
    );
  }
}
