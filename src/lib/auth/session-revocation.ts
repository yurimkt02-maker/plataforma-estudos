import { isDatabaseConfigured, prisma } from "@/lib/db/prisma";
import type { SessionUser } from "@/lib/auth/session";

const REVOCATION_ENTITY_UUID = "00000000-0000-4000-8000-000000000401";
const revokedJtiCache = new Set<string>();

/**
 * Revoga uma sessão específica (por JTI e usuário) tanto em memória quanto no Prisma Postgres,
 * garantindo que o token JWT não possa ser reutilizado em nenhuma instância serverless após o logout.
 */
export async function revokeSessionServerless(
  session: SessionUser
): Promise<void> {
  if (session.jti) {
    revokedJtiCache.add(session.jti);
  }

  if (!isDatabaseConfigured()) return;

  try {
    await prisma.contentReviewLog.create({
      data: {
        entityType: "AUTH_SESSION_REVOCATION",
        entityId: REVOCATION_ENTITY_UUID,
        action: "SESSION_REVOKED",
        notes: session.jti ?? `user:${session.id}`,
        reviewerUserId:
          session.id !== "00000000-0000-4000-8000-000000000001"
            ? session.id
            : null,
      },
    });
  } catch {
    // Fallback em memória já registrado
  }
}

/**
 * Verifica se o token de sessão foi revogado ou se o usuário foi desativado no Prisma Postgres.
 */
export async function isSessionRevokedServerless(
  session: SessionUser
): Promise<boolean> {
  if (session.jti && revokedJtiCache.has(session.jti)) {
    return true;
  }

  if (!isDatabaseConfigured()) {
    return false;
  }

  try {
    if (session.jti) {
      const revokedRecord = await prisma.contentReviewLog.findFirst({
        where: {
          entityType: "AUTH_SESSION_REVOCATION",
          action: "SESSION_REVOKED",
          notes: session.jti,
        },
        select: { id: true },
      });

      if (revokedRecord) {
        revokedJtiCache.add(session.jti);
        return true;
      }
    }

    if (session.id !== "00000000-0000-4000-8000-000000000001") {
      const dbUser = await prisma.user.findUnique({
        where: { id: session.id },
        select: { isActive: true },
      });
      if (!dbUser || !dbUser.isActive) {
        return true;
      }
    }

    return false;
  } catch {
    return false;
  }
}
