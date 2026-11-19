import { NextResponse } from "next/server";
import { getServerSession, type SessionUser } from "@/lib/auth/session";

export type ApiAuthResult =
  | { authorized: true; user: SessionUser }
  | { authorized: false; response: NextResponse };

/**
 * Valida sessão privada em Route Handlers (camada adicional ao middleware).
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
