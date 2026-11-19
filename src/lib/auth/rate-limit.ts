type RateLimitEntry = {
  attempts: number;
  firstAttemptAt: number;
  lockedUntil: number | null;
};

const loginAttemptsMap = new Map<string, RateLimitEntry>();

const WINDOW_MS = 15 * 60 * 1000; // 15 minutos
const MAX_ATTEMPTS = 5;
const LOCKOUT_MS = 15 * 60 * 1000; // 15 minutos

export type RateLimitCheckResult = {
  allowed: boolean;
  remainingAttempts: number;
  retryAfterSeconds: number;
};

/**
 * Verifica se a chave (IP + email) pode tentar autenticar.
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
 * Registra uma falha de login e aplica bloqueio temporário após atingir o limite.
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
 * Limpa o contador de tentativas após login bem-sucedido.
 */
export function resetLoginRateLimit(identifier: string): void {
  loginAttemptsMap.delete(identifier);
}
