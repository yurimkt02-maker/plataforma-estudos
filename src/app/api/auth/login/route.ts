import { NextRequest, NextResponse } from "next/server";
import { isDatabaseConfigured, prisma } from "@/lib/db/prisma";
import { verifyPassword } from "@/lib/auth/password";
import {
  checkLoginRateLimit,
  recordFailedLoginAttempt,
  resetLoginRateLimit,
} from "@/lib/auth/rate-limit";
import { setSessionCookie } from "@/lib/auth/session";
import { loginSchema } from "@/lib/validations/schemas";
import { logger } from "@/lib/utils/logger";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = loginSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "VALIDATION_ERROR",
          message: parsed.error.issues[0]?.message ?? "Dados de login inválidos.",
        },
        { status: 400 }
      );
    }

    const email = parsed.data.email.toLowerCase();
    const clientIp =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      "127.0.0.1";
    const rateKey = `${clientIp}:${email}`;

    const rateCheck = checkLoginRateLimit(rateKey);
    if (!rateCheck.allowed) {
      logger.warn("AUTH_LOGIN_RATE_LIMITED", { email, clientIp });
      return NextResponse.json(
        {
          error: "TOO_MANY_REQUESTS",
          message: `Muitas tentativas de login. Aguarde ${Math.ceil(rateCheck.retryAfterSeconds / 60)} minutos.`,
          retryAfterSeconds: rateCheck.retryAfterSeconds,
        },
        { status: 429 }
      );
    }

    if (isDatabaseConfigured()) {
      const user = await prisma.user.findUnique({
        where: { email },
        include: { settings: true },
      });

      if (!user || !user.isActive || !verifyPassword(parsed.data.password, user.passwordHash)) {
        const failed = recordFailedLoginAttempt(rateKey);
        logger.warn("AUTH_LOGIN_FAILED", {
          email,
          remainingAttempts: failed.remainingAttempts,
        });
        return NextResponse.json(
          {
            error: "INVALID_CREDENTIALS",
            message: "Credenciais inválidas.",
          },
          { status: 401 }
        );
      }

      resetLoginRateLimit(rateKey);
      await prisma.user.update({
        where: { id: user.id },
        data: { lastLoginAt: new Date() },
      });

      await setSessionCookie({
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        activeTrackCode: user.settings?.activeTrackCode ?? "TJSP",
      });

      logger.info("AUTH_LOGIN_SUCCESS", { userId: user.id });
      return NextResponse.json({
        authenticated: true,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          activeTrackCode: user.settings?.activeTrackCode ?? "TJSP",
        },
      });
    }

    // Caso o banco Prisma Postgres ainda não esteja conectado, permite autenticar exclusivamente
    // se OWNER_EMAIL e OWNER_PASSWORD estiverem explicitamente configurados nas variáveis de ambiente do servidor
    const envOwnerEmail = process.env.OWNER_EMAIL?.trim().toLowerCase();
    const envOwnerPassword = process.env.OWNER_PASSWORD;

    if (envOwnerEmail && envOwnerPassword && envOwnerPassword.length >= 8) {
      if (email === envOwnerEmail && parsed.data.password === envOwnerPassword) {
        resetLoginRateLimit(rateKey);
        const ownerSession = {
          id: "00000000-0000-4000-8000-000000000001",
          email: envOwnerEmail,
          name: process.env.OWNER_NAME?.trim() || "Proprietário",
          role: "OWNER" as const,
          activeTrackCode: "TJSP",
        };
        await setSessionCookie(ownerSession);
        return NextResponse.json({
          authenticated: true,
          user: ownerSession,
        });
      }

      recordFailedLoginAttempt(rateKey);
      return NextResponse.json(
        {
          error: "INVALID_CREDENTIALS",
          message: "Credenciais inválidas.",
        },
        { status: 401 }
      );
    }

    return NextResponse.json(
      {
        error: "DATABASE_OR_OWNER_NOT_CONFIGURED",
        message:
          "Configure DATABASE_URL_POOLED / DIRECT_URL e execute 'npm run db:seed' (com OWNER_EMAIL e OWNER_PASSWORD no .env.local) para inicializar sua conta privada.",
      },
      { status: 503 }
    );
  } catch (error) {
    logger.error("AUTH_LOGIN_UNEXPECTED_ERROR", error);
    return NextResponse.json(
      {
        error: "INTERNAL_ERROR",
        message: "Erro interno ao processar autenticação.",
      },
      { status: 500 }
    );
  }
}
