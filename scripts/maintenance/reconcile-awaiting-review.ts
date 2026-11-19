import dotenv from "dotenv";
dotenv.config({ path: [".env.local", ".env"] });

import { prisma } from "../../src/lib/db/prisma";

async function main(): Promise<void> {
  console.info("=== RECONCILIAÇÃO DAS QUESTÕES EM AWAITING_REVIEW ===\n");

  const awaiting = await prisma.question.findMany({
    where: { status: "AWAITING_REVIEW" },
    include: {
      examInstances: {
        include: {
          examForm: { include: { examEdition: true } },
          answerKeys: { orderBy: { revisionNumber: "desc" } },
        },
      },
      sources: { include: { sourceDocument: true } },
      assets: true,
    },
    orderBy: { createdAt: "asc" },
  });

  console.info(`Total efetivo em AWAITING_REVIEW no Prisma Postgres: ${awaiting.length}\n`);

  for (const [idx, q] of awaiting.entries()) {
    const inst = q.examInstances[0];
    const edCode = inst?.examForm.examEdition.editionCode ?? "SEM_INSTANCIA_ORFA";
    const num = inst?.originalNumber ?? -1;
    const key = inst?.answerKeys[0]?.answerValue ?? "SEM_GAB";
    const docStatus = q.sources[0]?.sourceDocument.verificationStatus ?? "SEM_DOC";
    console.info(
      `[${idx + 1}] id=${q.id} | Edição=${edCode} | #${num} | Gab=${key} | Doc=${docStatus} | Assets=${q.assets.length}`
    );
    console.info(`    Enunciado: ${q.statement.slice(0, 120)}`);
  }
}

main()
  .catch((err) => {
    console.error("[ERRO RECONCILIAÇÃO]", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
