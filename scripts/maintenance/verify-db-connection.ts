import dotenv from "dotenv";
dotenv.config({ path: [".env.local", ".env"] });
import { resolveDirectDatabaseUrl, resolvePooledDatabaseUrl } from "../../prisma.config";
import { isDatabaseConfigured, prisma } from "../../src/lib/db/prisma";

async function verifyInfrastructure(): Promise<void> {
  console.info("=== VERIFICAÇÃO DE INFRAESTRUTURA PRISMA POSTGRES ===");

  if (!isDatabaseConfigured()) {
    console.warn(
      "[STATUS: BLOQUEADO POR CREDENCIAL AUSENTE]\n" +
        "Nenhuma string de conexão real foi detectada em DATABASE_URL_POOLED ou DIRECT_URL.\n" +
        "Configure as variáveis do Prisma Postgres no arquivo .env.local ou conecte via Vercel Marketplace e execute:\n" +
        "  npm run db:migrate:deploy\n" +
        "  npm run db:seed\n" +
        "  npm run db:verify"
    );
    process.exit(2);
  }

  const pooledUrl = resolvePooledDatabaseUrl(process.env);
  const directUrl = resolveDirectDatabaseUrl(process.env);

  console.info("[1/4] Variáveis de conexão resolvidas:", {
    hasPooledUrl: Boolean(pooledUrl),
    hasDirectUrl: Boolean(directUrl),
    usesSsl: pooledUrl.includes("sslmode=require"),
  });

  const start = Date.now();
  const pingResult = await prisma.$queryRaw<Array<{ current_database: string; version: string }>>`
    SELECT current_database()::text AS current_database, version()::text AS version
  `;
  const latencyMs = Date.now() - start;

  console.info("[2/4] Conexão TCP/TLS com Prisma Postgres confirmada:", {
    database: pingResult[0]?.current_database,
    latencyMs,
  });

  const [trackCount, boardCount, rulesetCount, legalSourceCount] =
    await Promise.all([
      prisma.studyTrack.count(),
      prisma.examBoard.count(),
      prisma.examRuleset.count(),
      prisma.legalSource.count(),
    ]);

  console.info("[3/4] Contagem de tabelas do catálogo:", {
    studyTracks: trackCount,
    examBoards: boardCount,
    examRulesets: rulesetCount,
    legalSources: legalSourceCount,
  });

  console.info("[4/4] Integridade verificada com sucesso.");
}

verifyInfrastructure()
  .catch((err) => {
    console.error("[ERRO NA VERIFICAÇÃO DE BANCO]", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
