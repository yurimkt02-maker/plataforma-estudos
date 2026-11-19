import { NextRequest, NextResponse } from "next/server";
import {
  SESSION_COOKIE_NAME,
  verifySessionToken,
} from "@/lib/auth/session";

const PUBLIC_PATHS = new Set(["/login", "/api/auth/login", "/api/health"]);

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    PUBLIC_PATHS.has(pathname)
  ) {
    return NextResponse.next();
  }

  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const session = token ? await verifySessionToken(token) : null;

  if (!session) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json(
        {
          error: "UNAUTHORIZED",
          message: "Autenticação obrigatória para acessar este recurso privado.",
        },
        { status: 401 }
      );
    }

    const loginUrl = new URL("/login", request.url);
    if (pathname !== "/") {
      loginUrl.searchParams.set("callbackUrl", pathname);
    }
    return NextResponse.redirect(loginUrl);
  }

  // Proteção adicional para rotas administrativas (/admin e /api/admin)
  if (
    (pathname.startsWith("/admin") || pathname.startsWith("/api/admin")) &&
    session.role !== "OWNER" &&
    session.role !== "ADMIN"
  ) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json(
        {
          error: "FORBIDDEN",
          message: "Acesso restrito à administração e curadoria do acervo.",
        },
        { status: 403 }
      );
    }
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  if (pathname === "/") {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
