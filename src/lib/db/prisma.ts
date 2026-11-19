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
 * Utiliza exclusivamente a conexão pooled (DATABASE_URL_POOLED) em runtime.
 */
function createPrismaClient(): PrismaClient {
  const connectionString = resolvePooledDatabaseUrl(process.env);

  const pool =
    globalForPrisma.pgPool ??
    new Pool({
      connectionString,
      max: process.env.NODE_ENV === "production" ? 10 : 5,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 10_000,
      ssl:
        connectionString.includes("sslmode=require") ||
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
 * Obtém a instância singleton do PrismaClient sob demanda, evitando abrir conexões TCP durante o build estático.
 */
export function getPrismaClient(): PrismaClient {
  if (!globalForPrisma.prismaClient) {
    globalForPrisma.prismaClient = createPrismaClient();
  }
  return globalForPrisma.prismaClient;
}

/**
 * Proxy seguro para o PrismaClient singleton: inicializa a conexão apenas quando uma query é invocada no servidor.
 */
export const prisma: PrismaClient = new Proxy({} as PrismaClient, {
  get(_target, prop, receiver) {
    const client = getPrismaClient();
    const value = Reflect.get(client, prop, receiver);
    return typeof value === "function" ? value.bind(client) : value;
  },
});
