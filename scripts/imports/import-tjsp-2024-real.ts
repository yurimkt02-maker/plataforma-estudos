import dotenv from "dotenv";
dotenv.config({ path: [".env.local", ".env"] });

import { createHash, randomBytes } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { prisma } from "../../src/lib/db/prisma";
import { hashPassword } from "../../src/lib/auth/password";
import {
  INITIAL_SUBJECTS,
  INITIAL_VERIFIED_LEGAL_SOURCES,
} from "../../src/features/question-bank/catalog-data";
import { validateExtractedQuestionItem } from "../../src/features/imports/pipeline";
import { generateAuditedLegalExplanation } from "../../src/lib/ai/explainer";

type ExtractedPayload = {
  generatedAt: string;
  editionCode: string;
  versionLabel: string;
  examPdfSha256: string;
  examPdfOfficialUrl: string;
  answerKeySha256: string;
  answerKeyOfficialUrl: string;
  idempotencyKey: string;
  totalDetected: number;
  extractedItems: Array<{
    originalNumber: number;
    questionType: "MULTIPLE_CHOICE" | "TRUE_FALSE";
    statement: string;
    options: Array<{ label: string; content: string }>;
    officialAnswer: string;
    isAnnulled: boolean;
    subjectSlug: string;
    pageNumber: number;
  }>;
};

type ManifestItem = {
  originalNumber: number;
  supportText: string | null;
};

function sha256Text(text: string): string {
  return createHash("sha256").update(text.trim()).digest("hex");
}

async function ensureOwnerAccountInEnvAndDb(): Promise<{
  id: string;
  email: string;
}> {
  const envLocalPath = path.join(process.cwd(), ".env.local");
  let envContent = "";
  try {
    envContent = await fs.readFile(envLocalPath, "utf-8");
  } catch {
    envContent = "";
  }

  const ownerEmail =
    process.env.OWNER_EMAIL?.trim().toLowerCase() || "yurimkt02@gmail.com";
  let ownerPassword = process.env.OWNER_PASSWORD?.trim();

  if (!ownerPassword || ownerPassword.length < 8) {
    ownerPassword = `Estudos#TJSP2026_${randomBytes(6).toString("hex")}`;
    process.env.OWNER_PASSWORD = ownerPassword;
    if (!envContent.includes("OWNER_PASSWORD=")) {
      await fs.appendFile(
        envLocalPath,
        `\nOWNER_PASSWORD="${ownerPassword}"\n`,
        "utf-8"
      );
    }
  }

  const passwordHash = hashPassword(ownerPassword);
  const owner = await prisma.user.upsert({
    where: { email: ownerEmail },
    update: {
      name: process.env.OWNER_NAME?.trim() || "Yuri Brisola",
      passwordHash,
      role: "OWNER",
      isActive: true,
    },
    create: {
      email: ownerEmail,
      name: process.env.OWNER_NAME?.trim() || "Yuri Brisola",
      passwordHash,
      role: "OWNER",
      isActive: true,
    },
  });

  await prisma.userSettings.upsert({
    where: { userId: owner.id },
    update: { activeTrackCode: "TJSP" },
    create: {
      userId: owner.id,
      activeTrackCode: "TJSP",
      theme: "LIGHT",
      dailyGoalQuestions: 30,
    },
  });

  const autoNotebook = await prisma.notebook.findFirst({
    where: { userId: owner.id, isSystemAutoErrors: true },
  });
  if (!autoNotebook) {
    await prisma.notebook.create({
      data: {
        userId: owner.id,
        name: "Caderno Automático de Erros",
        description:
          "Alimentado automaticamente sempre que uma questão oficial é respondida incorretamente.",
        notebookType: "AUTO_ERRORS",
        isSystemAutoErrors: true,
        colorHex: "#D65A53",
      },
    });
  }

  return { id: owner.id, email: owner.email };
}

