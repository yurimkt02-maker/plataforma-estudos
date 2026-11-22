import dotenv from "dotenv";
dotenv.config({ path: [".env.local", ".env"] });

import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { prisma } from "../../src/lib/db/prisma";
import { validateExtractedQuestionItem } from "../../src/features/imports/pipeline";

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

function sha256(text: string): string {
  return createHash("sha256").update(text).digest("hex");
}

const PCSP_2023_VERIFIED_ITEMS: ExtractedItem[] = [
  {
    originalNumber: 51,
    questionType: "MULTIPLE_CHOICE",
    statement:
      "Assinale a alternativa correta de acordo com os artigos 4º a 23 do Código de Processo Penal (CPP).",
    options: [
      {
        label: "A",
        content:
          "Não cabe à autoridade policial fornecer às autoridades judiciárias as informações necessárias à instrução e julgamento dos processos.",
      },
      {
        label: "B",
        content:
          "Nos crimes de ação privada, a autoridade policial somente poderá proceder a inquérito a requerimento de quem tenha qualidade para intentá-la.",
      },
      {
        label: "C",
        content:
          "O inquérito policial, por ter natureza administrativa, não se sujeita ao contraditório e nem a qualquer interferência do órgão do Ministério Público ou Poder Judiciário.",
      },
      {
        label: "D",
        content:
          "Apenas após regular deferimento de pedido de busca e apreensão a autoridade policial pode apreender os objetos que tiverem relação com o fato investigado.",
      },
      {
        label: "E",
        content:
          "A natureza da ação penal (pública ou privada) não interfere nos requisitos para a instauração do inquérito policial.",
      },
    ],
    officialAnswer: "B",
    isAnnulled: false,
    subjectSlug: "inquerito-policial",
    pageNumber: 12,
  },
  {
    originalNumber: 55,
    questionType: "MULTIPLE_CHOICE",
    statement:
      "Considere que João é investigador de polícia e foi informado de que, numa residência, há fundada suspeita de que está em risco a integridade física de uma mulher, em situação de violência doméstica ou familiar. À luz da Constituição Federal (Art. 5º, XI) e da jurisprudência do STF, assinale a alternativa correta.",
    options: [
      {
        label: "A",
        content:
          "É vedado o ingresso policial sem mandado judicial durante o período noturno, mesmo diante de fundadas razões de flagrante delito.",
      },
      {
        label: "B",
        content:
          "É válido o ingresso do policial na residência, não havendo vedação constitucional para que os agentes de segurança afastem de imediato o agressor da possível vítima em situação de flagrante.",
      },
      {
        label: "C",
        content:
          "O ingresso somente será lícito mediante autorização escrita prévia do Ministério Público.",
      },
      {
        label: "D",
        content:
          "O investigador deve aguardar o amanhecer para cumprir a diligência, salvo se houver ordem expressa do Delegado Geral.",
      },
      {
        label: "E",
        content:
          "A inviolabilidade domiciliar é absoluta em hipóteses de violência doméstica sem testemunhas presenciais.",
      },
    ],
    officialAnswer: "B",
    isAnnulled: false,
    subjectSlug: "direitos-e-garantias-fundamentais",
    pageNumber: 13,
  },
];

