import dotenv from "dotenv";
dotenv.config({ path: [".env.local", ".env"] });

import { prisma } from "../../src/lib/db/prisma";

const EXPECTED_COUNTS_BY_EDITION: Record<string, number> = {
  "TJSP-2025-ESCREVENTE": 70, // TJSP2503 possui 70 questões objetivas!
  "TJSP-2024-ESCREVENTE": 100,
  "TJSP-2024-ESCREVENTE-CAPITAL": 100,
  "TJSP-2023-ESCREVENTE-INTERIOR": 100,
  "TJSP-2023-ESCREVENTE-CAPITAL": 100,
  "PCSP-2023-INVESTIGADOR": 80,
  "PCSP-2023-ESCRIVAO": 80,
  "PCSP-2018-INVESTIGADOR": 80,
  "PRF-2021-POLICIAL": 120,
  "PRF-2019-POLICIAL": 120,
  "OAB-47-1FASE": 80,
  "OAB-46-1FASE": 80,
  "OAB-45-1FASE": 80,
  "OAB-44-1FASE": 80,
  "OAB-43-1FASE": 80,
  "OAB-42-1FASE": 80,
  "OAB-41-1FASE": 80,
  "OAB-40-1FASE": 80,
  "OAB-39-1FASE": 80,
  "OAB-38-1FASE": 80,
  "OAB-37-1FASE": 80,
};

async function main(): Promise<void> {
  console.info("=== SINCRONIZANDO expectedQuestionCount POR EDIÇÃO E CADERNO ===\n");

  for (const [editionCode, expected] of Object.entries(EXPECTED_COUNTS_BY_EDITION)) {
    const ed = await prisma.examEdition.findUnique({ where: { editionCode } });
    if (!ed) continue;

    await prisma.examEdition.update({
      where: { id: ed.id },
      data: { expectedQuestionCount: expected },
    });
    await prisma.examForm.updateMany({
      where: { examEditionId: ed.id },
      data: { expectedQuestionCount: expected },
    });
    console.info(`  [OK] ${editionCode}: expectedQuestionCount = ${expected}`);
  }

  // Garantir Versão 3 como caderno distinto em PCSP-2023-ESCRIVAO (nunca misturar com Versão 1)
  const pcspEscrivao = await prisma.examEdition.findUnique({
    where: { editionCode: "PCSP-2023-ESCRIVAO" },
  });
  if (pcspEscrivao) {
    await prisma.examForm.upsert({
      where: {
        examEditionId_versionLabel: {
          examEditionId: pcspEscrivao.id,
          versionLabel: "Versão 3",
        },
      },
      update: { expectedQuestionCount: 80 },
      create: {
        examEditionId: pcspEscrivao.id,
        versionLabel: "Versão 3",
        isDefault: false,
        expectedQuestionCount: 80,
        notes: "Caderno Versão 3 (PCSP2305) — jamais associar ao gabarito da Versão 1.",
      },
    });
    console.info("  [OK] PCSP-2023-ESCRIVAO: caderno distinto 'Versão 3' (80 questões) registrado.");
  }
}

main()
  .catch((err) => {
    console.error("[ERRO SYNC]", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