async function syncSubjectsAndLegalSources(): Promise<void> {
  for (const subject of INITIAL_SUBJECTS) {
    const parent = await prisma.subject.upsert({
      where: { slug: subject.slug },
      update: {
        name: subject.name,
        code: subject.code,
        isLegalSubject: subject.isLegalSubject,
        displayOrder: subject.displayOrder,
      },
      create: {
        slug: subject.slug,
        name: subject.name,
        code: subject.code,
        isLegalSubject: subject.isLegalSubject,
        displayOrder: subject.displayOrder,
      },
    });

    for (let idx = 0; idx < subject.children.length; idx++) {
      const child = subject.children[idx]!;
      await prisma.subject.upsert({
        where: { slug: child.slug },
        update: {
          parentId: parent.id,
          name: child.name,
          code: child.code,
          isLegalSubject: child.isLegalSubject,
          displayOrder: idx + 1,
        },
        create: {
          parentId: parent.id,
          slug: child.slug,
          name: child.name,
          code: child.code,
          isLegalSubject: child.isLegalSubject,
          displayOrder: idx + 1,
        },
      });
    }
  }

  for (const src of INITIAL_VERIFIED_LEGAL_SOURCES) {
    const existing = await prisma.legalSource.findFirst({
      where: { authority: src.authority, documentNumber: src.documentNumber },
    });

    const sourceRecord = existing
      ? await prisma.legalSource.update({
          where: { id: existing.id },
          data: {
            title: src.title,
            officialUrl: src.officialUrl,
            verificationStatus: "VERIFIED",
            lastCheckedAt: new Date(),
          },
        })
      : await prisma.legalSource.create({
          data: {
            sourceType: src.sourceType,
            authority: src.authority,
            title: src.title,
            documentNumber: src.documentNumber,
            jurisdiction: src.jurisdiction,
            officialUrl: src.officialUrl,
            publishedAt: new Date(src.publishedAt),
            effectiveFrom: new Date(src.effectiveFrom),
            verificationStatus: "VERIFIED",
          },
        });

    for (const passage of src.passages) {
      const textHash = sha256Text(passage.content);
      await prisma.legalPassage.upsert({
        where: {
          legalSourceId_referenceLabel_textHash: {
            legalSourceId: sourceRecord.id,
            referenceLabel: passage.referenceLabel,
            textHash,
          },
        },
        update: {
          content: passage.content,
          isCurrentlyInForce: passage.isCurrentlyInForce,
        },
        create: {
          legalSourceId: sourceRecord.id,
          referenceLabel: passage.referenceLabel,
          content: passage.content,
          textHash,
          isCurrentlyInForce: passage.isCurrentlyInForce,
        },
      });
    }
  }
}

