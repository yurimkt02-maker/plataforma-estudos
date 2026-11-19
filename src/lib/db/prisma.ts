import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { resolvePooledDatabaseUrl } from "../../../prisma.config";

if (typeof window !== "undefined") {
  throw new Error(
    "[PrismaSecurity] O módulo src/lib/db/prisma.ts é restrito ao servidor e jamais pode ser importado no navegador."
  );
}

type GlobalPrismaState = {
  prismaClient?: PrismaClient;
  pgPool?: Pool;
};

const globalForPrisma = globalThis as unknown as GlobalPrismaState;

/**
 * Verifica se há uma URL de banco Prisma Postgres configurada no ambiente atual.
 */
export function isDatabaseConfigured(): boolean {
  const url =
    process.env.DATABASE_URL_POOLED?.trim() ||
    process.env.DIRECT_URL?.trim() ||
    process.env.DATABASE_URL?.trim() ||
    "";
  return (
    url.length > 0 &&
    !url.includes("USER:PASSWORD@HOST") &&
    (url.startsWith("postgresql://") || url.startsWith("postgres://"))
  );
}

/**
 * Cria o PrismaClient conectado ao Prisma Postgres por meio do driver adapter oficial (@prisma/adapter-pg).
 * Utiliza a conexão pooled (DATABASE_URL_POOLED) em runtime com fallback seguro para DATABASE_URL.
 */
function createPrismaClient(): PrismaClient {
  const connectionString = isDatabaseConfigured()
    ? resolvePooledDatabaseUrl(process.env)
    : "postgresql://build-placeholder:placeholder@localhost:5432/plataforma_estudos_build";

  const pool =
    globalForPrisma.pgPool ??
    new Pool({
      connectionString,
      max: process.env.NODE_ENV === "production" ? 10 : 5,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 10_000,
      ssl:
        connectionString.includes("sslmode=require") ||
        connectionString.includes("db.prisma.io") ||
        process.env.NODE_ENV === "production"
          ? { rejectUnauthorized: false }
          : undefined,
    });

  if (process.env.NODE_ENV !== "production") {
    globalForPrisma.pgPool = pool;
  }

  const adapter = new PrismaPg(pool);

  return new PrismaClient({
    adapter,
    log:
      process.env.NODE_ENV === "development"
        ? ["warn", "error"]
        : ["error"],
  });
}

/**
 * Instância singleton real do PrismaClient (sem wrapper Proxy).
 * O pg.Pool não abre socket TCP até que a primeira query seja executada,
 * garantindo segurança tanto no build estático quanto em runtime nas Vercel Functions.
 */
export const prisma: PrismaClient =
  globalForPrisma.prismaClient ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prismaClient = prisma;
}

export function getPrismaClient(): PrismaClient {
  return prisma;
}
