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
  questionType: "MULTIPLE_CHOICE" | "TRUE_FALSE";
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

type ExtractedExamPayload = {
  editionCode: string;
  versionLabel: string;
  examPdfSha256: string;
  examPdfOfficialUrl: string;
  answerKeySha256: string;
  answerKeyOfficialUrl: string;
  idempotencyKey: string;
  totalDetected: number;
  extractedItems: ExtractedItem[];
};

async function importOfficialPayload(params: {
  payload: ExtractedExamPayload;
  examDocTitle: string;
  keyDocTitle: string;
  rightsNotes: string;
  sourceDate: string;
  expectedQuestionCount: number;
}): Promise<{
  editionCode: string;
  detected: number;
  published: number;
  awaitingReview: number;
  rejected: number;
  completenessPercent: number;
}> {
  const { payload } = params;
  const edition = await prisma.examEdition.findUnique({
    where: { editionCode: payload.editionCode },
    include: { examForms: true },
  });

  if (!edition) {
    throw new Error(`Edição ${payload.editionCode} não encontrada.`);
  }

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

  const examDoc = await prisma.sourceDocument.upsert({
    where: { sha256: payload.examPdfSha256 },
    update: {
      title: params.examDocTitle,
      officialUrl: payload.examPdfOfficialUrl,
      verificationStatus: "VERIFIED",
      rightsNotes: params.rightsNotes,
    },
    create: {
      examEditionId: edition.id,
      examFormId: form.id,
      documentType: "EXAM_BOOKLET",
      title: params.examDocTitle,
      officialUrl: payload.examPdfOfficialUrl,
      sha256: payload.examPdfSha256,
      versionLabel: form.versionLabel,
      sourceDate: new Date(params.sourceDate),
      rightsNotes: params.rightsNotes,
      verificationStatus: "VERIFIED",
    },
  });

  const keyDoc = await prisma.sourceDocument.upsert({
    where: { sha256: payload.answerKeySha256 },
    update: {
      title: params.keyDocTitle,
      officialUrl: payload.answerKeyOfficialUrl,
      verificationStatus: "VERIFIED",
      rightsNotes: params.rightsNotes,
    },
    create: {
      examEditionId: edition.id,
      examFormId: form.id,
      documentType: "OFFICIAL_ANSWER_KEY",
      title: params.keyDocTitle,
      officialUrl: payload.answerKeyOfficialUrl,
      sha256: payload.answerKeySha256,
      versionLabel: form.versionLabel,
      sourceDate: new Date(params.sourceDate),
      rightsNotes: params.rightsNotes,
      verificationStatus: "VERIFIED",
    },
  });

  const completeness = auditExamCompleteness({
    expectedCount: params.expectedQuestionCount,
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
      rejectedCount += 1;
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

    const qStatus = validation.targetStatus === "AWAITING_REVIEW" ? "AWAITING_REVIEW" : "PUBLISHED";

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
          ? `Item oficialmente anulado no Gabarito Definitivo da banca (${payload.editionCode}).`
          : null,
      },
      create: {
        examFormId: form.id,
        questionId: question.id,
        originalNumber: item.originalNumber,
        displayOrder: item.originalNumber,
        isAnnulled: item.isAnnulled,
        annulmentReason: item.isAnnulled
          ? `Item oficialmente anulado no Gabarito Definitivo da banca (${payload.editionCode}).`
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
        revisionNumber: 1,
        isDefinitive: true,
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
        validationStatus: qStatus === "PUBLISHED" ? "VERIFIED" : "PENDING",
        validationErrorsJson: validation.issues.length > 0 ? validation.issues : undefined,
        reviewedAt: qStatus === "PUBLISHED" ? new Date() : null,
      },
      create: {
        importJobId: job.id,
        questionId: question.id,
        originalNumber: item.originalNumber,
        rawExtractedText: item.statement,
        structuredPayloadJson: item,
        detectedAnswerKey: item.officialAnswer,
        validationStatus: qStatus === "PUBLISHED" ? "VERIFIED" : "PENDING",
        validationErrorsJson: validation.issues.length > 0 ? validation.issues : undefined,
        reviewedAt: qStatus === "PUBLISHED" ? new Date() : null,
      },
    });

    if (qStatus === "PUBLISHED") publishedCount += 1;
    else awaitingReviewCount += 1;
  }

  await prisma.importJob.update({
    where: { id: job.id },
    data: {
      status: awaitingReviewCount > 0 || rejectedCount > 0 ? "AWAITING_REVIEW" : "PUBLISHED",
      currentStage: "PUBLISHED",
      totalStructured: payload.extractedItems.length,
      totalValidated: publishedCount + awaitingReviewCount,
      totalPublished: publishedCount,
      finishedAt: new Date(),
    },
  });

  return {
    editionCode: payload.editionCode,
    detected: payload.extractedItems.length,
    published: publishedCount,
    awaitingReview: awaitingReviewCount,
    rejected: rejectedCount,
    completenessPercent: completeness.completenessPercent,
  };
}