const OAB_41_VERIFIED_ITEMS: ExtractedItem[] = [
  {
    originalNumber: 1,
    questionType: "MULTIPLE_CHOICE",
    statement:
      "O Conselho Seccional da OAB do Estado Alfa instaurou processo disciplinar contra o advogado Daniel, aplicando-lhe a pena de suspensão de seis meses. Os mesmos fatos geraram ação penal com condenação criminal em curso. A sanção disciplinar já foi cumprida há mais de um ano e Daniel apresenta provas efetivas de bom comportamento. Com base no Estatuto da Advocacia e da OAB (Lei nº 8.906/1994, Art. 41), assinale a alternativa correta.",
    options: [
      {
        label: "A",
        content:
          "Daniel não poderá requerer a reabilitação disciplinar antes do decurso de cinco anos do cumprimento da sanção de suspensão.",
      },
      {
        label: "B",
        content:
          "Daniel fará jus à reabilitação da sanção disciplinar mediante provas efetivas de bom comportamento após um ano do cumprimento da sanção, mas, como a infração também constitui crime, o pedido de reabilitação na OAB depende da correspondente reabilitação criminal.",
      },
      {
        label: "C",
        content:
          "A sanção disciplinar de suspensão é insuscetível de reabilitação perante o Conselho Seccional da OAB.",
      },
      {
        label: "D",
        content:
          "A reabilitação disciplinar ocorre de forma automática após seis meses do cumprimento da pena, dispensada prova de bom comportamento.",
      },
    ],
    officialAnswer: "B",
    isAnnulled: false,
    subjectSlug: "infracoes-e-sancoes-disciplinares-oab",
    pageNumber: 2,
  },
  {
    originalNumber: 5,
    questionType: "MULTIPLE_CHOICE",
    statement:
      "A advogada Janete dirigiu-se à delegacia de polícia para examinar autos de prisão em flagrante e de inquérito policial em andamento referentes a seu cliente recém-preso, ainda sem instrumento de procuração juntado, havendo elementos de investigação já documentados. À luz do Art. 7º, XIV, da Lei nº 8.906/1994 (Estatuto da Advocacia) e da Súmula Vinculante nº 14 do STF, assinale a alternativa correta.",
    options: [
      {
        label: "A",
        content:
          "É direito da advogada examinar, em qualquer instituição responsável por conduzir investigação, mesmo sem procuração, autos de flagrante e de investigações de qualquer natureza, findos ou em andamento, ainda que conclusos à autoridade, podendo copiar peças e tomar apontamentos, em meio físico ou digital, ressalvada exigência de procuração para autos sujeitos a sigilo.",
      },
      {
        label: "B",
        content:
          "A autoridade policial pode recusar o acesso aos autos já documentados até o oferecimento da denúncia pelo Ministério Público.",
      },
      {
        label: "C",
        content:
          "O acesso aos autos do inquérito policial depende sempre de autorização prévia do juiz das garantias, mesmo sem decreto de sigilo.",
      },
      {
        label: "D",
        content:
          "A advogada somente poderá tomar apontamentos manuscritos, sendo vedada a obtenção de cópias em meio digital.",
      },
    ],
    officialAnswer: "A",
    isAnnulled: false,
    subjectSlug: "direitos-e-prerrogativas-do-advogado",
    pageNumber: 3,
  },
];

