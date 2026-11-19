import dotenv from "dotenv";
dotenv.config({ path: [".env.local", ".env"] });
import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { isDatabaseConfigured, prisma } from "../../src/lib/db/prisma";

async function exportPersonalBackup(): Promise<void> {
  if (!isDatabaseConfigured()) {
    console.error(
      "[Backup] Configure DATABASE_URL_POOLED / DIRECT_URL antes de exportar dados do Prisma Postgres."
    );
    process.exit(2);
  }

  const [
    users,
    studySessions,
    questionAttempts,
    notebooks,
    bookmarks,
    studyNotes,
    reviewQueue,
    simulations,
    simulationAttempts,
    legalSources,
    explanations,
  ] = await Promise.all([
    prisma.user.findMany({
      select: { id: true, email: true, name: true, role: true, createdAt: true },
    }),
    prisma.studySession.findMany(),
    prisma.questionAttempt.findMany(),
    prisma.notebook.findMany({ include: { questions: true } }),
    prisma.bookmark.findMany(),
    prisma.studyNote.findMany(),
    prisma.reviewQueue.findMany(),
    prisma.simulation.findMany({ include: { items: true } }),
    prisma.simulationAttempt.findMany({ include: { responses: true } }),
    prisma.legalSource.findMany({ include: { passages: true } }),
    prisma.questionExplanation.findMany({ include: { citations: true } }),
  ]);

  const payload = {
    exportedAt: new Date().toISOString(),
    schemaVersion: "20261119100000_init",
    data: {
      users,
      studySessions,
      questionAttempts,
      notebooks,
      bookmarks,
      studyNotes,
      reviewQueue,
      simulations,
      simulationAttempts,
      legalSources,
      explanations,
    },
  };

  const jsonContent = JSON.stringify(payload, null, 2);
  const sha256 = createHash("sha256").update(jsonContent).digest("hex");
  const outDir = path.join(process.cwd(), "backups");
  await fs.mkdir(outDir, { recursive: true });
  const filename = `backup-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
  const outPath = path.join(outDir, filename);

  await fs.writeFile(outPath, jsonContent, "utf-8");
  console.info(`[Backup] Exportação concluída em ${outPath} (SHA-256: ${sha256})`);
}

exportPersonalBackup()
  .catch((err) => {
    console.error("[Backup] Falha ao exportar backup:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
