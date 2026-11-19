import { isDatabaseConfigured, prisma } from "@/lib/db/prisma";

type RateLimitEntry = {
  attempts: number;
  firstAttemptAt: number;
  lockedUntil: number | null;
};

const loginAttemptsMap = new Map<string, RateLimitEntry>();

const WINDOW_MS = 15 * 60 * 1000; // 15 minutos
const MAX_ATTEMPTS = 5;
const LOCKOUT_MS = 15 * 60 * 1000; // 15 minutos
const RATE_LIMIT_ENTITY_UUID = "00000000-0000-4000-8000-000000000429";

export type RateLimitCheckResult = {
  allowed: boolean;
  remainingAttempts: number;
  retryAfterSeconds: number;
};

/**
 * Verifica se a chave (IP + email) pode tentar autenticar (memória local).
 */
export function checkLoginRateLimit(
  identifier: string,
  now: number = Date.now()
): RateLimitCheckResult {
  const existing = loginAttemptsMap.get(identifier);

  if (!existing) {
    return {
      allowed: true,
      remainingAttempts: MAX_ATTEMPTS,
      retryAfterSeconds: 0,
    };
  }

  if (existing.lockedUntil && existing.lockedUntil > now) {
    return {
      allowed: false,
      remainingAttempts: 0,
      retryAfterSeconds: Math.ceil((existing.lockedUntil - now) / 1000),
    };
  }

  if (now - existing.firstAttemptAt > WINDOW_MS) {
    loginAttemptsMap.delete(identifier);
    return {
      allowed: true,
      remainingAttempts: MAX_ATTEMPTS,
      retryAfterSeconds: 0,
    };
  }

  return {
    allowed: existing.attempts < MAX_ATTEMPTS,
    remainingAttempts: Math.max(0, MAX_ATTEMPTS - existing.attempts),
    retryAfterSeconds: 0,
  };
}

/**
 * Registra uma falha de login em memória.
 */
export function recordFailedLoginAttempt(
  identifier: string,
  now: number = Date.now()
): RateLimitCheckResult {
  const existing = loginAttemptsMap.get(identifier);

  if (!existing || now - existing.firstAttemptAt > WINDOW_MS) {
    const entry: RateLimitEntry = {
      attempts: 1,
      firstAttemptAt: now,
      lockedUntil: null,
    };
    loginAttemptsMap.set(identifier, entry);
    return {
      allowed: true,
      remainingAttempts: MAX_ATTEMPTS - 1,
      retryAfterSeconds: 0,
    };
  }

  existing.attempts += 1;
  if (existing.attempts >= MAX_ATTEMPTS) {
    existing.lockedUntil = now + LOCKOUT_MS;
    return {
      allowed: false,
      remainingAttempts: 0,
      retryAfterSeconds: Math.ceil(LOCKOUT_MS / 1000),
    };
  }

  return {
    allowed: true,
    remainingAttempts: MAX_ATTEMPTS - existing.attempts,
    retryAfterSeconds: 0,
  };
}

/**
 * Limpa o contador de tentativas em memória.
 */
export function resetLoginRateLimit(identifier: string): void {
  loginAttemptsMap.delete(identifier);
}

/**
 * Rate limiting distribuído para ambiente Serverless (Vercel Functions) persistido no Prisma Postgres.
 * Garante que mesmo em cold starts ou múltiplas instâncias paralelas o limite de 5 tentativas / 15 min seja respeitado.
 */
export async function checkServerlessLoginRateLimit(
  identifier: string,
  now: number = Date.now()
): Promise<RateLimitCheckResult> {
  const memResult = checkLoginRateLimit(identifier, now);
  if (!memResult.allowed) {
    return memResult;
  }

  if (!isDatabaseConfigured()) {
    return memResult;
  }

  try {
    const windowStart = new Date(now - WINDOW_MS);
    const recentFailures = await prisma.contentReviewLog.findMany({
      where: {
        entityType: "AUTH_RATE_LIMIT",
        action: "LOGIN_FAILED",
        notes: identifier,
        createdAt: { gte: windowStart },
      },
      orderBy: { createdAt: "desc" },
      take: MAX_ATTEMPTS,
    });

    if (recentFailures.length >= MAX_ATTEMPTS) {
      const latestFailure = recentFailures[0]!;
      const unlockAt = latestFailure.createdAt.getTime() + LOCKOUT_MS;
      if (unlockAt > now) {
        return {
          allowed: false,
          remainingAttempts: 0,
          retryAfterSeconds: Math.ceil((unlockAt - now) / 1000),
        };
      }
    }

    return {
      allowed: true,
      remainingAttempts: Math.max(0, MAX_ATTEMPTS - recentFailures.length),
      retryAfterSeconds: 0,
    };
  } catch {
    return memResult;
  }
}

/**
 * Persiste falha de login no Prisma Postgres para proteção serverless entre instâncias.
 */
export async function recordServerlessFailedLoginAttempt(
  identifier: string,
  now: number = Date.now()
): Promise<RateLimitCheckResult> {
  const memResult = recordFailedLoginAttempt(identifier, now);

  if (!isDatabaseConfigured()) {
    return memResult;
  }

  try {
    await prisma.contentReviewLog.create({
      data: {
        entityType: "AUTH_RATE_LIMIT",
        entityId: RATE_LIMIT_ENTITY_UUID,
        action: "LOGIN_FAILED",
        notes: identifier,
      },
    });
    return await checkServerlessLoginRateLimit(identifier, now);
  } catch {
    return memResult;
  }
}

/**
 * Remove falhas anteriores do identificador no Prisma Postgres após login válido.
 */
export async function resetServerlessLoginRateLimit(
  identifier: string
): Promise<void> {
  resetLoginRateLimit(identifier);
  if (!isDatabaseConfigured()) return;
  try {
    await prisma.contentReviewLog.deleteMany({
      where: {
        entityType: "AUTH_RATE_LIMIT",
        action: "LOGIN_FAILED",
        notes: identifier,
      },
    });
  } catch {
    // Ignorar falha de limpeza não crítica
  }
}