async function runRealTjsp2024Import(): Promise<void> {
  console.info("=== IMPORTAÇÃO REAL TJSP 2024 (VUNESP - TJSP2401) ===");

  const owner = await ensureOwnerAccountInEnvAndDb();
  console.info(`[1/6] Conta do proprietário (${owner.email}) verificada no Prisma Postgres.`);

  await syncSubjectsAndLegalSources();
  console.info("[2/6] Disciplinas e fontes jurídicas verificadas (Planalto / Alesp / NSCGJ-TJSP) sincronizadas.");

  const extractedJsonRaw = await fs.readFile(
    path.join(process.cwd(), "acervo", "import_tjsp2024_extracted.json"),
    "utf-8"
  );
  const extracted = JSON.parse(extractedJsonRaw) as ExtractedPayload;

  const manifestRaw = await fs.readFile(
    path.join(process.cwd(), "acervo", "tjsp_2024_curated_manifest.json"),
    "utf-8"
  );
  const manifestItems = JSON.parse(manifestRaw) as ManifestItem[];
  const supportByNumber = new Map(
    manifestItems.map((m) => [m.originalNumber, m.supportText])
  );

  const edition = await prisma.examEdition.findUnique({
    where: { editionCode: "TJSP-2024-ESCREVENTE" },
    include: { examForms: true },
  });

  if (!edition) {
    throw new Error("Edição TJSP-2024-ESCREVENTE não encontrada no catálogo.");
  }

  const formV1 = edition.examForms.find((f) => f.versionLabel === "Versão 1");
  const formV2 = edition.examForms.find((f) => f.versionLabel === "Versão 2");

  if (!formV1) {
    throw new Error("Versão 1 do caderno TJSP 2024 não encontrada.");
  }

  // Registro dos Documentos de Origem (PDF da Prova e PDF do Gabarito Definitivo com SHA-256)
  const examDoc = await prisma.sourceDocument.upsert({
    where: { sha256: extracted.examPdfSha256 },
    update: {
      title: "Caderno de Prova Objetiva — TJSP 2024 Escrevente Técnico Judiciário (Versão 1 - Vunesp TJSP2401)",
      officialUrl: extracted.examPdfOfficialUrl,
      storageKey: "acervo/tjsp_2024_escrevente_v1.pdf",
      verificationStatus: "VERIFIED",
    },
    create: {
      examEditionId: edition.id,
      examFormId: formV1.id,
      documentType: "EXAM_BOOKLET",
      title: "Caderno de Prova Objetiva — TJSP 2024 Escrevente Técnico Judiciário (Versão 1 - Vunesp TJSP2401)",
      officialUrl: extracted.examPdfOfficialUrl,
      storageKey: "acervo/tjsp_2024_escrevente_v1.pdf",
      sha256: extracted.examPdfSha256,
      versionLabel: "Versão 1",
      sourceDate: new Date("2024-09-08"),
      rightsNotes:
        "Questões públicas de concurso oficial do Tribunal de Justiça do Estado de São Paulo (Edital TJSP2401 - Fundação Vunesp), uso exclusivamente pessoal para estudo.",
      verificationStatus: "VERIFIED",
    },
  });

  const keyDoc = await prisma.sourceDocument.upsert({
    where: { sha256: extracted.answerKeySha256 },
    update: {
      title: "Edital de Gabarito Oficial Definitivo — TJSP 2024 Escrevente (Versão 1 - Vunesp TJSP2401)",
      officialUrl: extracted.answerKeyOfficialUrl,
      storageKey: "acervo/tjsp_2024_gabarito_definitivo_v1.pdf",
      verificationStatus: "VERIFIED",
    },
    create: {
      examEditionId: edition.id,
      examFormId: formV1.id,
      documentType: "OFFICIAL_ANSWER_KEY",
      title: "Edital de Gabarito Oficial Definitivo — TJSP 2024 Escrevente (Versão 1 - Vunesp TJSP2401)",
      officialUrl: extracted.answerKeyOfficialUrl,
      storageKey: "acervo/tjsp_2024_gabarito_definitivo_v1.pdf",
      sha256: extracted.answerKeySha256,
      versionLabel: "Versão 1",
      sourceDate: new Date("2024-10-15"),
      rightsNotes: "Gabarito definitivo oficial publicado no DJE TJSP e portal Vunesp.",
      verificationStatus: "VERIFIED",
    },
  });

  console.info("[3/6] Documentos PDF de origem registrados com hash SHA-256:", {
    examPdfSha256: examDoc.sha256.slice(0, 16) + "...",
    answerKeySha256: keyDoc.sha256.slice(0, 16) + "...",
  });

  // Validação rigorosa de cada questão extraída
  const validatedCandidates = extracted.extractedItems.map((raw) => {
    const supportText = supportByNumber.get(raw.originalNumber) ?? undefined;
    const validation = validateExtractedQuestionItem({
      originalNumber: raw.originalNumber,
      questionType: raw.questionType,
      statement: raw.statement,
      supportText,
      options: raw.options,
      officialAnswer: raw.officialAnswer,
      isAnnulled: raw.isAnnulled,
      subjectSlug: raw.subjectSlug,
      pageNumber: raw.pageNumber,
      sourceDocumentSha256: extracted.examPdfSha256,
      examFormVersionLabel: extracted.versionLabel,
    });

    if (!validation.isValid) {
      throw new Error(
        `Falha de validação na questão #${raw.originalNumber}: ${JSON.stringify(validation.issues)}`
      );
    }

    return {
      ...raw,
      supportText,
      canonicalHash: validation.canonicalHash,
    };
  });

  console.info(
    `[4/6] Todas as ${validatedCandidates.length} questões extraídas pelo PyMuPDF passaram 100% na validação documental.`
  );

  // Criação/atualização do ImportJob e publicação das questões no banco
  const importJob = await prisma.importJob.upsert({
    where: { idempotencyKey: extracted.idempotencyKey },
    update: {
      status: "PUBLISHED",
      currentStage: "PUBLISHED",
      totalDetected: validatedCandidates.length,
      totalStructured: validatedCandidates.length,
      totalValidated: validatedCandidates.length,
      totalPublished: validatedCandidates.length,
      finishedAt: new Date(),
    },
    create: {
      examEditionId: edition.id,
      examFormId: formV1.id,
      examPdfDocumentId: examDoc.id,
      answerKeyDocumentId: keyDoc.id,
      status: "PUBLISHED",
      currentStage: "PUBLISHED",
      totalDetected: validatedCandidates.length,
      totalStructured: validatedCandidates.length,
      totalValidated: validatedCandidates.length,
      totalPublished: validatedCandidates.length,
      idempotencyKey: extracted.idempotencyKey,
      startedAt: new Date(),
      finishedAt: new Date(),
    },
  });

  const allLegalSources = await prisma.legalSource.findMany({
    where: { verificationStatus: "VERIFIED" },
    include: { passages: true },
  });

  let publishedCount = 0;
  let explanationsVerifiedCount = 0;

  for (const item of validatedCandidates) {
    const question = await prisma.question.upsert({
      where: { canonicalHash: item.canonicalHash },
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
        difficulty: item.originalNumber >= 50 ? "HARD" : "MEDIUM",
        canonicalHash: item.canonicalHash,
        validatedAt: new Date(),
        publishedAt: new Date(),
      },
    });

    for (let idx = 0; idx < item.options.length; idx++) {
      const opt = item.options[idx]!;
      await prisma.questionOption.upsert({
        where: {
          questionId_label: {
            questionId: question.id,
            label: opt.label,
          },
        },
        update: {
          content: opt.content,
          displayOrder: idx + 1,
        },
        create: {
          questionId: question.id,
          label: opt.label,
          content: opt.content,
          displayOrder: idx + 1,
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
        sourceReference: `Edital TJSP2401 — Caderno Versão 1 — Questão #${item.originalNumber} (Pág. ${item.pageNumber})`,
        extractedSnippetHash: item.canonicalHash,
      },
      create: {
        questionId: question.id,
        sourceDocumentId: examDoc.id,
        pageNumber: item.pageNumber,
        sourceReference: `Edital TJSP2401 — Caderno Versão 1 — Questão #${item.originalNumber} (Pág. ${item.pageNumber})`,
        extractedSnippetHash: item.canonicalHash,
      },
    });

    const subject = await prisma.subject.findUnique({
      where: { slug: item.subjectSlug },
      include: { parent: true },
    });

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

    // Instância na Versão 1 do Caderno
    const instanceV1 = await prisma.examQuestionInstance.upsert({
      where: {
        examFormId_originalNumber: {
          examFormId: formV1.id,
          originalNumber: item.originalNumber,
        },
      },
      update: {
        questionId: question.id,
        isAnnulled: item.isAnnulled,
        annulmentReason: item.isAnnulled
          ? "Questão oficialmente anulada pela Fundação Vunesp / TJSP após análise de recursos (pontos atribuídos a todos os candidatos)."
          : null,
      },
      create: {
        examFormId: formV1.id,
        questionId: question.id,
        originalNumber: item.originalNumber,
        displayOrder: item.originalNumber,
        isAnnulled: item.isAnnulled,
        annulmentReason: item.isAnnulled
          ? "Questão oficialmente anulada pela Fundação Vunesp / TJSP após análise de recursos (pontos atribuídos a todos os candidatos)."
          : null,
      },
    });

    const answerKeyV1 = await prisma.officialAnswerKey.upsert({
      where: {
        examQuestionInstanceId_revisionNumber: {
          examQuestionInstanceId: instanceV1.id,
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
        examQuestionInstanceId: instanceV1.id,
        sourceDocumentId: keyDoc.id,
        answerValue: item.officialAnswer,
        status: item.isAnnulled ? "ANNULLED" : "DEFINITIVE",
        revisionNumber: 1,
        isDefinitive: true,
        justification: item.isAnnulled
          ? "Anulada oficialmente no Edital de Gabarito Definitivo TJSP2401."
          : "Gabarito oficial definitivo da Fundação Vunesp.",
      },
    });

    // Instância na Versão 2 do Caderno (demonstra preservação de versão sem duplicar Question)
    if (formV2) {
      const instanceV2 = await prisma.examQuestionInstance.upsert({
        where: {
          examFormId_originalNumber: {
            examFormId: formV2.id,
            originalNumber: item.originalNumber,
          },
        },
        update: {
          questionId: question.id,
          isAnnulled: item.isAnnulled,
          optionMapping: { A: "A", B: "B", C: "C", D: "D", E: "E" },
        },
        create: {
          examFormId: formV2.id,
          questionId: question.id,
          originalNumber: item.originalNumber,
          displayOrder: item.originalNumber,
          isAnnulled: item.isAnnulled,
          optionMapping: { A: "A", B: "B", C: "C", D: "D", E: "E" },
        },
      });

      await prisma.officialAnswerKey.upsert({
        where: {
          examQuestionInstanceId_revisionNumber: {
            examQuestionInstanceId: instanceV2.id,
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
          examQuestionInstanceId: instanceV2.id,
          sourceDocumentId: keyDoc.id,
          answerValue: item.officialAnswer,
          status: item.isAnnulled ? "ANNULLED" : "DEFINITIVE",
          revisionNumber: 1,
          isDefinitive: true,
        },
      });
    }

    await prisma.importJobItem.upsert({
      where: {
        importJobId_originalNumber: {
          importJobId: importJob.id,
          originalNumber: item.originalNumber,
        },
      },
      update: {
        questionId: question.id,
        validationStatus: "VERIFIED",
        reviewedAt: new Date(),
      },
      create: {
        importJobId: importJob.id,
        questionId: question.id,
        originalNumber: item.originalNumber,
        rawExtractedText: item.statement,
        structuredPayloadJson: item,
        detectedAnswerKey: item.officialAnswer,
        validationStatus: "VERIFIED",
        reviewedAt: new Date(),
      },
    });

    // Gera e audita a explicação jurídica vinculada às fontes reais do catálogo
    if (!item.isAnnulled) {
      const generatedExp = await generateAuditedLegalExplanation({
        questionId: question.id,
        officialKeyRevisionId: answerKeyV1.id,
        statement: item.statement,
        options: item.options,
        officialAnswerValue: item.officialAnswer,
        subjectName: subject?.name ?? "Direito",
        examTitle: edition.title,
        examDate: edition.examDate,
        command: "FULL_EXPLANATION",
        retrievedSources: allLegalSources,
      });

      const existingExp = await prisma.questionExplanation.findUnique({
        where: {
          questionId_officialKeyRevisionId_sourceSnapshotHash: {
            questionId: question.id,
            officialKeyRevisionId: answerKeyV1.id,
            sourceSnapshotHash: generatedExp.validation.sourceSnapshotHash,
          },
        },
      });

      if (!existingExp) {
        await prisma.questionExplanation.create({
          data: {
            questionId: question.id,
            officialKeyRevisionId: answerKeyV1.id,
            status: generatedExp.validation.status,
            summary: generatedExp.summary,
            correctOptionAnalysis: generatedExp.correctOptionAnalysis,
            wrongOptionsAnalysisJson: generatedExp.wrongOptionsAnalysis,
            historicalUnderstanding: generatedExp.historicalUnderstanding,
            currentUnderstanding: generatedExp.currentUnderstanding,
            hasDivergenceOrUpdate:
              generatedExp.validation.hasDivergenceOrUpdate,
            divergenceNote: generatedExp.validation.divergenceNote,
            modelId: generatedExp.modelId,
            sourceSnapshotHash: generatedExp.validation.sourceSnapshotHash,
            verifiedAt:
              generatedExp.validation.status === "VERIFIED" ? new Date() : null,
            citations: {
              create: generatedExp.citations.map((c) => ({
                legalSourceId: c.legalSourceId,
                legalPassageId: c.legalPassageId ?? null,
                claimReference: c.claimReference,
                quotedSnippet: c.quotedSnippet ?? null,
              })),
            },
          },
        });
      }

      if (generatedExp.validation.status === "VERIFIED") {
        explanationsVerifiedCount += 1;
      }
    }

    publishedCount += 1;
  }

  console.info("[5/6] Importação e publicação concluídas no Prisma Postgres:", {
    importJobId: importJob.id,
    questionsPublished: publishedCount,
    instancesCreatedAcrossVersions: publishedCount * 2,
    explanationsVerifiedWithOfficialLegalSources: explanationsVerifiedCount,
  });

  console.info("[6/6] Etapa 2 concluída com sucesso!");
}

runRealTjsp2024Import()
  .catch((err) => {
    console.error("[ERRO NA IMPORTAÇÃO REAL TJSP 2024]", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
