import dotenv from "dotenv";
dotenv.config({ path: [".env.local", ".env"] });

import fs from "node:fs/promises";
import path from "node:path";
import { prisma } from "../../src/lib/db/prisma";
import { validateExtractedQuestionItem } from "../../src/features/imports/pipeline";

type ExtractedOabItem = {
  originalNumber: number;
  questionType: "MULTIPLE_CHOICE";
  statement: string;
  supportText?: string | null;
  options: Array<{ label: string; content: string }>;
  officialAnswer: string;
  isAnnulled: boolean;
  subjectSlug: string;
  pageNumber: number;
};

type ExtractedOabPayload = {
  examNum: number;
  year: number;
  editionCode: string;
  title: string;
  examDate: string;
  versionLabel: string;
  examPdfSha256: string;
  examPdfOfficialUrl: string;
  answerKeySha256: string;
  answerKeyOfficialUrl: string;
  idempotencyKey: string;
  totalDetected: number;
  totalComplete: number;
  annulledNumbers: number[];
  extractedItems: ExtractedOabItem[];
};

async function importEdition(
  examNum: number,
  subjectsBySlug: Map<string, string>
): Promise<{ editionCode: string; published: number; annulled: number[] }> {
  const jsonPath = path.join(
    process.cwd(),
    "acervo",
    "oab_2023_2026",
    `oab_${examNum}`,
    `import_oab${examNum}_extracted.json`
  );
  const payload = JSON.parse(await fs.readFile(jsonPath, "utf-8")) as ExtractedOabPayload;

  const edition = await prisma.examEdition.findUnique({
    where: { editionCode: payload.editionCode },
    include: { examForms: true },
  });
  if (!edition) throw new Error(`Edição ${payload.editionCode} não encontrada.`);

  await prisma.examEdition.update({
    where: { id: edition.id },
    data: {
      examDate: new Date(payload.examDate),
      officialNoticeUrl: payload.examPdfOfficialUrl,
    },
  });

  const form =
    edition.examForms.find((f) => f.versionLabel === "Tipo 1 - Branca") ??
    edition.examForms[0]!;

  const [examDoc, keyDoc] = await Promise.all([
    prisma.sourceDocument.upsert({
      where: { sha256: payload.examPdfSha256 },
      update: { title: `${payload.title} — Tipo 1 Branca (FGV)`, verificationStatus: "VERIFIED" },
      create: {
        examEditionId: edition.id,
        examFormId: form.id,
        documentType: "EXAM_BOOKLET",
        title: `${payload.title} — Tipo 1 Branca (FGV)`,
        officialUrl: payload.examPdfOfficialUrl,
        sha256: payload.examPdfSha256,
        versionLabel: form.versionLabel,
        sourceDate: new Date(payload.examDate),
        rightsNotes:
          "PDF oficial público obtido legitimamente de oab.fgv.br; texto decodificado deterministicamente via tabela cmap Calibri (0% OCR, 0 caracteres corrompidos).",
        verificationStatus: "VERIFIED",
      },
    }),
    prisma.sourceDocument.upsert({
      where: { sha256: payload.answerKeySha256 },
      update: { title: `Gabarito Oficial Definitivo — ${payload.title} (FGV)`, verificationStatus: "VERIFIED" },
      create: {
        examEditionId: edition.id,
        examFormId: form.id,
        documentType: "OFFICIAL_ANSWER_KEY",
        title: `Gabarito Oficial Definitivo — ${payload.title} (FGV)`,
        officialUrl: payload.answerKeyOfficialUrl,
        sha256: payload.answerKeySha256,
        versionLabel: form.versionLabel,
        sourceDate: new Date(payload.examDate),
        rightsNotes: "Gabarito oficial definitivo público obtido legitimamente de oab.fgv.br.",
        verificationStatus: "VERIFIED",
      },
    }),
  ]);

  const job = await prisma.importJob.upsert({
    where: { idempotencyKey: payload.idempotencyKey },
    update: { status: "EXTRACTING", totalDetected: payload.extractedItems.length },
    create: {
      examEditionId: edition.id,
      examFormId: form.id,
      examPdfDocumentId: examDoc.id,
      answerKeyDocumentId: keyDoc.id,
      status: "EXTRACTING",
      currentStage: "VALIDATING",
      totalDetected: payload.extractedItems.length,
      idempotencyKey: payload.idempotencyKey,
      startedAt: new Date(),
    },
  });

  const BATCH_SIZE = 10;
  let publishedCount = 0;
  const now = new Date();

  for (let i = 0; i < payload.extractedItems.length; i += BATCH_SIZE) {
    const chunk = payload.extractedItems.slice(i, i + BATCH_SIZE);
    await Promise.all(
      chunk.map(async (item) => {
        const validation = validateExtractedQuestionItem({
          originalNumber: item.originalNumber,
          questionType: "MULTIPLE_CHOICE",
          statement: item.statement,
          options: item.options,
          officialAnswer: item.officialAnswer,
          isAnnulled: item.isAnnulled,
          subjectSlug: item.subjectSlug,
          pageNumber: item.pageNumber,
          sourceDocumentSha256: payload.examPdfSha256,
          examFormVersionLabel: form.versionLabel,
        });

        if (!validation.isValid) return;

        const question = await prisma.question.upsert({
          where: { canonicalHash: validation.canonicalHash },
          update: {
            statement: item.statement,
            status: "PUBLISHED",
            validatedAt: now,
            publishedAt: now,
          },
          create: {
            questionType: "MULTIPLE_CHOICE",
            statement: item.statement,
            status: "PUBLISHED",
            difficulty: "MEDIUM",
            canonicalHash: validation.canonicalHash,
            validatedAt: now,
            publishedAt: now,
            options: {
              create: item.options.map((o, idx) => ({
                label: o.label,
                content: o.content,
                displayOrder: idx + 1,
              })),
            },
          },
        });

        const subjectId = subjectsBySlug.get(item.subjectSlug);
        await Promise.all([
          prisma.questionSource.upsert({
            where: {
              questionId_sourceDocumentId: {
                questionId: question.id,
                sourceDocumentId: examDoc.id,
              },
            },
            update: { pageNumber: item.pageNumber },
            create: {
              questionId: question.id,
              sourceDocumentId: examDoc.id,
              pageNumber: item.pageNumber,
              sourceReference: `${payload.editionCode} — Tipo 1 Branca — Questão #${item.originalNumber} (Pág. ${item.pageNumber})`,
              extractedSnippetHash: validation.canonicalHash,
            },
          }),
          subjectId
            ? prisma.questionSubject.upsert({
                where: { questionId_subjectId: { questionId: question.id, subjectId } },
                update: { isPrimary: true },
                create: { questionId: question.id, subjectId, isPrimary: true },
              })
            : Promise.resolve(),
        ]);

        const instance = await prisma.examQuestionInstance.upsert({
          where: {
            examFormId_originalNumber: {
              examFormId: form.id,
              originalNumber: item.originalNumber,
            },
          },
          update: {
            questionId: question.id,
            isAnnulled: item.isAnnulled,
            annulmentReason: item.isAnnulled
              ? `Questão oficialmente anulada no Gabarito Definitivo da FGV (${payload.editionCode}).`
              : null,
          },
          create: {
            examFormId: form.id,
            questionId: question.id,
            originalNumber: item.originalNumber,
            displayOrder: item.originalNumber,
            isAnnulled: item.isAnnulled,
            annulmentReason: item.isAnnulled
              ? `Questão oficialmente anulada no Gabarito Definitivo da FGV (${payload.editionCode}).`
              : null,
          },
        });

        await Promise.all([
          prisma.officialAnswerKey.upsert({
            where: {
              examQuestionInstanceId_revisionNumber: {
                examQuestionInstanceId: instance.id,
                revisionNumber: 1,
              },
            },
            update: {
              answerValue: item.officialAnswer,
              status: item.isAnnulled ? "ANNULLED" : "DEFINITIVE",
              isDefinitive: true,
              sourceDocumentId: keyDoc.id,
            },
            create: {
              examQuestionInstanceId: instance.id,
              sourceDocumentId: keyDoc.id,
              answerValue: item.officialAnswer,
              status: item.isAnnulled ? "ANNULLED" : "DEFINITIVE",
              revisionNumber: 1,
              isDefinitive: true,
            },
          }),
          prisma.importJobItem.upsert({
            where: {
              importJobId_originalNumber: {
                importJobId: job.id,
                originalNumber: item.originalNumber,
              },
            },
            update: {
              questionId: question.id,
              validationStatus: "VERIFIED",
              reviewedAt: now,
            },
            create: {
              importJobId: job.id,
              questionId: question.id,
              originalNumber: item.originalNumber,
              rawExtractedText: item.statement,
              structuredPayloadJson: {
                ...item,
                reviewState: "VERIFIED",
                answerKeyVerified: true,
                classificationStatus: "CLASSIFIED",
              },
              detectedAnswerKey: item.officialAnswer,
              validationStatus: "VERIFIED",
              reviewedAt: now,
            },
          }),
        ]);

        publishedCount += 1;
      })
    );
  }

  await prisma.importJob.update({
    where: { id: job.id },
    data: {
      status: "PUBLISHED",
      currentStage: "PUBLISHED",
      totalStructured: payload.extractedItems.length,
      totalValidated: publishedCount,
      totalPublished: publishedCount,
      finishedAt: new Date(),
    },
  });

  return {
    editionCode: payload.editionCode,
    published: publishedCount,
    annulled: payload.annulledNumbers,
  };
}

