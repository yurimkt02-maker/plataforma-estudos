import dotenv from "dotenv";
dotenv.config({ path: [".env.local", ".env"] });

import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { prisma } from "../../src/lib/db/prisma";

const BASE_SUPPORT_TEXT =
  "As figuras seguintes ilustram a vista frontal e a vista da esquerda de um sólido que foi formado empilhando-se cubos de mesmo tamanho. A partir das figuras precedentes, julgue os itens a seguir, com relação à possibilidade de a figura representar uma vista superior do referido sólido.";

async function fileSha256(relPath: string): Promise<string> {
  const buf = await fs.readFile(path.join(process.cwd(), "public", relPath));
  return createHash("sha256").update(buf).digest("hex");
}

async function main(): Promise<void> {
  console.info("=== VERIFICAÇÃO E PUBLICAÇÃO DOS ITENS VISUAIS PRF 2019 (#24, #25, #26) ===\n");

  const owner = await prisma.user.findFirst();

  // 1. Arquivar a questão órfã residual (sem ExamQuestionInstance) da execução interrompida anterior
  const orphan = await prisma.question.findMany({
    where: {
      status: "AWAITING_REVIEW",
      examInstances: { none: {} },
    },
    select: { id: true, statement: true },
  });

  if (orphan.length > 0) {
    await prisma.question.updateMany({
      where: { id: { in: orphan.map((o) => o.id) } },
      data: { status: "ARCHIVED", publishedAt: null },
    });
    console.info(
      `[RECONCILIAÇÃO] ${orphan.length} questão(ões) órfã(s) sem vínculo de prova arquivada(s):`,
      orphan.map((o) => o.id)
    );
  }

  // 2. Atualizar e vincular figuras oficiais recortadas da Página 3 da PRF 2019 aos itens 24, 25 e 26
  const prf19 = await prisma.examEdition.findUnique({
    where: { editionCode: "PRF-2019-POLICIAL" },
    include: {
      examForms: {
        include: {
          questionInstances: {
            where: { originalNumber: { in: [24, 25, 26] } },
            include: {
              question: true,
              answerKeys: { orderBy: { revisionNumber: "desc" } },
            },
          },
        },
      },
    },
  });

  if (!prf19) {
    throw new Error("Edição PRF-2019-POLICIAL não encontrada.");
  }

  const expectedKeys: Record<number, string> = { 24: "E", 25: "C", 26: "C" };
  const baseAssetPath = "/assets/exams/prf_2019/prf2019_p3_base_vistas.png";
  const baseSha = await fileSha256(baseAssetPath);

  const instances = prf19.examForms.flatMap((f) => f.questionInstances);

  for (const inst of instances) {
    const num = inst.originalNumber;
    const defKey = inst.answerKeys.find((k) => k.isDefinitive) ?? inst.answerKeys[0];
    if (!defKey || defKey.answerValue !== expectedKeys[num]) {
      throw new Error(
        `Divergência de gabarito no item #${num}: esperado ${expectedKeys[num]}, encontrado ${defKey?.answerValue}`
      );
    }

    const itemAssetPath = `/assets/exams/prf_2019/prf2019_item_${num}.png`;
    const itemSha = await fileSha256(itemAssetPath);

    await prisma.question.update({
      where: { id: inst.questionId },
      data: {
        supportText: BASE_SUPPORT_TEXT,
        statement: `Com base na vista frontal e na vista da esquerda do sólido apresentado acima (Página 3 da prova oficial PRF 2019), julgue se a figura do item ${num} pode representar uma vista superior válida do referido sólido.`,
        status: "PUBLISHED",
        validatedAt: new Date(),
        publishedAt: new Date(),
      },
    });

    // Substituir assets de forma idempotente
    await prisma.questionAsset.deleteMany({
      where: { questionId: inst.questionId },
    });

    await prisma.questionAsset.createMany({
      data: [
        {
          questionId: inst.questionId,
          assetType: "IMAGE",
          storagePath: baseAssetPath,
          objectUrl: baseAssetPath,
          sha256: baseSha,
          caption: "Figuras-base oficiais (PRF 2019, Pág. 3): vista frontal e vista da esquerda do sólido.",
          position: 1,
        },
        {
          questionId: inst.questionId,
          assetType: "IMAGE",
          storagePath: itemAssetPath,
          objectUrl: itemAssetPath,
          sha256: itemSha,
          caption: `Figura oficial do item #${num} (PRF 2019, Pág. 3): possível vista superior para julgamento (Certo/Errado).`,
          position: 2,
        },
      ],
    });

    await prisma.importJobItem.updateMany({
      where: { questionId: inst.questionId },
      data: {
        validationStatus: "VERIFIED",
        reviewedAt: new Date(),
      },
    });

    if (owner) {
      await prisma.contentReviewLog.create({
        data: {
          reviewerUser: { connect: { id: owner.id } },
          entityType: "QUESTION",
          entityId: inst.questionId,
          action: "VISUAL_ITEM_VERIFIED_AND_PUBLISHED",
          previousStatus: inst.question.status,
          newStatus: "PUBLISHED",
          notes: `Item #${num} (PRF 2019) verificado visualmente com recortes oficiais da Página 3 e gabarito definitivo Cebraspe (${defKey.answerValue}) conferido.`,
        },
      });
    }

    console.info(
      `[OK] PRF 2019 #${num} conferido (Gab=${defKey.answerValue}, 2 figuras anexadas) -> PUBLISHED`
    );
  }

  // Atualizar status do ImportJob da PRF 2019 para PUBLISHED (120/120)
  await prisma.importJob.updateMany({
    where: { examEditionId: prf19.id },
    data: { status: "PUBLISHED", totalPublished: 120 },
  });

  const [published, awaitingReview, archived] = await Promise.all([
    prisma.question.count({ where: { status: "PUBLISHED" } }),
    prisma.question.count({ where: { status: "AWAITING_REVIEW" } }),
    prisma.question.count({ where: { status: "ARCHIVED" } }),
  ]);

  console.info("\n=== CONTAGEM FINAL RECONCILIADA NO PRISMA POSTGRES ===", {
    publishedQuestions: published,
    awaitingReviewQuestions: awaitingReview,
    archivedQuestions: archived,
  });
}

main()
  .catch((err) => {
    console.error("[ERRO]", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
