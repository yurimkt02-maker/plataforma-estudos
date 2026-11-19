import { NextRequest, NextResponse } from "next/server";
import { requireApiAuth } from "@/lib/auth/api-guard";
import { isDatabaseConfigured, prisma } from "@/lib/db/prisma";

export const runtime = "nodejs";

export async function POST(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireApiAuth();
  if (!auth.authorized) return auth.response;

  if (!isDatabaseConfigured()) {
    return NextResponse.json(
      {
        error: "DATABASE_NOT_CONFIGURED",
        message: "Configure o Prisma Postgres para iniciar simulados.",
      },
      { status: 503 }
    );
  }

  const { id } = await context.params;

  const simulation = await prisma.simulation.findUnique({
    where: { id },
    include: { items: { orderBy: { position: "asc" } } },
  });

  if (!simulation || simulation.userId !== auth.user.id) {
    return NextResponse.json(
      {
        error: "NOT_FOUND",
        message: "Simulado não encontrado.",
      },
      { status: 404 }
    );
  }

  const attempt = await prisma.$transaction(async (tx) => {
    const createdAttempt = await tx.simulationAttempt.create({
      data: {
        userId: auth.user.id,
        simulationId: simulation.id,
        status: "IN_PROGRESS",
      },
    });

    for (const item of simulation.items) {
      await tx.simulationResponse.create({
        data: {
          simulationAttemptId: createdAttempt.id,
          simulationItemId: item.id,
          isBlank: true,
        },
      });
    }

    return createdAttempt;
  });

  return NextResponse.json({ attempt }, { status: 201 });
}
