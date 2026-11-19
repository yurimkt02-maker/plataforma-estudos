import "dotenv/config";
import path from "node:path";
import { defineConfig } from "prisma/config";

/**
 * Resolve a URL de conexão direta para CLI e Migrations do Prisma.
 * Suporta tanto a configuração manual (DIRECT_URL) quanto o provisionamento
 * via Vercel Marketplace do Prisma Postgres (DATABASE_URL / POSTGRES_URL).
 * Rejeita explicitamente URLs legadas do Prisma Accelerate (prisma:// ou prisma+postgres://).
 */
export function resolveDirectDatabaseUrl(
  env: NodeJS.ProcessEnv = process.env
): string {
  const candidate =
    env.DIRECT_URL?.trim() ||
    env.DATABASE_URL?.trim() ||
    env.POSTGRES_URL?.trim() ||
    "";

  if (!candidate) {
    throw new Error(
      "[PrismaConfig] URL de conexão direta ausente. Configure DIRECT_URL (ou DATABASE_URL no Vercel Marketplace)."
    );
  }

  if (
    candidate.startsWith("prisma://") ||
    candidate.startsWith("prisma+postgres://")
  ) {
    throw new Error(
      "[PrismaConfig] URLs do Prisma Accelerate não são permitidas. Utilize uma conexão TCP PostgreSQL direta (postgresql://)."
    );
  }

  return candidate;
}

/**
 * Resolve a URL de conexão com pooling (DATABASE_URL_POOLED) para uso em runtime da aplicação.
 * Em produção, exige explicitamente DATABASE_URL_POOLED para impedir o uso silencioso
 * da conexão direta sem pool nas Vercel Functions.
 */
export function resolvePooledDatabaseUrl(
  env: NodeJS.ProcessEnv = process.env
): string {
  const pooled = env.DATABASE_URL_POOLED?.trim() || "";

  if (!pooled) {
    if (env.NODE_ENV === "production") {
      throw new Error(
        "[PrismaConfig] DATABASE_URL_POOLED é obrigatória em produção para evitar esgotamento de conexões diretas no Prisma Postgres."
      );
    }

    const fallback = env.DIRECT_URL?.trim() || env.DATABASE_URL?.trim() || "";
    if (!fallback) {
      throw new Error(
        "[PrismaConfig] Nenhuma variável de banco configurada. Defina DATABASE_URL_POOLED e DIRECT_URL no arquivo .env.local."
      );
    }
    return fallback;
  }

  if (
    pooled.startsWith("prisma://") ||
    pooled.startsWith("prisma+postgres://")
  ) {
    throw new Error(
      "[PrismaConfig] Prisma Accelerate não é permitido em DATABASE_URL_POOLED. Utilize a string PostgreSQL pooled oficial do Prisma Postgres."
    );
  }

  return pooled;
}

// Sincroniza DIRECT_URL e DATABASE_URL_POOLED quando provisionado via Vercel Marketplace
if (!process.env.DIRECT_URL && process.env.DATABASE_URL) {
  process.env.DIRECT_URL = process.env.DATABASE_URL;
}
if (!process.env.DATABASE_URL_POOLED && process.env.DATABASE_URL && process.env.NODE_ENV !== "production") {
  process.env.DATABASE_URL_POOLED = process.env.DATABASE_URL;
}

export default defineConfig({
  schema: path.join("prisma", "schema.prisma"),
  migrations: {
    path: path.join("prisma", "migrations"),
    seed: "tsx prisma/seed.ts",
  },
});
