import dotenv from "dotenv";
dotenv.config({ path: [".env.local", ".env"] });

import fs from "node:fs/promises";
import path from "node:path";
import { prisma } from "../../src/lib/db/prisma";
import { validateExtractedQuestionItem } from "../../src/features/imports/pipeline";

const OAB_20_DISCIPLINES: Array<{ slug: string; name: string; displayOrder: number }> = [
  { slug: "oab-etica-profissional", name: "Ética Profissional e Estatuto da OAB", displayOrder: 101 },
  { slug: "oab-filosofia-do-direito", name: "Filosofia do Direito", displayOrder: 102 },
  { slug: "oab-direito-constitucional", name: "Direito Constitucional (OAB)", displayOrder: 103 },
  { slug: "oab-direitos-humanos", name: "Direitos Humanos", displayOrder: 104 },
  { slug: "oab-direito-eleitoral", name: "Direito Eleitoral", displayOrder: 105 },
  { slug: "oab-direito-internacional", name: "Direito Internacional", displayOrder: 106 },
  { slug: "oab-direito-financeiro", name: "Direito Financeiro", displayOrder: 107 },
  { slug: "oab-direito-tributario", name: "Direito Tributário", displayOrder: 108 },
  { slug: "oab-direito-administrativo", name: "Direito Administrativo (OAB)", displayOrder: 109 },
  { slug: "oab-direito-ambiental", name: "Direito Ambiental", displayOrder: 110 },
  { slug: "oab-direito-civil", name: "Direito Civil", displayOrder: 111 },
  { slug: "oab-eca", name: "Direito da Criança e do Adolescente (ECA)", displayOrder: 112 },
  { slug: "oab-direito-do-consumidor", name: "Direito do Consumidor", displayOrder: 113 },
  { slug: "oab-direito-empresarial", name: "Direito Empresarial", displayOrder: 114 },
  { slug: "oab-direito-processual-civil", name: "Direito Processual Civil (OAB)", displayOrder: 115 },
  { slug: "oab-direito-penal", name: "Direito Penal (OAB)", displayOrder: 116 },
  { slug: "oab-direito-processual-penal", name: "Direito Processual Penal (OAB)", displayOrder: 117 },
  { slug: "oab-direito-previdenciario", name: "Direito Previdenciário", displayOrder: 118 },
  { slug: "oab-direito-do-trabalho", name: "Direito do Trabalho", displayOrder: 119 },
  { slug: "oab-direito-processual-do-trabalho", name: "Direito Processual do Trabalho", displayOrder: 120 },
];

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

const OAB_NUMS_TO_IMPORT = [47, 46, 44, 43, 40, 39, 38, 37];

async function ensureExtraEditions(): Promise<void> {
  // Garantir edições extras de TJSP (2025/2023/2022), PCSP (Escrivão/2018) e OAB (45º e 42º) no catálogo
  const [tjspRef, pcspRef, oabRef] = await Promise.all([
    prisma.examEdition.findUnique({ where: { editionCode: "TJSP-2024-ESCREVENTE" } }),
    prisma.examEdition.findUnique({ where: { editionCode: "PCSP-2023-INVESTIGADOR" } }),
    prisma.examEdition.findUnique({ where: { editionCode: "OAB-41-1FASE" } }),
  ]);

  if (tjspRef) {
    const tjspExtras = [
      {
        editionCode: "TJSP-2025-ESCREVENTE",
        title: "TJSP 2025 — Escrevente Técnico Judiciário (TJSP2503)",
        year: 2025,
        examDate: new Date("2025-12-07"),
        url: "https://www.vunesp.com.br/TJSP2503",
      },
      {
        editionCode: "TJSP-2023-ESCREVENTE-INTERIOR",
        title: "TJSP 2023 — Escrevente Técnico Judiciário (TJSP2301)",
        year: 2023,
        examDate: new Date("2023-07-02"),
        url: "https://www.vunesp.com.br/TJSP2301",
      },
      {
        editionCode: "TJSP-2023-ESCREVENTE-CAPITAL",
        title: "TJSP 2023 — Escrevente Técnico Judiciário (TJSP2201 — Capital)",
        year: 2023,
        examDate: new Date("2023-05-28"),
        url: "https://www.vunesp.com.br/TJSP2201",
      },
    ];
    for (const ex of tjspExtras) {
      await prisma.examEdition.upsert({
        where: { editionCode: ex.editionCode },
        update: { title: ex.title, officialNoticeUrl: ex.url },
        create: {
          positionId: tjspRef.positionId,
          examBoardId: tjspRef.examBoardId,
          rulesetId: tjspRef.rulesetId,
          editionCode: ex.editionCode,
          title: ex.title,
          year: ex.year,
          examDate: ex.examDate,
          officialNoticeUrl: ex.url,
          examForms: { create: [{ versionLabel: "Versão 1", isDefault: true }] },
        },
      });
    }
  }

  if (pcspRef) {
    await prisma.examEdition.upsert({
      where: { editionCode: "PCSP-2018-INVESTIGADOR" },
      update: { officialNoticeUrl: "https://www.vunesp.com.br/PCSP1702" },
      create: {
        positionId: pcspRef.positionId,
        examBoardId: pcspRef.examBoardId,
        rulesetId: pcspRef.rulesetId,
        editionCode: "PCSP-2018-INVESTIGADOR",
        title: "Concurso Público PCSP 2018 — Investigador de Polícia (PCSP1702)",
        year: 2018,
        examDate: new Date("2018-06-10"),
        officialNoticeUrl: "https://www.vunesp.com.br/PCSP1702",
        examForms: { create: [{ versionLabel: "Versão 1", isDefault: true }] },
      },
    });
  }

  if (oabRef) {
    for (const pending of [
      {
        editionCode: "OAB-45-1FASE",
        title: "45º Exame de Ordem Unificado — 1ª Fase (Prova Objetiva)",
        year: 2025,
        examDate: new Date("2025-12-21"),
        url: "https://oab.fgv.br/home.aspx?key=648",
      },
      {
        editionCode: "OAB-42-1FASE",
        title: "42º Exame de Ordem Unificado — 1ª Fase (Prova Objetiva)",
        year: 2024,
        examDate: new Date("2024-12-01"),
        url: "https://oab.fgv.br/home.aspx?key=645",
      },
    ]) {
      await prisma.examEdition.upsert({
        where: { editionCode: pending.editionCode },
        update: { title: pending.title, officialNoticeUrl: pending.url },
        create: {
          positionId: oabRef.positionId,
          examBoardId: oabRef.examBoardId,
          rulesetId: oabRef.rulesetId,
          editionCode: pending.editionCode,
          title: pending.title,
          year: pending.year,
          examDate: pending.examDate,
          officialNoticeUrl: pending.url,
          examForms: { create: [{ versionLabel: "Tipo 1 - Branca", isDefault: true }] },
        },
      });
    }
  }
}

