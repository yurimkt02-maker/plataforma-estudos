import { NextResponse } from "next/server";
import { isDatabaseConfigured, prisma } from "@/lib/db/prisma";

export const runtime = "nodejs";

export async function GET() {
  const configured = isDatabaseConfigured();
  if (!configured) {
    return NextResponse.json(
      {
        status: "AWAITING_DATABASE_CREDENTIALS",
        database: "prisma-postgres",
        configured: false,
        message:
          "Configure DATABASE_URL_POOLED e DIRECT_URL no ambiente para estabelecer a conexão TCP/TLS com o Prisma Postgres.",
      },
      { status: 200 }
    );
  }

  try {
    const start = Date.now();
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({
      status: "OK",
      database: "prisma-postgres",
      configured: true,
      latencyMs: Date.now() - start,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json(
      {
        status: "DATABASE_CONNECTION_ERROR",
        database: "prisma-postgres",
        configured: true,
        message:
          error instanceof Error
            ? error.message
            : "Falha ao conectar ao Prisma Postgres.",
      },
      { status: 503 }
    );
  }
}
