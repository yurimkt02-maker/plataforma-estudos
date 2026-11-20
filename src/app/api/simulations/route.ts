import { NextRequest, NextResponse } from "next/server";
import { requireApiAuth } from "@/lib/auth/api-guard";
import { isDatabaseConfigured, prisma } from "@/lib/db/prisma";
import { createSimulationSchema } from "@/lib/validations/schemas";
import { OFFICIAL_RULESETS } from "@/features/scoring/engine";
import { resolveExpectedQuestionCount } from "@/features/imports/pipeline";
import { logger } from "@/lib/utils/logger";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const auth = await requireApiAuth();
  if (!auth.authorized) return auth.response;

  if (!isDatabaseConfigured()) {
    return NextResponse.json(
      {
        error: "DATABASE_NOT_CONFIGURED",
        message: "Configure o Prisma Postgres para criar simulados persistentes.",
      },
      { status: 503 }
    );
  }

  try {
    const body = await request.json();
    const parsed = createSimulationSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "VALIDATION_ERROR",
          message: parsed.error.issues[0]?.message ?? "Configuração inválida.",
          issues: parsed.error.issues,
        },
        { status: 400 }
      );
    }

    const {
      title,
      mode,
      trackCode,
      examEditionId,
      examFormId,
      subjectIds,
      totalQuestions,
      durationMinutes,
      rulesetCode,
    } = parsed.data;

    const studyTrack = await prisma.studyTrack.findUnique({
      where: { code: trackCode.toUpperCase() },
    });

    // Para modo PAST_EXAM, respeitar a quantidade oficial configurada na edição/caderno (ex.: TJSP 2025 = 70)
    let effectiveTotalQuestions = totalQuestions;
    if (mode === "PAST_EXAM" && (examFormId || examEditionId)) {
      const targetEdition = examFormId
        ? await prisma.examForm.findUnique({
            where: { id: examFormId },
            include: { examEdition: { include: { ruleset: true } } },
          })
        : examEditionId
          ? await prisma.examEdition.findUnique({
              where: { id: examEditionId },
              include: { ruleset: true },
            })
          : null;

      if (targetEdition) {
        const isForm = "examEdition" in targetEdition;
        const resolved = resolveExpectedQuestionCount({
          formExpectedCount: isForm ? targetEdition.expectedQuestionCount : null,
          editionExpectedCount: isForm
            ? targetEdition.examEdition.expectedQuestionCount
            : targetEdition.expectedQuestionCount,
          rulesetPassingRules: isForm
            ? targetEdition.examEdition.ruleset.passingRulesJson
            : targetEdition.ruleset.passingRulesJson,
          trackCode,
        });
        effectiveTotalQuestions = Math.min(totalQuestions, resolved);
      }
    }

    const rulesetSnapshot =
      OFFICIAL_RULESETS[rulesetCode] ?? OFFICIAL_RULESETS.VUNESP_STANDARD_5!;

    const rawInstances = await prisma.examQuestionInstance.findMany({
      where: {
        question: {
          status: "PUBLISHED",
          ...(subjectIds && subjectIds.length > 0
            ? {
                subjects: {
                  some: { subjectId: { in: subjectIds } },
                },
              }
            : {}),
          ...(mode === "WEAKNESS_FOCUS"
            ? {
                attempts: {
                  some: { userId: auth.user.id, isCorrect: false },
                },
              }
            : {}),
        },
        ...(examFormId
          ? { examFormId }
          : examEditionId
            ? { examForm: { examEditionId } }
            : studyTrack
              ? {
                  examForm: {
                    examEdition: {
                      position: { studyTrackId: studyTrack.id },
                    },
                  },
                }
              : {}),
      },
      include: {
        examForm: true,
        question: {
          include: {
            subjects: true,
          },
        },
      },
      orderBy:
        mode === "PAST_EXAM"
          ? [{ originalNumber: "asc" }]
          : [{ examForm: { isDefault: "desc" } }, { originalNumber: "asc" }],
      take: effectiveTotalQuestions * 3,
    });

    // Deduplica por questionId para jamais repetir a mesma questão que aparece em múltiplas versões de caderno
    const seenQuestionIds = new Set<string>();
    const instances: typeof rawInstances = [];
    for (const inst of rawInstances) {
      if (!seenQuestionIds.has(inst.questionId)) {
        seenQuestionIds.add(inst.questionId);
        instances.push(inst);
        if (instances.length >= effectiveTotalQuestions) break;
      }
    }

    if (instances.length === 0) {
      return NextResponse.json(
        {
          error: "NO_QUESTIONS_AVAILABLE",
          message:
            "Não há questões reais publicadas suficientes no acervo para os critérios selecionados. Importe e publique provas reais em /admin/importacoes.",
        },
        { status: 422 }
      );
    }

    const simulation = await prisma.$transaction(async (tx) => {
      const sim = await tx.simulation.create({
        data: {
          userId: auth.user.id,
          studyTrackId: studyTrack?.id ?? null,
          examEditionId: examEditionId ?? null,
          examFormId: examFormId ?? null,
          title,
          mode,
          durationMinutes,
          totalQuestions: instances.length,
          rulesetSnapshot,
          configurationJson: {
            trackCode,
            subjectIds: subjectIds ?? [],
            requestedTotalQuestions: totalQuestions,
          },
        },
      });

      for (let i = 0; i < instances.length; i++) {
        const inst = instances[i]!;
        const primarySubjectId =
          inst.question.subjects.find((s) => s.isPrimary)?.subjectId ??
          inst.question.subjects[0]?.subjectId ??
          null;

        await tx.simulationItem.create({
          data: {
            simulationId: sim.id,
            questionId: inst.questionId,
            examQuestionInstanceId: inst.id,
            subjectId: primarySubjectId,
            position: i + 1,
            weight: 1.0,
          },
        });
      }

      return sim;
    });

    logger.info("SIMULATION_CREATED", {
      simulationId: simulation.id,
      mode,
      questionCount: simulation.totalQuestions,
    });

    return NextResponse.json({ simulation }, { status: 201 });
  } catch (error) {
    logger.error("CREATE_SIMULATION_ERROR", error);
    return NextResponse.json(
      {
        error: "INTERNAL_ERROR",
        message: "Erro ao criar simulado.",
      },
      { status: 500 }
    );
  }
}
