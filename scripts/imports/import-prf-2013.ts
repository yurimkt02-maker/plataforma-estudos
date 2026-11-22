import dotenv from "dotenv";
dotenv.config({ path: [".env.local", ".env"] });

import fs from "node:fs/promises";
import path from "node:path";
import { prisma } from "../../src/lib/db/prisma";
import {
  auditExamCompleteness,
  enforceImportPublicationPolicy,
  resolveIdempotentQuestionWrite,
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
  const dryRun = process.argv.includes("--dry-run");

  const jsonPath = path.join(
    process.cwd(),
    "acervo",
    "prf_2013",
    "import_prf2013_extracted.json"
  );
  const payload = JSON.parse(
    await fs.readFile(jsonPath, "utf-8")
  ) as ExtractedPrf2013Payload;

  if (!dryRun) {
    await ensurePrf2013Subjects();
  }

  const prfRef = await prisma.examEdition.findUnique({
    where: { editionCode: "PRF-2021-POLICIAL" },
  });
  if (!prfRef) {
    throw new Error("Edição de referência PRF-2021-POLICIAL não encontrada.");
  }

  const existingEdition = await prisma.examEdition.findUnique({
    where: { editionCode: payload.editionCode },
    include: { examForms: true },
  });

  if (dryRun && existingEdition) {
    // Simular reexecução idempotente sem qualquer escrita no banco
    const existingQuestions = await prisma.question.findMany({
      where: {
        examInstances: {
          some: { examForm: { examEditionId: existingEdition.id } },
        },
      },
      include: { _count: { select: { assets: true } } },
    });
    const byHash = new Map(existingQuestions.map((q) => [q.canonicalHash, q]));
    const formLabel = existingEdition.examForms[0]?.versionLabel ?? payload.versionLabel;

    let wouldCreate = 0;
    let wouldPreservePublished = 0;
    let wouldUpdatePending = 0;
    let wouldReject = 0;

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
        examFormVersionLabel: formLabel,
      });

      const policy = enforceImportPublicationPolicy({
        validation,
        hasVerifiedHumanReview: false,
        examDocumentVerified: true,
        answerKeyDocumentVerified: true,
      });

      const ex = byHash.get(validation.canonicalHash);
      const plan = resolveIdempotentQuestionWrite({
        existing: ex
          ? {
              id: ex.id,
              status: ex.status,
              statement: ex.statement,
              supportText: ex.supportText,
              validatedAt: ex.validatedAt,
              publishedAt: ex.publishedAt,
              assetsCount: ex._count.assets,
            }
          : null,
        incomingStatement: item.statement,
        incomingSupportText: item.supportText ?? null,
        policy,
      });

      if (!validation.isValid) wouldReject++;
      else if (plan.action === "CREATE") wouldCreate++;
      else if (plan.action === "PRESERVE_EXISTING") wouldPreservePublished++;
      else wouldUpdatePending++;
    }

    console.info("=== SIMULAÇÃO IDEMPOTENTE DE REEXECUÇÃO PRF 2013 (DRY-RUN) ===");
    console.info({
      editionCode: payload.editionCode,
      totalItems: payload.extractedItems.length,
      wouldCreate,
      wouldPreservePublished,
      wouldUpdatePending,
      wouldReject,
      zeroPublishedDowngraded: wouldPreservePublished === existingQuestions.filter((q) => q.status === "PUBLISHED").length,
    });
    return;
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

  const existingJob = await prisma.importJob.findUnique({
    where: { idempotencyKey: payload.idempotencyKey },
  });

  const job =
    existingJob ??
    (await prisma.importJob.create({
      data: {
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
    }));

  const subjectsBySlug = new Map(
    (await prisma.subject.findMany()).map((s) => [s.slug, s])
  );

  let createdCount = 0;
  let preservedPublishedCount = 0;
  let updatedPendingCount = 0;
  let rejectedCount = 0;

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

    if (!validation.isValid) {
      rejectedCount++;
      continue;
    }

    const pubPolicy = enforceImportPublicationPolicy({
      validation,
      hasVerifiedHumanReview: false,
      examDocumentVerified: examDoc.verificationStatus === "VERIFIED",
      answerKeyDocumentVerified: keyDoc.verificationStatus === "VERIFIED",
    });

    const existing = await prisma.question.findUnique({
      where: { canonicalHash: validation.canonicalHash },
      include: { _count: { select: { assets: true } } },
    });

    const writePlan = resolveIdempotentQuestionWrite({
      existing: existing
        ? {
            id: existing.id,
            status: existing.status,
            statement: existing.statement,
            supportText: existing.supportText,
            validatedAt: existing.validatedAt,
            publishedAt: existing.publishedAt,
            assetsCount: existing._count.assets,
          }
        : null,
      incomingStatement: item.statement,
      incomingSupportText: item.supportText ?? null,
      policy: pubPolicy,
    });

    // Registros históricos já PUBLISHED nunca são rebaixados nem sobrescritos em reexecução
    if (writePlan.action === "PRESERVE_EXISTING") {
      preservedPublishedCount++;
      continue;
    }

    let questionId: string;
    if (writePlan.action === "CREATE") {
      const created = await prisma.question.create({
        data: {
          questionType: item.questionType,
          statement: writePlan.statement,
          supportText: writePlan.supportText,
          status: writePlan.status,
          difficulty: "MEDIUM",
          canonicalHash: validation.canonicalHash,
          validatedAt: writePlan.validatedAt,
          publishedAt: writePlan.publishedAt,
        },
      });
      questionId = created.id;
      createdCount++;
    } else {
      const updated = await prisma.question.update({
        where: { id: existing!.id },
        data: {
          statement: writePlan.statement,
          supportText: writePlan.supportText,
          status: writePlan.status,
          validatedAt: writePlan.validatedAt,
          publishedAt: writePlan.publishedAt,
        },
      });
      questionId = updated.id;
      updatedPendingCount++;
    }

    for (let i = 0; i < item.options.length; i++) {
      const opt = item.options[i]!;
      await prisma.questionOption.upsert({
        where: {
          questionId_label: { questionId, label: opt.label },
        },
        update: { content: opt.content, displayOrder: i + 1 },
        create: {
          questionId,
          label: opt.label,
          content: opt.content,
          displayOrder: i + 1,
        },
      });
    }

    await prisma.questionSource.upsert({
      where: {
        questionId_sourceDocumentId: {
          questionId,
          sourceDocumentId: examDoc.id,
        },
      },
      update: {
        pageNumber: item.pageNumber,
        sourceReference: `${payload.editionCode} — ${form.versionLabel} — Questão #${item.originalNumber} (Pág. ${item.pageNumber})`,
        extractedSnippetHash: validation.canonicalHash,
      },
      create: {
        questionId,
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
          questionId_subjectId: { questionId, subjectId: subject.id },
        },
        update: { isPrimary: true },
        create: { questionId, subjectId: subject.id, isPrimary: true },
      });
      if (subject.parentId) {
        await prisma.questionSubject.upsert({
          where: {
            questionId_subjectId: { questionId, subjectId: subject.parentId },
          },
          update: { isPrimary: false },
          create: { questionId, subjectId: subject.parentId, isPrimary: false },
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
        questionId,
        isAnnulled: item.isAnnulled,
        annulmentReason: item.isAnnulled
          ? "Item oficialmente anulado (X) no Gabarito Oficial Definitivo CESPE/UnB (DPRF13_001_01)."
          : null,
      },
      create: {
        examFormId: form.id,
        questionId,
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
  }

  // Só atualiza status do ImportJob se ele ainda não estiver PUBLISHED
  if (!existingJob || existingJob.status !== "PUBLISHED") {
    await prisma.importJob.update({
      where: { id: job.id },
      data: {
        status: "AWAITING_REVIEW",
        currentStage: "AWAITING_REVIEW",
        totalStructured: payload.extractedItems.length,
        totalValidated: createdCount + updatedPendingCount + preservedPublishedCount,
        totalPublished: preservedPublishedCount,
        finishedAt: new Date(),
      },
    });
  }

  console.info("=== IMPORTAÇÃO IDEMPOTENTE PRF 2013 CONCLUÍDA ===");
  console.info({
    editionCode: payload.editionCode,
    jobId: job.id,
    completenessPercent: completeness.completenessPercent,
    createdCount,
    preservedPublishedCount,
    updatedPendingCount,
    rejectedCount,
  });
}

if (require.main === module) {
  main()
    .catch((err) => {
      console.error(err);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