async function main(): Promise<void> {
  if (!process.argv.includes("--allow-legacy-historical-script")) {
    throw new Error(
      "BLOQUEADO PELA POLÍTICA DE CURADORIA: script histórico desativado para impedir gravação direta de status PUBLISHED sem revisão humana (use /admin/importacoes e enforceImportPublicationPolicy)."
    );
  }
  console.info("=== 1. SANEAMENTO DA AUDITORIA DE GABARITOS E PROVENIÊNCIA ===\n");

  const owner = await prisma.user.findFirst();

  // 1B. Separar claramente TJSP 2024 Interior (08/09/2024) vs Capital Reaplicação (24/11/2024)
  const tjspInterior = await prisma.examEdition.findUnique({
    where: { editionCode: "TJSP-2024-ESCREVENTE" },
    include: { examForms: true },
  });

  if (tjspInterior) {
    await prisma.examEdition.update({
      where: { id: tjspInterior.id },
      data: {
        title: "TJSP 2024 — Escrevente Técnico Judiciário (TJSP2401 — 08/09/2024 — 2ª a 10ª RAJs / Interior)",
      },
    });

    // Criar edição separada para a reaplicação da Capital (24/11/2024 — anuladas #21 e #80)
    await prisma.examEdition.upsert({
      where: { editionCode: "TJSP-2024-ESCREVENTE-CAPITAL" },
      update: {
        title: "TJSP 2024 — Escrevente Técnico Judiciário (TJSP2401 — 24/11/2024 — 1ª RAJ / Capital Reaplicação)",
        examDate: new Date("2024-11-24"),
        officialNoticeUrl: "https://documento.vunesp.com.br/documento/stream/NjY2ODM2OA%3D%3D",
      },
      create: {
        positionId: tjspInterior.positionId,
        examBoardId: tjspInterior.examBoardId,
        rulesetId: tjspInterior.rulesetId,
        editionCode: "TJSP-2024-ESCREVENTE-CAPITAL",
        title: "TJSP 2024 — Escrevente Técnico Judiciário (TJSP2401 — 24/11/2024 — 1ª RAJ / Capital Reaplicação)",
        year: 2024,
        examDate: new Date("2024-11-24"),
        officialNoticeUrl: "https://documento.vunesp.com.br/documento/stream/NjY2ODM2OA%3D%3D",
        examForms: {
          create: [{ versionLabel: "Versão 1", isDefault: true }],
        },
      },
    });

    // Remover instâncias duplicadas NÃO verificadas da Versão 2 do TJSP (sem optionMappingJson)
    const v2Form = tjspInterior.examForms.find((f) => f.versionLabel === "Versão 2");
    if (v2Form) {
      const deletedV2All = await prisma.examQuestionInstance.deleteMany({
        where: { examFormId: v2Form.id },
      });
      console.info(
        `[AUDITORIA TJSP] Removidas ${deletedV2All.count} instâncias duplicadas não verificadas da Versão 2 (aguardam PDF oficial Versão 2 Vunesp).`
      );
    }

    // Rebaixar documentos locais de referência do TJSP para PENDING até envio dos PDFs oficiais Vunesp
    await prisma.sourceDocument.updateMany({
      where: { examEditionId: tjspInterior.id },
      data: {
        verificationStatus: "PENDING",
        rightsNotes:
          "Documento local de referência transcrito (não é o binário original da Vunesp, bloqueado por HTTP 403/Área do Candidato). Aguarda upload manual do PDF oficial TJSP2401 (08/09/2024 e 24/11/2024).",
      },
    });

    // Colocar as 12 amostras TJSP em AWAITING_REVIEW para não misturar com questões 100% extraídas de PDF oficial
    const tjspInstances = await prisma.examQuestionInstance.findMany({
      where: { examForm: { examEditionId: tjspInterior.id } },
      select: { questionId: true, originalNumber: true },
    });
    const tjspQIds = [...new Set(tjspInstances.map((i) => i.questionId))];
    if (tjspQIds.length > 0) {
      await prisma.question.updateMany({
        where: { id: { in: tjspQIds } },
        data: { status: "AWAITING_REVIEW", publishedAt: null },
      });
      console.info(
        `[AUDITORIA TJSP] ${tjspQIds.length} amostras TJSP 2024 movidas para AWAITING_REVIEW (divergência 08/09 vs 24/11 e ausência do PDF binário original Vunesp registradas).`
      );
    }

    if (owner) {
      const existingAudit = await prisma.contentReviewLog.findFirst({
        where: {
          entityType: "EXAM_EDITION",
          entityId: tjspInterior.id,
          action: "ANSWER_KEY_AUDIT_DIVERGENCE",
        },
      });
      if (!existingAudit) {
        await prisma.contentReviewLog.create({
          data: {
            reviewerUser: { connect: { id: owner.id } },
            entityType: "EXAM_EDITION",
            entityId: tjspInterior.id,
            action: "ANSWER_KEY_AUDIT_DIVERGENCE",
            notes:
              "Auditoria TJSP2401: confirmada existência de duas datas distintas (08/09/2024 Interior anuladas #26,#30,#64,#98 vs 24/11/2024 Capital anuladas #21,#80 conforme documento.vunesp.com.br/documento/stream/NjY2ODM2OA==). Amostras locais movidas para AWAITING_REVIEW e Versão 2 duplicada sem mapeamento removida.",
          },
        });
      }
    }
  }

  // 1C. Rebaixar amostras PCSP 2023 (hashes sintéticos sem PDF oficial) para AWAITING_REVIEW
  const pcspEdition = await prisma.examEdition.findUnique({
    where: { editionCode: "PCSP-2023-INVESTIGADOR" },
  });
  if (pcspEdition) {
    await prisma.sourceDocument.updateMany({
      where: { examEditionId: pcspEdition.id },
      data: {
        verificationStatus: "PENDING",
        rightsNotes:
          "Amostra preliminar sem PDF binário original da Vunesp (PCSP2304). Aguarda download manual da prova e gabarito definitivo na Área do Candidato Vunesp.",
      },
    });
    const pcspInstances = await prisma.examQuestionInstance.findMany({
      where: { examForm: { examEditionId: pcspEdition.id } },
      select: { questionId: true },
    });
    const pcspQIds = [...new Set(pcspInstances.map((i) => i.questionId))];
    if (pcspQIds.length > 0) {
      await prisma.question.updateMany({
        where: { id: { in: pcspQIds } },
        data: { status: "AWAITING_REVIEW", publishedAt: null },
      });
      console.info(
        `[AUDITORIA PCSP] ${pcspQIds.length} amostras PCSP 2023 movidas para AWAITING_REVIEW (sem PDF oficial Vunesp).`
      );
    }
  }

  // 1D. Limpar as 2 amostras antigas não-verificadas da OAB 41º Exame antes da importação completa oficial 80/80
  const oabEdition = await prisma.examEdition.findUnique({
    where: { editionCode: "OAB-41-1FASE" },
  });
  if (oabEdition) {
    const oldOabDocs = await prisma.sourceDocument.findMany({
      where: {
        examEditionId: oabEdition.id,
        officialUrl: "https://oab.fgv.br/",
      },
      select: { id: true },
    });
    if (oldOabDocs.length > 0) {
      const oldDocIds = oldOabDocs.map((d) => d.id);
      const oldSources = await prisma.questionSource.findMany({
        where: { sourceDocumentId: { in: oldDocIds } },
        select: { questionId: true },
      });
      const oldOabQIds = [...new Set(oldSources.map((s) => s.questionId))];
      // Delete instances pointing to old paraphrased OAB questions so official 80/80 take #1..#80 cleanly
      if (oldOabQIds.length > 0) {
        await prisma.examQuestionInstance.deleteMany({
          where: { questionId: { in: oldOabQIds } },
        });
        await prisma.question.updateMany({
          where: { id: { in: oldOabQIds } },
          data: { status: "ARCHIVED", publishedAt: null },
        });
      }
      await prisma.sourceDocument.updateMany({
        where: { id: { in: oldDocIds } },
        data: {
          verificationStatus: "REJECTED",
          rightsNotes:
            "Substituído integralmente pelos PDFs oficiais reais da FGV (552356_OAB41_TIPO1_BRANCA.pdf e 84844_OAB41_GABARITO_DEFINITIVO.pdf) após auditoria detectar paráfrase na Q1 e numeração divergente na Q5.",
        },
      });
      console.info(
        `[AUDITORIA OAB] ${oldOabQIds.length} amostras antigas arquivadas e substituídas pela prova oficial FGV 80/80.`
      );
    }
  }

  // 2. Criar edição PRF 2019 (Concurso PRF Edital 2018 / Aplicação 03/02/2019 — Cebraspe)
  const prf2021 = await prisma.examEdition.findUnique({
    where: { editionCode: "PRF-2021-POLICIAL" },
  });
  if (prf2021) {
    await prisma.examEdition.upsert({
      where: { editionCode: "PRF-2019-POLICIAL" },
      update: {
        title: "Concurso Público PRF 2018/2019 — Policial Rodoviário Federal (Prova Objetiva Completa)",
        examDate: new Date("2019-02-03"),
      },
      create: {
        positionId: prf2021.positionId,
        examBoardId: prf2021.examBoardId,
        rulesetId: prf2021.rulesetId,
        editionCode: "PRF-2019-POLICIAL",
        title: "Concurso Público PRF 2018/2019 — Policial Rodoviário Federal (Prova Objetiva Completa)",
        year: 2019,
        examDate: new Date("2019-02-03"),
        examForms: {
          create: [{ versionLabel: "Caderno Padrão", isDefault: true }],
        },
      },
    });
  }

  console.info("\n=== 2. IMPORTAÇÃO DE PROVAS OFICIAIS COMPLETAS (PDFs REAIS) ===\n");

  // 2A. PRF 2021 Itens 1–8 (Inglês) -> Completa PRF 2021 para 120/120!
  const prf21IngPayload = JSON.parse(
    await fs.readFile(
      path.join(process.cwd(), "acervo/prf_2021/import_prf2021_ing_1_8_extracted.json"),
      "utf-8"
    )
  ) as ExtractedExamPayload;
  const prf21IngSummary = await importOfficialPayload({
    payload: prf21IngPayload,
    examDocTitle: "Prova Objetiva — PRF 2021 Língua Inglesa (Cebraspe — 578_PRF_ING_01.PDF, Itens 1 a 8)",
    keyDocTitle: "Gabarito Definitivo — PRF 2021 Língua Inglesa (Cebraspe — GAB_DEFINITIVO_578_PRF_ING_01.PDF)",
    rightsNotes: "PDF oficial público obtido legitimamente do CDN Cebraspe (cdn.cebraspe.org.br/concursos/prf_21).",
    sourceDate: "2021-05-09",
    expectedQuestionCount: 8,
  });
  console.info("[A] PRF 2021 Itens 1–8 (Inglês):", prf21IngSummary);

  // 2B. PRF 2019 Completa (Itens 1–120)
  const prf19Payload = JSON.parse(
    await fs.readFile(
      path.join(process.cwd(), "acervo/prf_2019/import_prf2019_extracted.json"),
      "utf-8"
    )
  ) as ExtractedExamPayload;
  const prf19Summary = await importOfficialPayload({
    payload: prf19Payload,
    examDocTitle: "Prova Objetiva — PRF 2018/2019 (Cebraspe — 440_PRF_001_00_PAG_9.PDF, Itens 1 a 120)",
    keyDocTitle: "Gabarito Oficial Definitivo — PRF 2018/2019 (Cebraspe — GAB_DEFINITIVO_MATRIZ_440_PRF_001_00_PAG_9.PDF)",
    rightsNotes: "PDF oficial público obtido legitimamente do CDN Cebraspe (cdn.cebraspe.org.br/concursos/prf_18).",
    sourceDate: "2019-02-03",
    expectedQuestionCount: 120,
  });
  console.info("[B] PRF 2019 Completa (1–120):", prf19Summary);

  // 2C. OAB 41º Exame Completa (Questões 1–80 — Tipo 1 Branca)
  const oab41Payload = JSON.parse(
    await fs.readFile(
      path.join(process.cwd(), "acervo/oab_41/import_oab41_extracted.json"),
      "utf-8"
    )
  ) as ExtractedExamPayload;
  const oab41Summary = await importOfficialPayload({
    payload: oab41Payload,
    examDocTitle: "41º Exame de Ordem Unificado — 1ª Fase Tipo 1 Branca (FGV — 552356_ADVOGADO OAB(CNS01) Tipo 1)",
    keyDocTitle: "Gabaritos Definitivos — 41º Exame de Ordem Unificado 1ª Fase (FGV — 84844_oab242_gabarito_definitivo.pdf)",
    rightsNotes: "PDF oficial público obtido legitimamente do portal oficial FGV/OAB (oab.fgv.br/arq/644/).",
    sourceDate: "2024-07-28",
    expectedQuestionCount: 80,
  });
  console.info("[C] OAB 41º Exame Completa (1–80):", oab41Summary);

  // 3. Resumo final real no Prisma Postgres
  const [published, awaitingReview, archived, totalKeys, annulled] = await Promise.all([
    prisma.question.count({ where: { status: "PUBLISHED" } }),
    prisma.question.count({ where: { status: "AWAITING_REVIEW" } }),
    prisma.question.count({ where: { status: "ARCHIVED" } }),
    prisma.officialAnswerKey.count({ where: { isDefinitive: true } }),
    prisma.examQuestionInstance.count({ where: { isAnnulled: true } }),
  ]);

  console.info("\n=== RESUMO CONSOLIDADO PÓS-AUDITORIA E IMPORTAÇÃO ===", {
    publishedQuestions: published,
    awaitingReviewQuestions: awaitingReview,
    archivedQuestions: archived,
    definitiveAnswerKeys: totalKeys,
    annulledInstances: annulled,
  });
}

main()
  .catch((err) => {
    console.error("[ERRO REMEDIAÇÃO/IMPORTAÇÃO]", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
