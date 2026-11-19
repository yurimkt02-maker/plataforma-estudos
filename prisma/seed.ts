import "dotenv/config";
import { createHash } from "node:crypto";
import { prisma } from "../src/lib/db/prisma";
import { hashPassword } from "../src/lib/auth/password";
import { OFFICIAL_RULESETS } from "../src/features/scoring/engine";
import {
  INITIAL_EXAM_BOARDS,
  INITIAL_EXAM_EDITIONS,
  INITIAL_INSTITUTIONS,
  INITIAL_POSITIONS,
  INITIAL_STUDY_TRACKS,
  INITIAL_SUBJECTS,
  INITIAL_VERIFIED_LEGAL_SOURCES,
} from "../src/features/question-bank/catalog-data";

function sha256Text(text: string): string {
  return createHash("sha256").update(text.trim()).digest("hex");
}

async function runSeed(): Promise<void> {
  console.info("[Seed] Iniciando seed idempotente no Prisma Postgres...");

  // 1. Carreiras prioritárias
  const trackIdByCode = new Map<string, string>();
  for (const track of INITIAL_STUDY_TRACKS) {
    const record = await prisma.studyTrack.upsert({
      where: { code: track.code },
      update: {
        name: track.name,
        targetRole: track.targetRole,
        description: track.description,
        displayOrder: track.displayOrder,
        isActive: true,
      },
      create: {
        code: track.code,
        name: track.name,
        targetRole: track.targetRole,
        description: track.description,
        displayOrder: track.displayOrder,
        isActive: true,
      },
    });
    trackIdByCode.set(track.code, record.id);
  }
  console.info(`[Seed] ${trackIdByCode.size} carreiras sincronizadas.`);

  // 2. Instituições
  const institutionIdByAcronym = new Map<string, string>();
  for (const inst of INITIAL_INSTITUTIONS) {
    const record = await prisma.institution.upsert({
      where: { acronym: inst.acronym },
      update: {
        name: inst.name,
        state: inst.state,
        websiteUrl: inst.websiteUrl,
      },
      create: {
        acronym: inst.acronym,
        name: inst.name,
        state: inst.state,
        websiteUrl: inst.websiteUrl,
      },
    });
    institutionIdByAcronym.set(inst.acronym, record.id);
  }

  // 3. Bancas organizadoras
  const boardIdByAcronym = new Map<string, string>();
  for (const board of INITIAL_EXAM_BOARDS) {
    const record = await prisma.examBoard.upsert({
      where: { acronym: board.acronym },
      update: {
        name: board.name,
        websiteUrl: board.websiteUrl,
      },
      create: {
        acronym: board.acronym,
        name: board.name,
        websiteUrl: board.websiteUrl,
      },
    });
    boardIdByAcronym.set(board.acronym, record.id);
  }

  // 4. Cargos
  const positionIdByCode = new Map<string, string>();
  for (const pos of INITIAL_POSITIONS) {
    const studyTrackId = trackIdByCode.get(pos.trackCode);
    const institutionId = institutionIdByAcronym.get(pos.institutionAcronym);
    if (!studyTrackId || !institutionId) {
      throw new Error(`Referência ausente para o cargo ${pos.code}`);
    }

    const record = await prisma.position.upsert({
      where: { code: pos.code },
      update: {
        name: pos.name,
        studyTrackId,
        institutionId,
        state: pos.state,
        isActive: true,
      },
      create: {
        code: pos.code,
        name: pos.name,
        studyTrackId,
        institutionId,
        state: pos.state,
        isActive: true,
      },
    });
    positionIdByCode.set(pos.code, record.id);
  }

  // 5. Regras oficiais de pontuação (ExamRuleset)
  const rulesetIdByCode = new Map<string, string>();
  for (const ruleset of Object.values(OFFICIAL_RULESETS)) {
    const record = await prisma.examRuleset.upsert({
      where: { code: ruleset.code },
      update: {
        name: ruleset.name,
        questionType: ruleset.questionType,
        optionsCount: ruleset.questionType === "TRUE_FALSE" ? 2 : 5,
        correctPoints: ruleset.correctPoints,
        wrongPoints: ruleset.wrongPoints,
        blankPoints: ruleset.blankPoints,
        annulledPolicy: ruleset.annulledPolicy,
        minPassingPercentage: ruleset.minPassingPercentage,
      },
      create: {
        code: ruleset.code,
        name: ruleset.name,
        questionType: ruleset.questionType,
        optionsCount: ruleset.questionType === "TRUE_FALSE" ? 2 : 5,
        correctPoints: ruleset.correctPoints,
        wrongPoints: ruleset.wrongPoints,
        blankPoints: ruleset.blankPoints,
        annulledPolicy: ruleset.annulledPolicy,
        minPassingPercentage: ruleset.minPassingPercentage,
      },
    });
    rulesetIdByCode.set(ruleset.code, record.id);
  }

  // 6. Edições de prova e versões de caderno
  for (const edition of INITIAL_EXAM_EDITIONS) {
    const positionId = positionIdByCode.get(edition.positionCode);
    const examBoardId = boardIdByAcronym.get(edition.boardAcronym);
    const rulesetId = rulesetIdByCode.get(edition.rulesetCode);

    if (!positionId || !examBoardId || !rulesetId) {
      throw new Error(`Dependências ausentes para a edição ${edition.editionCode}`);
    }

    const edRecord = await prisma.examEdition.upsert({
      where: { editionCode: edition.editionCode },
      update: {
        title: edition.title,
        year: edition.year,
        examDate: new Date(edition.examDate),
        phase: edition.phase,
        officialNoticeUrl: edition.officialNoticeUrl,
        positionId,
        examBoardId,
        rulesetId,
        status: "ACTIVE",
      },
      create: {
        editionCode: edition.editionCode,
        title: edition.title,
        year: edition.year,
        examDate: new Date(edition.examDate),
        phase: edition.phase,
        officialNoticeUrl: edition.officialNoticeUrl,
        positionId,
        examBoardId,
        rulesetId,
        status: "ACTIVE",
      },
    });

    for (const form of edition.forms) {
      await prisma.examForm.upsert({
        where: {
          examEditionId_versionLabel: {
            examEditionId: edRecord.id,
            versionLabel: form.versionLabel,
          },
        },
        update: {
          colorOrType: form.colorOrType,
          isDefault: form.isDefault,
        },
        create: {
          examEditionId: edRecord.id,
          versionLabel: form.versionLabel,
          colorOrType: form.colorOrType,
          isDefault: form.isDefault,
        },
      });
    }
  }

  // 7. Disciplinas e assuntos hierárquicos
  for (const subject of INITIAL_SUBJECTS) {
    const parentRecord = await prisma.subject.upsert({
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
      const child = subject.children[idx];
      if (!child) continue;
      await prisma.subject.upsert({
        where: { slug: child.slug },
        update: {
          parentId: parentRecord.id,
          name: child.name,
          code: child.code,
          isLegalSubject: child.isLegalSubject,
          displayOrder: idx + 1,
        },
        create: {
          parentId: parentRecord.id,
          slug: child.slug,
          name: child.name,
          code: child.code,
          isLegalSubject: child.isLegalSubject,
          displayOrder: idx + 1,
        },
      });
    }
  }

  // 8. Fontes jurídicas oficiais verificadas (Planalto / Alesp)
  for (const src of INITIAL_VERIFIED_LEGAL_SOURCES) {
    const existingSource = await prisma.legalSource.findFirst({
      where: {
        authority: src.authority,
        documentNumber: src.documentNumber,
      },
    });

    const sourceRecord = existingSource
      ? await prisma.legalSource.update({
          where: { id: existingSource.id },
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

  // 9. Inicialização segura da conta do proprietário (sem credenciais fixas no código)
  const ownerEmail = process.env.OWNER_EMAIL?.trim().toLowerCase();
  const ownerPassword = process.env.OWNER_PASSWORD;
  const ownerName = process.env.OWNER_NAME?.trim() || "Proprietário";

  if (ownerEmail && ownerPassword) {
    const passwordHash = hashPassword(ownerPassword);
    const owner = await prisma.user.upsert({
      where: { email: ownerEmail },
      update: {
        name: ownerName,
        passwordHash,
        role: "OWNER",
        isActive: true,
      },
      create: {
        email: ownerEmail,
        name: ownerName,
        passwordHash,
        role: "OWNER",
        isActive: true,
      },
    });

    await prisma.userSettings.upsert({
      where: { userId: owner.id },
      update: {},
      create: {
        userId: owner.id,
        activeTrackCode: "TJSP",
        theme: "LIGHT",
        dailyGoalQuestions: 30,
      },
    });

    // Garantir criação do Caderno Automático de Erros
    const autoNotebook = await prisma.notebook.findFirst({
      where: {
        userId: owner.id,
        isSystemAutoErrors: true,
      },
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

    console.info(`[Seed] Conta privada do proprietário (${ownerEmail}) inicializada com sucesso.`);
  } else {
    console.warn(
      "[Seed] Variáveis OWNER_EMAIL e OWNER_PASSWORD não informadas no ambiente. A conta privada será criada quando essas variáveis forem definidas."
    );
  }

  console.info("[Seed] Concluído com sucesso (0 questões fictícias criadas).");
}

runSeed()
  .catch((error) => {
    console.error("[Seed] Erro fatal durante execução do seed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
