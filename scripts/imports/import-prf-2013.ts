import dotenv from "dotenv";
dotenv.config({ path: [".env.local", ".env"] });

import fs from "node:fs/promises";
import path from "node:path";
import { prisma } from "../../src/lib/db/prisma";
import {
  auditExamCompleteness,
  validateExtractedQuestionItem,
} from "../../src/features/imports/pipeline";

type ExtractedItem = {
  originalNumber: number;
  questionType: "TRUE_FALSE";
  statement: string;
  supportText?: string | null;
  options: Array<{ label: string; content: string }>;
  officialAnswer: string;
  isAnnulled: boolean;
  subjectSlug: string;
  pageNumber: number;
  pageImages?: string[];
  requiresHumanReview?: boolean;
  reviewReason?: string | null;
};

type ExtractedPrf2013Payload = {
  editionCode: string;
  title: string;
  year: number;
  examDate: string;
  versionLabel: string;
  examPdfSha256: string;
  examPdfOfficialUrl: string;
  answerKeySha256: string;
  answerKeyOfficialUrl: string;
  idempotencyKey: string;
  totalDetected: number;
  annulledNumbers: number[];
  extractedItems: ExtractedItem[];
};

async function ensurePrf2013Subjects(): Promise<void> {
  const roots = await prisma.subject.findMany({
    where: {
      slug: {
        in: ["matematica", "direito-administrativo", "informatica"],
      },
    },
  });
  const rootBySlug = new Map(roots.map((r) => [r.slug, r]));

  // Garantir raiz de Física Aplicada à PRF
  const fisicaRoot = await prisma.subject.upsert({
    where: { slug: "fisica" },
    update: {},
    create: {
      slug: "fisica",
      name: "Física Aplicada",
      isLegalSubject: false,
      displayOrder: 45,
    },
  });

  const childSpecs = [
    {
      slug: "matematica-aplicada-prf",
      name: "Matemática Aplicada, Funções, Gráficos e Estatística",
      parentId: rootBySlug.get("matematica")?.id ?? null,
      isLegalSubject: false,
      displayOrder: 1,
    },
    {
      slug: "etica-no-servico-publico",
      name: "Ética no Serviço Público (Decreto nº 1.171/1994)",
      parentId: rootBySlug.get("direito-administrativo")?.id ?? null,
      isLegalSubject: true,
      displayOrder: 10,
    },
    {
      slug: "informatica-aplicativos-e-redes",
      name: "Suítes de Escritório, Redes de Computadores e Segurança da Informação",
      parentId: rootBySlug.get("informatica")?.id ?? null,
      isLegalSubject: false,
      displayOrder: 1,
    },
    {
      slug: "fisica-aplicada-prf",
      name: "Mecânica, Energia, Colisões, MHS e Ondulatória (Efeito Doppler)",
      parentId: fisicaRoot.id,
      isLegalSubject: false,
      displayOrder: 1,
    },
  ];

  for (const spec of childSpecs) {
    await prisma.subject.upsert({
      where: { slug: spec.slug },
      update: {
        name: spec.name,
        parentId: spec.parentId,
      },
      create: spec,
    });
  }
}