async function main(): Promise<void> {
  const subjectsBySlug = new Map(
    (await prisma.subject.findMany({ select: { id: true, slug: true } })).map((s) => [
      s.slug,
      s.id,
    ])
  );

  for (const num of [42, 45]) {
    const res = await importEdition(num, subjectsBySlug);
    console.info(
      `[OK] ${res.editionCode}: ${res.published}/80 publicadas | Anuladas: [${res.annulled.join(", ")}]`
    );
  }

  const [totalPublished, oabPublished, prfPublished, awaitingReview, totalKeys, annulled] =
    await Promise.all([
      prisma.question.count({ where: { status: "PUBLISHED" } }),
      prisma.question.count({
        where: {
          status: "PUBLISHED",
          examInstances: {
            some: {
              examForm: {
                examEdition: { position: { studyTrack: { code: "OAB" } } },
              },
            },
          },
        },
      }),
      prisma.question.count({
        where: {
          status: "PUBLISHED",
          examInstances: {
            some: {
              examForm: {
                examEdition: { position: { studyTrack: { code: "PRF" } } },
              },
            },
          },
        },
      }),
      prisma.question.count({ where: { status: "AWAITING_REVIEW" } }),
      prisma.officialAnswerKey.count({ where: { isDefinitive: true } }),
      prisma.examQuestionInstance.count({ where: { isAnnulled: true } }),
    ]);

  console.info("\n=== META OAB 2023–2026 CONCLUÍDA NO PRISMA POSTGRES ===", {
    totalPublished,
    oabPublished,
    prfPublished,
    awaitingReview,
    totalDefinitiveKeys: totalKeys,
    annulledInstances: annulled,
  });
}

main()
  .catch((err) => {
    console.error("[ERRO IMPORT OAB 42/45]", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
