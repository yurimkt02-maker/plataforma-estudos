import { NextRequest, NextResponse } from "next/server";
import { requireApiAuth } from "@/lib/auth/api-guard";
import { isDatabaseConfigured, prisma } from "@/lib/db/prisma";

export const runtime = "nodejs";

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireApiAuth();
  if (!auth.authorized) return auth.response;

  const { id } = await context.params;

  if (!isDatabaseConfigured()) {
    return NextResponse.json(
      {
        error: "DATABASE_NOT_CONFIGURED",
        message: "Conexão com Prisma Postgres pendente de configuração.",
      },
      { status: 503 }
    );
  }

  const question = await prisma.question.findUnique({
    where: { id },
    include: {
      options: { orderBy: { displayOrder: "asc" } },
      assets: { orderBy: { position: "asc" } },
      subjects: { include: { subject: true } },
      sources: { include: { sourceDocument: true } },
      examInstances: {
        include: {
          answerKeys: {
            orderBy: { revisionNumber: "desc" },
          },
          examForm: {
            include: {
              examEdition: {
                include: {
                  examBoard: true,
                  ruleset: true,
                  position: {
                    include: {
                      studyTrack: true,
                      institution: true,
                    },
                  },
                },
              },
            },
          },
        },
      },
      explanations: {
        include: {
          citations: {
            include: {
              legalSource: true,
              legalPassage: true,
            },
          },
        },
        orderBy: { generatedAt: "desc" },
      },
      attempts: {
        where: { userId: auth.user.id },
        orderBy: { answeredAt: "desc" },
        take: 10,
      },
      bookmarks: {
        where: { userId: auth.user.id },
      },
      studyNotes: {
        where: { userId: auth.user.id },
      },
    },
  });

  if (!question) {
    return NextResponse.json(
      {
        error: "NOT_FOUND",
        message: "Questão não encontrada no acervo.",
      },
      { status: 404 }
    );
  }

  return NextResponse.json({ question });
}