async function main(): Promise<void> {
  const jsonPath = path.join(
    process.cwd(),
    "acervo",
    "prf_2013",
    "import_prf2013_extracted.json"
  );
  const payload = JSON.parse(
    await fs.readFile(jsonPath, "utf-8")
  ) as ExtractedPrf2013Payload;

  await ensurePrf2013Subjects();

  const prfRef = await prisma.examEdition.findUnique({
    where: { editionCode: "PRF-2021-POLICIAL" },
  });
  if (!prfRef) {
    throw new Error("Edição de referência PRF-2021-POLICIAL não encontrada.");
  }

  const edition = await prisma.examEdition.upsert({
    where: { editionCode: payload.editionCode },
    update: {
      title: payload.title,
      year: payload.year,
      examDate: new Date(payload.examDate),
      expectedQuestionCount: 120,
      officialNoticeUrl: "https://www.cebraspe.org.br/concursos/dprf_13",
    },
    create: {
      positionId: prfRef.positionId,
      examBoardId: prfRef.examBoardId,
      rulesetId: prfRef.rulesetId,
      editionCode: payload.editionCode,
      title: payload.title,
      year: payload.year,
      examDate: new Date(payload.examDate),
      expectedQuestionCount: 120,
      officialNoticeUrl: "https://www.cebraspe.org.br/concursos/dprf_13",
      examForms: {
        create: [{ versionLabel: payload.versionLabel, isDefault: true }],
      },
    },
    include: { examForms: true },
  });

  let form =
    edition.examForms.find((f) => f.versionLabel === payload.versionLabel) ??
    edition.examForms[0];
  if (!form) {
    form = await prisma.examForm.create({
      data: {
        examEditionId: edition.id,
        versionLabel: payload.versionLabel,
        isDefault: true,
      },
    });
  }

  const rightsNotes =
    "Documento público oficial emitido pelo CESPE/UnB (Cebraspe) — Concurso DPRF_13 (Edital nº 1/2013, aplicação 11/08/2013).";

  const examDoc = await prisma.sourceDocument.upsert({
    where: { sha256: payload.examPdfSha256 },
    update: {
      title: "Caderno de Prova Oficial — PRF 2013 Tipo I (DPRF13_001_01)",
      officialUrl: payload.examPdfOfficialUrl,
      verificationStatus: "VERIFIED",
      rightsNotes,
    },
    create: {
      examEditionId: edition.id,
      examFormId: form.id,
      documentType: "EXAM_BOOKLET",
      title: "Caderno de Prova Oficial — PRF 2013 Tipo I (DPRF13_001_01)",
      officialUrl: payload.examPdfOfficialUrl,
      sha256: payload.examPdfSha256,
      versionLabel: form.versionLabel,
      sourceDate: new Date(payload.examDate),
      rightsNotes,
      verificationStatus: "VERIFIED",
    },
  });

  const keyDoc = await prisma.sourceDocument.upsert({
    where: { sha256: payload.answerKeySha256 },
    update: {
      title: "Gabarito Oficial Definitivo — PRF 2013 Tipo I (DPRF13_001_01)",
      officialUrl: payload.answerKeyOfficialUrl,
      verificationStatus: "VERIFIED",
      rightsNotes,
    },
    create: {
      examEditionId: edition.id,
      examFormId: form.id,
      documentType: "OFFICIAL_ANSWER_KEY",
      title: "Gabarito Oficial Definitivo — PRF 2013 Tipo I (DPRF13_001_01)",
      officialUrl: payload.answerKeyOfficialUrl,
      sha256: payload.answerKeySha256,
      versionLabel: form.versionLabel,
      sourceDate: new Date(payload.examDate),
      rightsNotes,
      verificationStatus: "VERIFIED",
    },
  });

  const completeness = auditExamCompleteness({
    expectedCount: 120,
    items: payload.extractedItems,
  });

  const job = await prisma.importJob.upsert({
    where: { idempotencyKey: payload.idempotencyKey },
    update: {
      status: "EXTRACTING",
      currentStage: "VALIDATING",
      totalDetected: payload.extractedItems.length,
    },
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

  const subjectsBySlug = new Map(
    (await prisma.subject.findMany()).map((s) => [s.slug, s])
  );

  let publishedCount = 0;
  let awaitingReviewCount = 0;
  let rejectedCount = 0;
  let duplicateHashes = 0;
  const seenHashes = new Set<string>();

  for (const item of payload.extractedItems) {
    const validation = validateExtractedQuestionItem({
      originalNumber: item.originalNumber,
      questionType: item.questionType,
      statement: item.statement,
      supportText: item.supportText ?? undefined,
      options: item.options,
      officialAnswer: item.officialAnswer,
      isAnnulled: item.isAnnulled,
      subjectSlug: item.subjectSlug,
      pageNumber: item.pageNumber,
      pageImages: item.pageImages,
      requiresHumanReview: item.requiresHumanReview,
      reviewReason: item.reviewReason,
      sourceDocumentSha256: payload.examPdfSha256,
      examFormVersionLabel: form.versionLabel,
    });

    if (seenHashes.has(validation.canonicalHash)) {
      duplicateHashes++;
    }
    seenHashes.add(validation.canonicalHash);

    if (!validation.isValid) {
      rejectedCount++;
      await prisma.importJobItem.upsert({
        where: {
          importJobId_originalNumber: {
            importJobId: job.id,
            originalNumber: item.originalNumber,
          },
        },
        update: {
          validationStatus: "REJECTED",
          validationErrorsJson: validation.issues,
        },
        create: {
          importJobId: job.id,
          originalNumber: item.originalNumber,
          rawExtractedText: item.statement,
          structuredPayloadJson: item,
          detectedAnswerKey: item.officialAnswer,
          validationStatus: "REJECTED",
          validationErrorsJson: validation.issues,
        },
      });
      continue;
    }

    const qStatus =
      validation.targetStatus === "AWAITING_REVIEW"
        ? "AWAITING_REVIEW"
        : "PUBLISHED";

    const question = await prisma.question.upsert({
      where: { canonicalHash: validation.canonicalHash },
      update: {
        statement: item.statement,
        supportText: item.supportText ?? null,
        status: qStatus,
        validatedAt: qStatus === "PUBLISHED" ? new Date() : null,
        publishedAt: qStatus === "PUBLISHED" ? new Date() : null,
      },
      create: {
        questionType: item.questionType,
        statement: item.statement,
        supportText: item.supportText ?? null,
        status: qStatus,
        difficulty: "MEDIUM",
        canonicalHash: validation.canonicalHash,
        validatedAt: qStatus === "PUBLISHED" ? new Date() : null,
        publishedAt: qStatus === "PUBLISHED" ? new Date() : null,
      },
    });

    for (let i = 0; i < item.options.length; i++) {
      const opt = item.options[i]!;
      await prisma.questionOption.upsert({
        where: {
          questionId_label: { questionId: question.id, label: opt.label },
        },
        update: { content: opt.content, displayOrder: i + 1 },
        create: {
          questionId: question.id,
          label: opt.label,
          content: opt.content,
          displayOrder: i + 1,
        },
      });
    }

    await prisma.questionSource.upsert({
      where: {
        questionId_sourceDocumentId: {
          questionId: question.id,
          sourceDocumentId: examDoc.id,
        },
      },
      update: {
        pageNumber: item.pageNumber,
        sourceReference: `${payload.editionCode} — ${form.versionLabel} — Questão #${item.originalNumber} (Pág. ${item.pageNumber})`,
        extractedSnippetHash: validation.canonicalHash,
      },
      create: {
        questionId: question.id,
        sourceDocumentId: examDoc.id,
        pageNumber: item.pageNumber,
        sourceReference: `${payload.editionCode} — ${form.versionLabel} — Questão #${item.originalNumber} (Pág. ${item.pageNumber})`,
        extractedSnippetHash: validation.canonicalHash,
      },
    });

    const subject = subjectsBySlug.get(item.subjectSlug);
    if (subject) {
      await prisma.questionSubject.upsert({
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
      if (subject.parentId) {
        await prisma.questionSubject.upsert({
          where: {
            questionId_subjectId: {
              questionId: question.id,
              subjectId: subject.parentId,
            },
          },
          update: { isPrimary: false },
          create: {
            questionId: question.id,
            subjectId: subject.parentId,
            isPrimary: false,
          },
        });
      }
    }

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
          ? "Item oficialmente anulado (X) no Gabarito Oficial Definitivo CESPE/UnB (DPRF13_001_01)."
          : null,
      },
      create: {
        examFormId: form.id,
        questionId: question.id,
        originalNumber: item.originalNumber,
        displayOrder: item.originalNumber,
        isAnnulled: item.isAnnulled,
        annulmentReason: item.isAnnulled
          ? "Item oficialmente anulado (X) no Gabarito Oficial Definitivo CESPE/UnB (DPRF13_001_01)."
          : null,
      },
    });

    await prisma.officialAnswerKey.upsert({
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
        isDefinitive: true,
        revisionNumber: 1,
      },
    });

    await prisma.importJobItem.upsert({
      where: {
        importJobId_originalNumber: {
          importJobId: job.id,
          originalNumber: item.originalNumber,
        },
      },
      update: {
        questionId: question.id,
        detectedAnswerKey: item.officialAnswer,
        validationStatus: qStatus === "PUBLISHED" ? "VERIFIED" : "PENDING",
        validationErrorsJson: validation.issues,
      },
      create: {
        importJobId: job.id,
        originalNumber: item.originalNumber,
        rawExtractedText: item.statement,
        structuredPayloadJson: item,
        detectedAnswerKey: item.officialAnswer,
        questionId: question.id,
        validationStatus: qStatus === "PUBLISHED" ? "VERIFIED" : "PENDING",
        validationErrorsJson: validation.issues,
      },
    });

    if (qStatus === "PUBLISHED") publishedCount++;
    else awaitingReviewCount++;
  }

  await prisma.importJob.update({
    where: { id: job.id },
    data: {
      status: awaitingReviewCount > 0 ? "AWAITING_REVIEW" : "PUBLISHED",
      currentStage: "PUBLISHED",
      totalStructured: payload.extractedItems.length,
      totalValidated: publishedCount + awaitingReviewCount,
      totalPublished: publishedCount,
      finishedAt: new Date(),
    },
  });

  const totalPublishedNow = await prisma.question.count({
    where: { status: "PUBLISHED" },
  });

  console.info("=== IMPORTAÇÃO PRF 2013 CONCLUÍDA ===");
  console.info({
    editionCode: payload.editionCode,
    jobId: job.id,
    detected: payload.extractedItems.length,
    completenessPercent: completeness.completenessPercent,
    published: publishedCount,
    awaitingReview: awaitingReviewCount,
    rejected: rejectedCount,
    annulledNumbers: payload.annulledNumbers,
    duplicateHashes,
    totalPublishedInDatabaseNow: totalPublishedNow,
  });
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
