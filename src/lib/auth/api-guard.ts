import { NextResponse } from "next/server";
import { getServerSession, type SessionUser } from "@/lib/auth/session";
import { isSessionRevokedServerless } from "@/lib/auth/session-revocation";

export type ApiAuthResult =
  | { authorized: true; user: SessionUser }
  | { authorized: false; response: NextResponse };

/**
 * Valida sessão privada em Route Handlers (camada adicional ao middleware) e verifica revogação no Prisma Postgres.
 */
export async function requireApiAuth(): Promise<ApiAuthResult> {
  const user = await getServerSession();
  if (!user) {
    return {
      authorized: false,
      response: NextResponse.json(
        {
          error: "UNAUTHORIZED",
          message: "Sessão inválida ou expirada. Realize login novamente.",
        },
        { status: 401 }
      ),
    };
  }

  const revoked = await isSessionRevokedServerless(user);
  if (revoked) {
    return {
      authorized: false,
      response: NextResponse.json(
        {
          error: "SESSION_REVOKED",
          message: "Esta sessão foi encerrada e revogada no servidor.",
        },
        { status: 401 }
      ),
    };
  }

  return { authorized: true, user };
}

/**
 * Valida permissão de proprietário/administrador em Route Handlers de curadoria e importação.
 */
export async function requireApiAdmin(): Promise<ApiAuthResult> {
  const auth = await requireApiAuth();
  if (!auth.authorized) {
    return auth;
  }
  if (auth.user.role !== "OWNER" && auth.user.role !== "ADMIN") {
    return {
      authorized: false,
      response: NextResponse.json(
        {
          error: "FORBIDDEN",
          message: "Operação restrita ao administrador do acervo.",
        },
        { status: 403 }
      ),
    };
  }
  return auth;
}
