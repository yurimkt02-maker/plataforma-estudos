import dotenv from "dotenv";
dotenv.config({ path: [".env.local", ".env"] });

import { prisma } from "../../src/lib/db/prisma";

async function main(): Promise<void> {
  const [dbSize, tableSizes, storedCount, storedBytes, qCounts] = await Promise.all([
    prisma.$queryRaw<Array<{ db_size: string; db_bytes: string }>>`
      SELECT pg_size_pretty(pg_database_size(current_database())) AS db_size,
             pg_database_size(current_database())::text AS db_bytes
    `,
    prisma.$queryRaw<Array<{ relname: string; total_size: string; bytes: string }>>`
      SELECT relname::text,
             pg_size_pretty(pg_total_relation_size(relid)) AS total_size,
             pg_total_relation_size(relid)::text AS bytes
      FROM pg_catalog.pg_statio_user_tables
      ORDER BY pg_total_relation_size(relid) DESC
      LIMIT 12
    `,
    prisma.storedDocumentFile.count(),
    prisma.storedDocumentFile.aggregate({ _sum: { sizeBytes: true } }),
    prisma.question.groupBy({ by: ["status"], _count: true }),
  ]);

  console.info("=== AUDITORIA DE ARMAZENAMENTO PRISMA POSTGRES ===");
  console.info("Tamanho total do banco:", dbSize[0]);
  console.info("StoredDocumentFile registros:", storedCount, "| Bytes somados:", storedBytes._sum.sizeBytes ?? 0);
  console.info("Questões por status:", qCounts);
  console.info("\nMaiores tabelas:");
  for (const t of tableSizes) {
    console.info(`  - ${t.relname}: ${t.total_size}`);
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