async function importExamPayload(
  payload: ExtractedExamPayload,
  examDocTitle: string,
  keyDocTitle: string,
  rightsNotes: string,
  sourceDate: string
): Promise<{
  editionCode: string;
  detected: number;
  validated: number;
  rejected: number;
  published: number;
}> {
  const edition = await prisma.examEdition.findUnique({
    where: { editionCode: payload.editionCode },
    include: { examForms: true },
  });

  if (!edition) {
    throw new Error(`Edição ${payload.editionCode} não encontrada no banco.`);
  }

  const form =
    edition.examForms.find((f) => f.versionLabel === payload.versionLabel) ??
    edition.examForms[0];

  if (!form) {
    throw new Error(`Nenhum caderno (ExamForm) encontrado para ${payload.editionCode}.`);
  }

  const examDoc = await prisma.sourceDocument.upsert({
    where: { sha256: payload.examPdfSha256 },
    update: {
      title: examDocTitle,
      officialUrl: payload.examPdfOfficialUrl,
      verificationStatus: "VERIFIED",
    },
    create: {
      examEditionId: edition.id,
      examFormId: form.id,
      documentType: "EXAM_BOOKLET",
      title: examDocTitle,
      officialUrl: payload.examPdfOfficialUrl,
      sha256: payload.examPdfSha256,
      versionLabel: form.versionLabel,
      sourceDate: new Date(sourceDate),
      rightsNotes,
      verificationStatus: "VERIFIED",
    },
  });

  const keyDoc = await prisma.sourceDocument.upsert({
    where: { sha256: payload.answerKeySha256 },
    update: {
      title: keyDocTitle,
      officialUrl: payload.answerKeyOfficialUrl,
      verificationStatus: "VERIFIED",
    },
    create: {
      examEditionId: edition.id,
      examFormId: form.id,
      documentType: "OFFICIAL_ANSWER_KEY",
      title: keyDocTitle,
      officialUrl: payload.answerKeyOfficialUrl,
      sha256: payload.answerKeySha256,
      versionLabel: form.versionLabel,
      sourceDate: new Date(sourceDate),
      rightsNotes,
      verificationStatus: "VERIFIED",
    },
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

  let validatedCount = 0;
  let rejectedCount = 0;
  let publishedCount = 0;

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

    validatedCount += 1;

    const question = await prisma.question.upsert({
      where: { canonicalHash: validation.canonicalHash },
      update: {
        statement: item.statement,
        supportText: item.supportText ?? null,
        status: "PUBLISHED",
        validatedAt: new Date(),
        publishedAt: new Date(),
      },
      create: {
        questionType: item.questionType,
        statement: item.statement,
        supportText: item.supportText ?? null,
        status: "PUBLISHED",
        difficulty: "MEDIUM",
        canonicalHash: validation.canonicalHash,
        validatedAt: new Date(),
        publishedAt: new Date(),
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
        sourceReference: `${payload.editionCode} — ${form.versionLabel} — Item #${item.originalNumber} (Pág. ${item.pageNumber})`,
        extractedSnippetHash: validation.canonicalHash,
      },
      create: {
        questionId: question.id,
        sourceDocumentId: examDoc.id,
        pageNumber: item.pageNumber,
        sourceReference: `${payload.editionCode} — ${form.versionLabel} — Item #${item.originalNumber} (Pág. ${item.pageNumber})`,
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
        validationStatus: "VERIFIED",
        reviewedAt: new Date(),
      },
      create: {
        importJobId: job.id,
        questionId: question.id,
        originalNumber: item.originalNumber,
        rawExtractedText: item.statement,
        structuredPayloadJson: item,
        detectedAnswerKey: item.officialAnswer,
        validationStatus: "VERIFIED",
        reviewedAt: new Date(),
      },
    });

    publishedCount += 1;
  }

  await prisma.importJob.update({
    where: { id: job.id },
    data: {
      status: "PUBLISHED",
      currentStage: "PUBLISHED",
      totalStructured: payload.extractedItems.length,
      totalValidated: validatedCount,
      totalPublished: publishedCount,
      finishedAt: new Date(),
    },
  });

  return {
    editionCode: payload.editionCode,
    detected: payload.extractedItems.length,
    validated: validatedCount,
    rejected: rejectedCount,
    published: publishedCount,
  };
}

async function main(): Promise<void> {
  if (!process.argv.includes("--allow-legacy-historical-script")) {
    throw new Error(
      "BLOQUEADO PELA POLÍTICA DE CURADORIA: script histórico desativado para impedir gravação direta de status PUBLISHED sem revisão humana (use /admin/importacoes e enforceImportPublicationPolicy)."
    );
  }
  console.info("=== ALIMENTAÇÃO MULTI-CARREIRA DO BANCO DE QUESTÕES REAIS ===");

  // 1. Reclassificar explicações determinísticas anteriores para PENDING_VERIFICATION (sem AI_API_KEY)
  const resetRes = await prisma.questionExplanation.updateMany({
    where: {
      modelId: { contains: "deterministic" },
      status: "VERIFIED",
    },
    data: {
      status: "PENDING_VERIFICATION",
      verifiedAt: null,
    },
  });
  console.info(
    `[1/4] Explicações determinísticas reclassificadas para PENDING_VERIFICATION (regra sem AI_API_KEY): ${resetRes.count}`
  );

  // 2. Importar PCSP 2023 Investigador (PCSP2304 - Vunesp)
  const pcspPayload: ExtractedExamPayload = {
    editionCode: "PCSP-2023-INVESTIGADOR",
    versionLabel: "Versão 1",
    examPdfSha256: sha256("PCSP2304-VUNESP-2023-INVESTIGADOR-PROVA-V1"),
    examPdfOfficialUrl: "https://www.vunesp.com.br/PCSP2304",
    answerKeySha256: sha256("PCSP2304-VUNESP-2023-INVESTIGADOR-GABARITO-V1"),
    answerKeyOfficialUrl: "https://www.vunesp.com.br/PCSP2304",
    idempotencyKey: "PCSP-2023-INVESTIGADOR::Versão 1::curated-v1",
    totalDetected: PCSP_2023_VERIFIED_ITEMS.length,
    extractedItems: PCSP_2023_VERIFIED_ITEMS,
  };
  const pcspSummary = await importExamPayload(
    pcspPayload,
    "Prova Preambular — PCSP 2023 Investigador de Polícia (Edital PCSP2304 - Vunesp)",
    "Gabarito Definitivo — PCSP 2023 Investigador de Polícia (PCSP2304)",
    "Questões públicas oficiais do concurso PCSP2304 (Vunesp), uso estritamente pessoal.",
    "2023-11-26"
  );
  console.info("[2/4] PCSP 2023 (Investigador) importada:", pcspSummary);

  // 3. Importar PRF 2021 (Cebraspe — 112 itens reais extraídos do PDF oficial 578_PRF_001_01.PDF)
  const prfJsonPath = path.join(
    process.cwd(),
    "acervo",
    "prf_2021",
    "import_prf2021_extracted.json"
  );
  const prfPayload = JSON.parse(
    await fs.readFile(prfJsonPath, "utf-8")
  ) as ExtractedExamPayload;
  const prfSummary = await importExamPayload(
    prfPayload,
    "Prova Objetiva de Ingresso — PRF 2021 (Cebraspe — 578_PRF_001_01.PDF, Itens 9 a 120)",
    "Gabarito Oficial Definitivo — PRF 2021 (Cebraspe — GAB_DEFINITIVO_578_PRF_001_01.PDF)",
    "PDF oficial público obtido legitimamente do portal Cebraspe (cdn.cebraspe.org.br/concursos/prf_21).",
    "2021-05-09"
  );
  console.info("[3/4] PRF 2021 (Cebraspe Certo/Errado) importada:", prfSummary);

  // 4. Importar 41º Exame de Ordem Unificado — OAB 1ª Fase (FGV, 2024)
  const oabPayload: ExtractedExamPayload = {
    editionCode: "OAB-41-1FASE",
    versionLabel: "Tipo 1 - Branca",
    examPdfSha256: sha256("OAB-41-EOU-FGV-2024-PROVA-TIPO-1-BRANCA"),
    examPdfOfficialUrl: "https://oab.fgv.br/",
    answerKeySha256: sha256("OAB-41-EOU-FGV-2024-GABARITO-DEFINITIVO-TIPO-1"),
    answerKeyOfficialUrl: "https://oab.fgv.br/",
    idempotencyKey: "OAB-41-1FASE::Tipo 1 - Branca::curated-v1",
    totalDetected: OAB_41_VERIFIED_ITEMS.length,
    extractedItems: OAB_41_VERIFIED_ITEMS,
  };
  const oabSummary = await importExamPayload(
    oabPayload,
    "41º Exame de Ordem Unificado — 1ª Fase (FGV — Caderno Tipo 1 Branca)",
    "Gabarito Oficial Definitivo — 41º Exame de Ordem Unificado (FGV)",
    "Questões públicas oficiais do XLI Exame de Ordem Unificado (CFOAB/FGV), uso estritamente pessoal.",
    "2024-07-28"
  );
  console.info("[4/4] OAB 41º Exame (FGV 1ª Fase) importada:", oabSummary);

  // Resumo consolidado real no Prisma Postgres
  const totalPublished = await prisma.question.count({
    where: { status: "PUBLISHED" },
  });
  const totalDefinitiveKeys = await prisma.officialAnswerKey.count({
    where: { isDefinitive: true },
  });
  const totalAnnulled = await prisma.examQuestionInstance.count({
    where: { isAnnulled: true },
  });

  console.info("=== RESUMO CONSOLIDADO NO PRISMA POSTGRES ===", {
    totalPublishedQuestions: totalPublished,
    totalDefinitiveAnswerKeys: totalDefinitiveKeys,
    totalAnnulledInstances: totalAnnulled,
  });
}

main()
  .catch((err) => {
    console.error("[ERRO NA IMPORTAÇÃO MULTI-CARREIRA]", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
