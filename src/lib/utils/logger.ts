const REDACTED_KEYS = new Set([
  "password",
  "passwordHash",
  "token",
  "secret",
  "apiKey",
  "authorization",
  "cookie",
  "databaseUrl",
  "directUrl",
]);

function scrubSensitiveData(
  meta?: Record<string, unknown>
): Record<string, unknown> | undefined {
  if (!meta) return undefined;
  const cleaned: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(meta)) {
    if (
      REDACTED_KEYS.has(key) ||
      /password|secret|token|key|url/i.test(key) &&
        typeof value === "string" &&
        value.includes("://")
    ) {
      cleaned[key] = "[REDACTED]";
    } else {
      cleaned[key] = value;
    }
  }
  return cleaned;
}

export const logger = {
  info(event: string, meta?: Record<string, unknown>) {
    console.info(
      JSON.stringify({
        level: "INFO",
        timestamp: new Date().toISOString(),
        event,
        meta: scrubSensitiveData(meta),
      })
    );
  },
  warn(event: string, meta?: Record<string, unknown>) {
    console.warn(
      JSON.stringify({
        level: "WARN",
        timestamp: new Date().toISOString(),
        event,
        meta: scrubSensitiveData(meta),
      })
    );
  },
  error(event: string, error?: unknown, meta?: Record<string, unknown>) {
    console.error(
      JSON.stringify({
        level: "ERROR",
        timestamp: new Date().toISOString(),
        event,
        error:
          error instanceof Error
            ? { name: error.name, message: error.message }
            : String(error),
        meta: scrubSensitiveData(meta),
      })
    );
  },
};