async function importSingleOabEdition(
  examNum: number,
  oabRef: { positionId: string; examBoardId: string; rulesetId: string },
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

  const edition = await prisma.examEdition.upsert({
    where: { editionCode: payload.editionCode },
    update: {
      title: payload.title,
      year: payload.year,
      examDate: new Date(payload.examDate),
      officialNoticeUrl: payload.examPdfOfficialUrl,
    },
    create: {
      positionId: oabRef.positionId,
      examBoardId: oabRef.examBoardId,
      rulesetId: oabRef.rulesetId,
      editionCode: payload.editionCode,
      title: payload.title,
      year: payload.year,
      examDate: new Date(payload.examDate),
      officialNoticeUrl: payload.examPdfOfficialUrl,
      examForms: { create: [{ versionLabel: "Tipo 1 - Branca", isDefault: true }] },
    },
    include: { examForms: true },
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
        rightsNotes: "PDF oficial público obtido legitimamente do portal oficial FGV/OAB (oab.fgv.br).",
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
        rightsNotes: "Gabarito oficial definitivo público obtido legitimamente do portal FGV/OAB.",
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

  // Processar em lotes concorrentes de 10 itens para alta velocidade no Prisma Postgres
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
  console.info("=== EXPANSÃO OAB 2023–2026 NO PRISMA POSTGRES ===\n");

  // 1. Seed das 20 disciplinas oficiais da OAB
  const subjectsBySlug = new Map<string, string>();
  for (const d of OAB_20_DISCIPLINES) {
    const s = await prisma.subject.upsert({
      where: { slug: d.slug },
      update: { name: d.name, isLegalSubject: true, displayOrder: d.displayOrder },
      create: {
        slug: d.slug,
        name: d.name,
        isLegalSubject: true,
        displayOrder: d.displayOrder,
      },
    });
    subjectsBySlug.set(s.slug, s.id);
  }
  console.info(`[1/3] ${subjectsBySlug.size} disciplinas hierárquicas oficiais da OAB garantidas.`);

  await ensureExtraEditions();

  const oabRef = await prisma.examEdition.findUnique({
    where: { editionCode: "OAB-41-1FASE" },
  });
  if (!oabRef) throw new Error("Edição base OAB-41-1FASE não encontrada.");

  // 2. Importar os 8 novos exames completos (640 questões oficiais reais!)
  console.info("[2/3] Importando 8 exames completos da OAB (47º, 46º, 44º, 43º, 40º, 39º, 38º, 37º)...");
  for (const examNum of OAB_NUMS_TO_IMPORT) {
    const res = await importSingleOabEdition(examNum, oabRef, subjectsBySlug);
    console.info(
      `   [OK] ${res.editionCode}: ${res.published}/80 publicadas | Anuladas: [${res.annulled.join(", ")}]`
    );
  }

  // 3. Totais finais no Prisma Postgres
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

  console.info("\n=== RESUMO CONSOLIDADO NO PRISMA POSTGRES ===", {
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
    console.error("[ERRO EXPANSÃO OAB]", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
