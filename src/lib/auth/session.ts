import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export const SESSION_COOKIE_NAME = "pe_session_v1";
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 dias

export type SessionUser = {
  id: string;
  email: string;
  name: string;
  role: "OWNER" | "ADMIN";
  activeTrackCode: string;
  jti?: string;
  iat?: number;
};

function getAuthSecretKey(): Uint8Array {
  const secret = process.env.AUTH_SECRET?.trim();
  if (!secret || secret.length < 32) {
    if (process.env.NODE_ENV === "production") {
      throw new Error(
        "[AuthSecurity] AUTH_SECRET deve estar configurada com pelo menos 32 caracteres em produção."
      );
    }
    return new TextEncoder().encode(
      "dev-only-fallback-secret-must-be-replaced-in-env-local-32bytes"
    );
  }
  return new TextEncoder().encode(secret);
}

/**
 * Assina um token JWT de sessão para o proprietário autenticado com JTI único para revogação individual.
 */
export async function createSessionToken(user: SessionUser): Promise<string> {
  const jti = user.jti ?? globalThis.crypto.randomUUID();
  return new SignJWT({
    sub: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    activeTrackCode: user.activeTrackCode,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setJti(jti)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_TTL_SECONDS}s`)
    .sign(getAuthSecretKey());
}

/**
 * Verifica e decodifica um token JWT de sessão.
 */
export async function verifySessionToken(
  token: string
): Promise<SessionUser | null> {
  try {
    const { payload } = await jwtVerify(token, getAuthSecretKey());
    if (
      typeof payload.sub !== "string" ||
      typeof payload.email !== "string" ||
      typeof payload.name !== "string"
    ) {
      return null;
    }

    return {
      id: payload.sub,
      email: payload.email,
      name: payload.name,
      role: payload.role === "ADMIN" ? "ADMIN" : "OWNER",
      activeTrackCode:
        typeof payload.activeTrackCode === "string"
          ? payload.activeTrackCode
          : "TJSP",
      jti: typeof payload.jti === "string" ? payload.jti : undefined,
      iat: typeof payload.iat === "number" ? payload.iat : undefined,
    };
  } catch {
    return null;
  }
}

/**
 * Define o cookie HTTP-only de sessão na resposta.
 */
export async function setSessionCookie(user: SessionUser): Promise<string> {
  const token = await createSessionToken(user);
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });
  return token;
}

/**
 * Remove o cookie de sessão.
 */
export async function clearSessionCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE_NAME);
}

/**
 * Recupera a sessão validada no servidor a partir dos cookies HTTP-only.
 */
export async function getServerSession(): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!token) {
    return null;
  }
  return verifySessionToken(token);
}

/**
 * Garante que o usuário está autenticado em Server Components ou Server Actions.
 */
export async function requireServerAuth(): Promise<SessionUser> {
  const session = await getServerSession();
  if (!session) {
    redirect("/login");
  }
  return session;
}

/**
 * Garante que o usuário possui permissão administrativa/proprietário para rotas de curadoria e importação.
 */
export async function requireAdminAuth(): Promise<SessionUser> {
  const session = await requireServerAuth();
  if (session.role !== "OWNER" && session.role !== "ADMIN") {
    redirect("/dashboard");
  }
  return session;
}
