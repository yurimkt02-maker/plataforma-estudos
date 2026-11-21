import { isDatabaseConfigured, prisma } from "@/lib/db/prisma";
import {
  INITIAL_EXAM_BOARDS,
  INITIAL_EXAM_EDITIONS,
  INITIAL_INSTITUTIONS,
  INITIAL_POSITIONS,
  INITIAL_STUDY_TRACKS,
  INITIAL_SUBJECTS,
  INITIAL_VERIFIED_LEGAL_SOURCES,
} from "@/features/question-bank/catalog-data";
import {
  computeStudyAnalytics,
  type PerformanceMetricsSummary,
} from "@/features/analytics/calculator";
import type { QuestionFilterInput } from "@/lib/validations/schemas";
import { logger } from "@/lib/utils/logger";

export type ResumeTarget = {
  kind: "SIMULATION_IN_PROGRESS" | "LAST_QUESTION" | "NEW_SESSION";
  href: string;
  label: string;
  shortLabel: string;
  contextTitle: string;
  contextSubtitle: string;
};

export type DashboardOverviewData = {
  dbConnected: boolean;
  activeTrackCode: string;
  tracks: Array<{
    code: string;
    name: string;
    targetRole: string;
    description: string | null;
  }>;
  trackProgress: Array<{
    code: string;
    name: string;
    targetRole: string;
    publishedCount: number;
    attemptedCount: number;
  }>;
  metrics: PerformanceMetricsSummary;
  dailyGoalQuestions: number;
  todayAnsweredCount: number;
  errorNotebookCount: number;
  unresolvedQuestionsCount: number;
  pendingReviewsCount: number;
  resumeTarget: ResumeTarget;
  subjectBreakdown: Array<{
    subjectId: string;
    subjectName: string;
    attempts: number;
    accuracy: number;
  }>;
  recentAttempts: Array<{
    id: string;
    questionId: string;
    statementPreview: string;
    subjectName: string;
    examTitle: string;
    selectedAnswer: string | null;
    isCorrect: boolean;
    answeredAt: string;
  }>;
  recentSimulations: Array<{
    id: string;
    simulationId: string;
    title: string;
    status: string;
    netScore: number;
    maxScore: number;
    percentageScore: number;
    startedAt: string;
    finishedAt: string | null;
  }>;
  latestSimulation: {
    id: string;
    simulationId: string;
    title: string;
    status: string;
    netScore: number;
    maxScore: number;
    percentageScore: number;
    finishedAt: string | null;
  } | null;
};

const EMPTY_METRICS: PerformanceMetricsSummary = {
  totalAttempts: 0,
  totalCorrectAttempts: 0,
  overallAttemptAccuracy: 0,
  uniqueQuestionsAttempted: 0,
  uniqueQuestionsCorrectFirstTry: 0,
  firstTryAccuracyRate: 0,
  uniqueQuestionsInitiallyWrong: 0,
  uniqueQuestionsRecovered: 0,
  errorRecoveryRate: 0,
  totalTimeSpentSeconds: 0,
  averageTimePerAttemptSeconds: 0,
};

/**
 * Carrega os dados reais do Dashboard de Estudos a partir do Prisma Postgres.
 * Jamais inventa estatísticas fictícias: quando não há histórico ou o banco aguarda credenciais,
 * retorna estados vazios autênticos e transparentes.
 */
export async function getQuickResumeTarget(params: {
  userId: string;
  activeTrackCode: string;
}): Promise<ResumeTarget> {
  const trackCode = params.activeTrackCode.toUpperCase() || "TJSP";
  const fallback: ResumeTarget = {
    kind: "NEW_SESSION",
    href: `/questoes?track=${trackCode}`,
    label: "Iniciar sessão de questões",
    shortLabel: "Iniciar estudo",
    contextTitle: `Acervo oficial — ${trackCode}`,
    contextSubtitle: "Resolva questões reais verificadas da trilha selecionada",
  };

  if (!isDatabaseConfigured()) return fallback;

  try {
    const [inProgressSim, latestAttempt] = await Promise.all([
      prisma.simulationAttempt.findFirst({
        where: { userId: params.userId, status: "IN_PROGRESS" },
        include: { simulation: true },
        orderBy: { startedAt: "desc" },
      }),
      prisma.questionAttempt.findFirst({
        where: { userId: params.userId },
        include: {
          question: {
            include: { subjects: { include: { subject: true } } },
          },
          examQuestionInstance: {
            include: {
              examForm: { include: { examEdition: true } },
            },
          },
        },
        orderBy: { answeredAt: "desc" },
      }),
    ]);

    if (inProgressSim) {
      return {
        kind: "SIMULATION_IN_PROGRESS",
        href: `/simulados/${inProgressSim.simulationId}?attemptId=${inProgressSim.id}`,
        label: "Retomar simulado em andamento",
        shortLabel: "Retomar simulado",
        contextTitle: inProgressSim.simulation.title,
        contextSubtitle: "Simulado em andamento salvo automaticamente",
      };
    }

    if (latestAttempt) {
      const subj =
        latestAttempt.question.subjects.find((s) => s.isPrimary)?.subject ??
        latestAttempt.question.subjects[0]?.subject;
      return {
        kind: "LAST_QUESTION",
        href: `/questoes/${latestAttempt.questionId}`,
        label: "Continuar de onde parei",
        shortLabel: "Retomar estudo",
        contextTitle:
          latestAttempt.examQuestionInstance.examForm.examEdition.title,
        contextSubtitle: `Questão #${latestAttempt.examQuestionInstance.originalNumber}${subj ? ` · ${subj.name}` : ""}`,
      };
    }

    return fallback;
  } catch {
    return fallback;
  }
}

export async function getDashboardOverview(params: {
  userId: string;
  trackCode?: string;
}): Promise<DashboardOverviewData> {
  const activeTrackCode = params.trackCode?.toUpperCase() || "TJSP";
  const defaultTracks = INITIAL_STUDY_TRACKS.map((t) => ({
    code: t.code,
    name: t.name,
    targetRole: t.targetRole,
    description: t.description,
  }));
  const defaultResume: ResumeTarget = {
    kind: "NEW_SESSION",
    href: `/questoes?track=${activeTrackCode}`,
    label: "Iniciar sessão de questões",
    shortLabel: "Iniciar estudo",
    contextTitle: `Acervo oficial — ${activeTrackCode}`,
    contextSubtitle: "Resolva questões reais verificadas da trilha selecionada",
  };

  if (!isDatabaseConfigured()) {
    return {
      dbConnected: false,
      activeTrackCode,
      tracks: defaultTracks,
      trackProgress: defaultTracks.map((t) => ({
        code: t.code,
        name: t.name,
        targetRole: t.targetRole,
        publishedCount: 0,
        attemptedCount: 0,
      })),
      metrics: EMPTY_METRICS,
      dailyGoalQuestions: 30,
      todayAnsweredCount: 0,
      errorNotebookCount: 0,
      unresolvedQuestionsCount: 0,
      pendingReviewsCount: 0,
      resumeTarget: defaultResume,
      subjectBreakdown: [],
      recentAttempts: [],
      recentSimulations: [],
      latestSimulation: null,
    };
  }

  try {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const [
      dbTracks,
      attempts,
      totalPublishedQuestions,
      pendingReviewsCount,
      recentSimAttempts,
      userSettings,
      todayAnsweredCount,
      allUserAttemptsLight,
      publishedInstancesByTrack,
    ] = await Promise.all([
      prisma.studyTrack.findMany({
        where: { isActive: true },
        orderBy: { displayOrder: "asc" },
      }),
      prisma.questionAttempt.findMany({
        where: {
          userId: params.userId,
          ...(params.trackCode
            ? {
                examQuestionInstance: {
                  examForm: {
                    examEdition: {
                      position: {
                        studyTrack: { code: activeTrackCode },
                      },
                    },
                  },
                },
              }
            : {}),
        },
        include: {
          question: {
            include: {
              subjects: {
                include: { subject: true },
              },
            },
          },
          examQuestionInstance: {
            include: {
              examForm: {
                include: {
                  examEdition: {
                    include: {
                      position: {
                        include: { studyTrack: true },
                      },
                    },
                  },
                },
              },
            },
          },
        },
        orderBy: { answeredAt: "desc" },
      }),
      prisma.question.count({
        where: {
          status: "PUBLISHED",
          ...(params.trackCode
            ? {
                examInstances: {
                  some: {
                    examForm: {
                      examEdition: {
                        position: {
                          studyTrack: { code: activeTrackCode },
                        },
                      },
                    },
                  },
                },
              }
            : {}),
        },
      }),
      prisma.reviewQueue.count({
        where: {
          userId: params.userId,
          status: "PENDING",
          nextReviewAt: { lte: new Date() },
        },
      }),
      prisma.simulationAttempt.findMany({
        where: { userId: params.userId },
        include: { simulation: true },
        orderBy: { startedAt: "desc" },
        take: 4,
      }),
      prisma.userSettings.findUnique({
        where: { userId: params.userId },
        select: { dailyGoalQuestions: true },
      }),
      prisma.questionAttempt.count({
        where: {
          userId: params.userId,
          answeredAt: { gte: startOfToday },
        },
      }),
      prisma.questionAttempt.findMany({
        where: { userId: params.userId },
        select: {
          questionId: true,
          isCorrect: true,
          examQuestionInstance: {
            select: {
              examForm: {
                select: {
                  examEdition: {
                    select: {
                      position: {
                        select: { studyTrack: { select: { code: true } } },
                      },
                    },
                  },
                },
              },
            },
          },
        },
        orderBy: { answeredAt: "desc" },
      }),
      prisma.examQuestionInstance.findMany({
        where: { question: { status: "PUBLISHED" } },
        select: {
          questionId: true,
          examForm: {
            select: {
              examEdition: {
                select: {
                  position: {
                    select: { studyTrack: { select: { code: true } } },
                  },
                },
              },
            },
          },
        },
      }),
    ]);

    const latestSimAttempt = recentSimAttempts[0] ?? null;
    const inProgressSim =
      recentSimAttempts.find((s) => s.status === "IN_PROGRESS") ?? null;

    const analyticsRecords = attempts.map((a) => {
      const primarySubj =
        a.question.subjects.find((s) => s.isPrimary)?.subject ??
        a.question.subjects[0]?.subject;
      return {
        questionId: a.questionId,
        subjectId: primarySubj?.id ?? "unclassified",
        subjectName: primarySubj?.name ?? "Geral",
        trackCode:
          a.examQuestionInstance.examForm.examEdition.position.studyTrack.code,
        isCorrect: a.isCorrect,
        timeSpentSeconds: a.timeSpentSeconds,
        answeredAt: a.answeredAt,
      };
    });

    const metrics = computeStudyAnalytics(analyticsRecords);

    // Agrupamento por disciplina
    const subjGroup = new Map<
      string,
      { subjectId: string; subjectName: string; total: number; correct: number }
    >();
    for (const rec of analyticsRecords) {
      const item = subjGroup.get(rec.subjectId) ?? {
        subjectId: rec.subjectId,
        subjectName: rec.subjectName,
        total: 0,
        correct: 0,
      };
      item.total += 1;
      if (rec.isCorrect) item.correct += 1;
      subjGroup.set(rec.subjectId, item);
    }

    const subjectBreakdown = Array.from(subjGroup.values())
      .map((s) => ({
        subjectId: s.subjectId,
        subjectName: s.subjectName,
        attempts: s.total,
        accuracy:
          s.total > 0 ? Number(((s.correct / s.total) * 100).toFixed(1)) : 0,
      }))
      .sort((a, b) => b.attempts - a.attempts);

    const recentAttempts = attempts.slice(0, 8).map((a) => {
      const primarySubj =
        a.question.subjects.find((s) => s.isPrimary)?.subject ??
        a.question.subjects[0]?.subject;
      return {
        id: a.id,
        questionId: a.questionId,
        statementPreview:
          a.question.statement.length > 140
            ? `${a.question.statement.slice(0, 140)}...`
            : a.question.statement,
        subjectName: primarySubj?.name ?? "Disciplina Geral",
        examTitle: a.examQuestionInstance.examForm.examEdition.title,
        selectedAnswer: a.selectedAnswer,
        isCorrect: a.isCorrect,
        answeredAt: a.answeredAt.toISOString(),
      };
    });

    const resolvedTracks =
      dbTracks.length > 0
        ? dbTracks.map((t) => ({
            code: t.code,
            name: t.name,
            targetRole: t.targetRole,
            description: t.description,
          }))
        : defaultTracks;

    // Progresso real por concurso (questões publicadas únicas vs respondidas únicas)
    const publishedSetByTrack = new Map<string, Set<string>>();
    for (const inst of publishedInstancesByTrack) {
      const code = inst.examForm.examEdition.position.studyTrack.code;
      let set = publishedSetByTrack.get(code);
      if (!set) {
        set = new Set<string>();
        publishedSetByTrack.set(code, set);
      }
      set.add(inst.questionId);
    }

    const attemptedSetByTrack = new Map<string, Set<string>>();
    const lastResultByQuestion = new Map<string, boolean>();
    for (const att of allUserAttemptsLight) {
      const code =
        att.examQuestionInstance.examForm.examEdition.position.studyTrack.code;
      let set = attemptedSetByTrack.get(code);
      if (!set) {
        set = new Set<string>();
        attemptedSetByTrack.set(code, set);
      }
      set.add(att.questionId);
      // Como está ordenado por answeredAt desc, o primeiro registro é a última tentativa real
      if (!lastResultByQuestion.has(att.questionId)) {
        lastResultByQuestion.set(att.questionId, att.isCorrect);
      }
    }

    let errorNotebookCount = 0;
    for (const isLatestCorrect of lastResultByQuestion.values()) {
      if (!isLatestCorrect) errorNotebookCount += 1;
    }

    const trackProgress = resolvedTracks.map((t) => ({
      code: t.code,
      name: t.name,
      targetRole: t.targetRole,
      publishedCount: publishedSetByTrack.get(t.code)?.size ?? 0,
      attemptedCount: attemptedSetByTrack.get(t.code)?.size ?? 0,
    }));

    // Alvo honesto de retomada (nunca promete sessão inexistente)
    let resumeTarget: ResumeTarget = defaultResume;
    if (inProgressSim) {
      resumeTarget = {
        kind: "SIMULATION_IN_PROGRESS",
        href: `/simulados/${inProgressSim.simulationId}?attemptId=${inProgressSim.id}`,
        label: "Retomar simulado em andamento",
        shortLabel: "Retomar simulado",
        contextTitle: inProgressSim.simulation.title,
        contextSubtitle: "Simulado em andamento salvo automaticamente",
      };
    } else if (attempts[0]) {
      const last = attempts[0];
      const primarySubj =
        last.question.subjects.find((s) => s.isPrimary)?.subject ??
        last.question.subjects[0]?.subject;
      resumeTarget = {
        kind: "LAST_QUESTION",
        href: `/questoes/${last.questionId}`,
        label: "Continuar de onde parei",
        shortLabel: "Retomar estudo",
        contextTitle: last.examQuestionInstance.examForm.examEdition.title,
        contextSubtitle: `Questão #${last.examQuestionInstance.originalNumber}${primarySubj ? ` · ${primarySubj.name}` : ""}`,
      };
    }

    const recentSimulations = recentSimAttempts.map((s) => ({
      id: s.id,
      simulationId: s.simulationId,
      title: s.simulation.title,
      status: s.status,
      netScore: Number(s.netScore),
      maxScore: Number(s.maxScore),
      percentageScore: Number(s.percentageScore),
      startedAt: s.startedAt.toISOString(),
      finishedAt: s.finishedAt?.toISOString() ?? null,
    }));

    return {
      dbConnected: true,
      activeTrackCode,
      tracks: resolvedTracks,
      trackProgress,
      metrics,
      dailyGoalQuestions: userSettings?.dailyGoalQuestions ?? 30,
      todayAnsweredCount,
      errorNotebookCount,
      unresolvedQuestionsCount: Math.max(
        0,
        totalPublishedQuestions - metrics.uniqueQuestionsAttempted
      ),
      pendingReviewsCount,
      resumeTarget,
      subjectBreakdown,
      recentAttempts,
      recentSimulations,
      latestSimulation: latestSimAttempt
        ? {
            id: latestSimAttempt.id,
            simulationId: latestSimAttempt.simulationId,
            title: latestSimAttempt.simulation.title,
            status: latestSimAttempt.status,
            netScore: Number(latestSimAttempt.netScore),
            maxScore: Number(latestSimAttempt.maxScore),
            percentageScore: Number(latestSimAttempt.percentageScore),
            finishedAt: latestSimAttempt.finishedAt?.toISOString() ?? null,
          }
        : null,
    };
  } catch (error) {
    logger.error("DASHBOARD_OVERVIEW_QUERY_FAILED", error);
    return {
      dbConnected: false,
      activeTrackCode,
      tracks: defaultTracks,
      trackProgress: defaultTracks.map((t) => ({
        code: t.code,
        name: t.name,
        targetRole: t.targetRole,
        publishedCount: 0,
        attemptedCount: 0,
      })),
      metrics: EMPTY_METRICS,
      dailyGoalQuestions: 30,
      todayAnsweredCount: 0,
      errorNotebookCount: 0,
      unresolvedQuestionsCount: 0,
      pendingReviewsCount: 0,
      resumeTarget: defaultResume,
      subjectBreakdown: [],
      recentAttempts: [],
      recentSimulations: [],
      latestSimulation: null,
    };
  }
}

export type QuestionBankListItem = {
  id: string;
  examQuestionInstanceId: string;
  originalNumber: number;
  questionType: "MULTIPLE_CHOICE" | "TRUE_FALSE" | "SHORT_ANSWER" | "ESSAY";
  statement: string;
  supportText: string | null;
  instruction: string | null;
  difficulty: "EASY" | "MEDIUM" | "HARD";
  isAnnulled: boolean;
  isOutdated: boolean;
  outdatedNotes: string | null;
  trackCode: string;
  institutionAcronym: string;
  boardAcronym: string;
  positionName: string;
  examTitle: string;
  examYear: number;
  versionLabel: string;
  officialNoticeUrl: string | null;
  sourceDocumentUrl: string | null;
  sourcePageNumber: number | null;
  subjects: Array<{ id: string; name: string; slug: string }>;
  options: Array<{ id: string; label: string; content: string }>;
  assets: Array<{ id: string; url: string; caption: string | null }>;
  hasVerifiedExplanation: boolean;
  userHistory: {
    attemptCount: number;
    lastIsCorrect: boolean | null;
    isBookmarked: boolean;
  };
};

/**
 * Constrói o filtro Prisma `where` para busca de questões publicadas de forma pura e testável:
 * - Disciplina principal (`disciplineId`) inclui todas as questões da disciplina e de seus assuntos descendentes (`resolvedSubjectIds`).
 * - Assunto específico (`topicId`) restringe exclusivamente às questões vinculadas àquele assunto.
 * - `resolutionFilter` e `accuracyFilter` são combinados via `AND` (nunca se sobrescrevem, inclusive em combinações conflitantes como UNRESOLVED + WRONG).
 */
export function buildQuestionSearchWhereClause(params: {
  userId: string;
  filters: QuestionFilterInput;
  resolvedSubjectIds?: string[];
}): Record<string, unknown> {
  const { userId, filters, resolvedSubjectIds } = params;

  const whereClause: Record<string, unknown> = {
    status: "PUBLISHED",
  };
  const andConditions: Array<Record<string, unknown>> = [];

  if (filters.questionType) {
    whereClause.questionType = filters.questionType;
  }
  if (filters.difficulty) {
    whereClause.difficulty = filters.difficulty;
  }
  if (filters.onlyOutdated) {
    whereClause.isOutdated = true;
  }

  if (resolvedSubjectIds && resolvedSubjectIds.length > 0) {
    whereClause.subjects = {
      some:
        resolvedSubjectIds.length === 1
          ? { subjectId: resolvedSubjectIds[0] }
          : { subjectId: { in: resolvedSubjectIds } },
    };
  }

  if (filters.onlyBookmarked) {
    whereClause.bookmarks = {
      some: { userId },
    };
  }
  if (filters.onlyVerifiedExplanations) {
    whereClause.explanations = {
      some: { status: "VERIFIED" },
    };
  }
  if (filters.query && filters.query.length >= 2) {
    andConditions.push({
      OR: [
        { statement: { contains: filters.query, mode: "insensitive" } },
        { supportText: { contains: filters.query, mode: "insensitive" } },
      ],
    });
  }

  if (filters.resolutionFilter === "RESOLVED") {
    andConditions.push({ attempts: { some: { userId } } });
  } else if (filters.resolutionFilter === "UNRESOLVED") {
    andConditions.push({ attempts: { none: { userId } } });
  }

  if (filters.accuracyFilter === "CORRECT") {
    andConditions.push({ attempts: { some: { userId, isCorrect: true } } });
  } else if (filters.accuracyFilter === "WRONG") {
    andConditions.push({ attempts: { some: { userId, isCorrect: false } } });
  }

  if (andConditions.length > 0) {
    whereClause.AND = andConditions;
  }

  const instanceFilter: Record<string, unknown> = {};
  if (!filters.includeAnnulled) {
    instanceFilter.isAnnulled = false;
  }

  const editionFilter: Record<string, unknown> = {};
  if (filters.year) editionFilter.year = filters.year;
  if (filters.examBoardId) editionFilter.examBoardId = filters.examBoardId;
  if (filters.positionId) editionFilter.positionId = filters.positionId;
  if (filters.trackCode || filters.institutionId) {
    editionFilter.position = {
      ...(filters.institutionId
        ? { institutionId: filters.institutionId }
        : {}),
      ...(filters.trackCode
        ? { studyTrack: { code: filters.trackCode.toUpperCase() } }
        : {}),
    };
  }

  if (Object.keys(editionFilter).length > 0) {
    instanceFilter.examForm = {
      examEdition: editionFilter,
    };
  }

  if (Object.keys(instanceFilter).length > 0) {
    whereClause.examInstances = {
      some: instanceFilter,
    };
  }

  return whereClause;
}

/**
 * Ordena IDs de questões por prioridade real de revisão:
 * 1) Itens na fila de repetição espaçada (ReviewQueue PENDING), do mais vencido/próximo para o mais distante
 * 2) Questões com última tentativa incorreta (ainda não recuperadas)
 * 3) Demais questões preservando a ordem base (ex.: publishedAt desc)
 */
export function sortQuestionIdsByReviewPriority(params: {
  questionIds: string[];
  pendingReviews: Array<{ questionId: string; nextReviewAt: Date }>;
  wrongQuestionIds: Set<string>;
}): string[] {
  const reviewRank = new Map<string, number>();
  const sortedReviews = [...params.pendingReviews].sort(
    (a, b) => a.nextReviewAt.getTime() - b.nextReviewAt.getTime()
  );
  sortedReviews.forEach((r, idx) => {
    if (!reviewRank.has(r.questionId)) {
      reviewRank.set(r.questionId, idx);
    }
  });

  return [...params.questionIds].sort((a, b) => {
    const rankA = reviewRank.get(a);
    const rankB = reviewRank.get(b);
    if (rankA !== undefined && rankB !== undefined) return rankA - rankB;
    if (rankA !== undefined) return -1;
    if (rankB !== undefined) return 1;

    const wrongA = params.wrongQuestionIds.has(a);
    const wrongB = params.wrongQuestionIds.has(b);
    if (wrongA && !wrongB) return -1;
    if (!wrongA && wrongB) return 1;
    return 0;
  });
}

/**
 * Busca questões reais publicadas aplicando todos os filtros combinados e paginação no servidor.
 */
export async function searchPublishedQuestions(params: {
  userId: string;
  filters: QuestionFilterInput;
}): Promise<{
  dbConnected: boolean;
  totalCount: number;
  page: number;
  pageSize: number;
  items: QuestionBankListItem[];
}> {
  const { userId, filters } = params;

  if (!isDatabaseConfigured()) {
    return {
      dbConnected: false,
      totalCount: 0,
      page: filters.page,
      pageSize: filters.pageSize,
      items: [],
    };
  }

  try {
    // Resolver hierarquia real de disciplina/assunto no Prisma ANTES do count e da paginação
    let resolvedSubjectIds: string[] | undefined;

    if (filters.topicId) {
      // Assunto específico: retorna exclusivamente questões vinculadas àquele assunto
      resolvedSubjectIds = [filters.topicId];
    } else if (filters.disciplineId) {
      // Disciplina principal: inclui a própria disciplina e todos os seus assuntos descendentes cadastrados
      const children = await prisma.subject.findMany({
        where: { parentId: filters.disciplineId },
        select: { id: true },
      });
      resolvedSubjectIds = [
        filters.disciplineId,
        ...children.map((c) => c.id),
      ];
    } else if (filters.subjectId) {
      // Compatibilidade retroativa com URLs legadas (?subjectId=...)
      const children = await prisma.subject.findMany({
        where: { parentId: filters.subjectId },
        select: { id: true },
      });
      resolvedSubjectIds = [filters.subjectId, ...children.map((c) => c.id)];
    }

    const whereClause = buildQuestionSearchWhereClause({
      userId,
      filters,
      resolvedSubjectIds,
    });

    const skip = (filters.page - 1) * filters.pageSize;

    const questionInclude = {
      options: { orderBy: { displayOrder: "asc" as const } },
      assets: { orderBy: { position: "asc" as const } },
      subjects: { include: { subject: true } },
      sources: { include: { sourceDocument: true } },
      explanations: {
        where: { status: "VERIFIED" as const },
        select: { id: true },
      },
      bookmarks: {
        where: { userId },
        select: { id: true },
      },
      attempts: {
        where: { userId },
        orderBy: { answeredAt: "desc" as const },
        take: 5,
      },
      examInstances: {
        include: {
          examForm: {
            include: {
              examEdition: {
                include: {
                  examBoard: true,
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
    };

    let totalCount = 0;
    let rows: Awaited<
      ReturnType<
        typeof prisma.question.findMany<{ include: typeof questionInclude }>
      >
    > = [];

    if (filters.sortBy === "REVIEW_PRIORITY") {
      const [matchingRows, pendingReviews, userAttempts] = await Promise.all([
        prisma.question.findMany({
          where: whereClause,
          select: { id: true },
          orderBy: [{ publishedAt: "desc" }, { id: "asc" }],
        }),
        prisma.reviewQueue.findMany({
          where: { userId, status: "PENDING" },
          select: { questionId: true, nextReviewAt: true },
          orderBy: { nextReviewAt: "asc" },
        }),
        prisma.questionAttempt.findMany({
          where: { userId },
          select: { questionId: true, isCorrect: true },
          orderBy: { answeredAt: "desc" },
        }),
      ]);

      totalCount = matchingRows.length;
      const latestWrongIds = new Set<string>();
      const seenAttempt = new Set<string>();
      for (const att of userAttempts) {
        if (!seenAttempt.has(att.questionId)) {
          seenAttempt.add(att.questionId);
          if (!att.isCorrect) latestWrongIds.add(att.questionId);
        }
      }

      const orderedIds = sortQuestionIdsByReviewPriority({
        questionIds: matchingRows.map((r) => r.id),
        pendingReviews,
        wrongQuestionIds: latestWrongIds,
      });
      const pageIds = orderedIds.slice(skip, skip + filters.pageSize);

      if (pageIds.length > 0) {
        const fetched = await prisma.question.findMany({
          where: { id: { in: pageIds } },
          include: questionInclude,
        });
        const byId = new Map(fetched.map((q) => [q.id, q]));
        rows = pageIds
          .map((id) => byId.get(id))
          .filter((q): q is NonNullable<typeof q> => Boolean(q));
      }
    } else if (filters.sortBy === "ORIGINAL_NUMBER") {
      const matchingRows = await prisma.question.findMany({
        where: whereClause,
        select: {
          id: true,
          examInstances: {
            select: {
              originalNumber: true,
              examForm: {
                select: { examEdition: { select: { year: true } } },
              },
            },
            take: 1,
          },
        },
      });

      totalCount = matchingRows.length;
      const sortedIds = [...matchingRows]
        .sort((a, b) => {
          const yearA = a.examInstances[0]?.examForm.examEdition.year ?? 0;
          const yearB = b.examInstances[0]?.examForm.examEdition.year ?? 0;
          if (yearB !== yearA) return yearB - yearA;
          const numA = a.examInstances[0]?.originalNumber ?? 9999;
          const numB = b.examInstances[0]?.originalNumber ?? 9999;
          return numA - numB;
        })
        .map((r) => r.id);

      const pageIds = sortedIds.slice(skip, skip + filters.pageSize);
      if (pageIds.length > 0) {
        const fetched = await prisma.question.findMany({
          where: { id: { in: pageIds } },
          include: questionInclude,
        });
        const byId = new Map(fetched.map((q) => [q.id, q]));
        rows = pageIds
          .map((id) => byId.get(id))
          .filter((q): q is NonNullable<typeof q> => Boolean(q));
      }
    } else {
      const [count, fetched] = await Promise.all([
        prisma.question.count({ where: whereClause }),
        prisma.question.findMany({
          where: whereClause,
          skip,
          take: filters.pageSize,
          orderBy:
            filters.sortBy === "DIFFICULTY"
              ? [{ difficulty: "desc" }, { publishedAt: "desc" }]
              : [{ publishedAt: "desc" }, { id: "asc" }],
          include: questionInclude,
        }),
      ]);
      totalCount = count;
      rows = fetched;
    }

    const items: QuestionBankListItem[] = rows
      .map((q) => {
        const primaryInstance = q.examInstances[0];
        if (!primaryInstance) return null;
        const edition = primaryInstance.examForm.examEdition;
        const firstSource = q.sources[0];

        return {
          id: q.id,
          examQuestionInstanceId: primaryInstance.id,
          originalNumber: primaryInstance.originalNumber,
          questionType: q.questionType,
          statement: q.statement,
          supportText: q.supportText,
          instruction: q.instruction,
          difficulty: q.difficulty,
          isAnnulled: primaryInstance.isAnnulled,
          isOutdated: q.isOutdated,
          outdatedNotes: q.outdatedNotes,
          trackCode: edition.position.studyTrack.code,
          institutionAcronym: edition.position.institution.acronym,
          boardAcronym: edition.examBoard.acronym,
          positionName: edition.position.name,
          examTitle: edition.title,
          examYear: edition.year,
          versionLabel: primaryInstance.examForm.versionLabel,
          officialNoticeUrl: edition.officialNoticeUrl,
          sourceDocumentUrl: firstSource?.sourceDocument.officialUrl ?? null,
          sourcePageNumber: firstSource?.pageNumber ?? null,
          subjects: q.subjects.map((s) => ({
            id: s.subject.id,
            name: s.subject.name,
            slug: s.subject.slug,
          })),
          options: q.options.map((o) => ({
            id: o.id,
            label: o.label,
            content: o.content,
          })),
          assets: q.assets.map((a) => ({
            id: a.id,
            url: a.objectUrl || a.storagePath,
            caption: a.caption,
          })),
          hasVerifiedExplanation: q.explanations.length > 0,
          userHistory: {
            attemptCount: q.attempts.length,
            lastIsCorrect: q.attempts[0]?.isCorrect ?? null,
            isBookmarked: q.bookmarks.length > 0,
          },
        };
      })
      .filter((item): item is QuestionBankListItem => item !== null);

    return {
      dbConnected: true,
      totalCount,
      page: filters.page,
      pageSize: filters.pageSize,
      items,
    };
  } catch (error) {
    logger.error("SEARCH_QUESTIONS_QUERY_FAILED", error);
    return {
      dbConnected: false,
      totalCount: 0,
      page: filters.page,
      pageSize: filters.pageSize,
      items: [],
    };
  }
}

/**
 * Retorna os metadados do catálogo acadêmico (carreiras, bancas, cargos, disciplinas, edições e fontes jurídicas).
 */
export async function getAcademicCatalogMetadata() {
  if (!isDatabaseConfigured()) {
    return {
      dbConnected: false,
      tracks: INITIAL_STUDY_TRACKS,
      institutions: INITIAL_INSTITUTIONS,
      boards: INITIAL_EXAM_BOARDS,
      positions: INITIAL_POSITIONS,
      editions: INITIAL_EXAM_EDITIONS,
      subjects: INITIAL_SUBJECTS,
      legalSources: INITIAL_VERIFIED_LEGAL_SOURCES,
    };
  }

  try {
    const [tracks, institutions, boards, positions, editions, subjects, legalSources] =
      await Promise.all([
        prisma.studyTrack.findMany({ orderBy: { displayOrder: "asc" } }),
        prisma.institution.findMany({ orderBy: { acronym: "asc" } }),
        prisma.examBoard.findMany({ orderBy: { acronym: "asc" } }),
        prisma.position.findMany({ orderBy: { name: "asc" } }),
        prisma.examEdition.findMany({
          include: { examForms: true, examBoard: true, position: true, ruleset: true },
          orderBy: { year: "desc" },
        }),
        prisma.subject.findMany({
          where: { parentId: null },
          include: { children: { orderBy: { displayOrder: "asc" } } },
          orderBy: { displayOrder: "asc" },
        }),
        prisma.legalSource.findMany({
          include: { passages: true },
          orderBy: { title: "asc" },
        }),
      ]);

    return {
      dbConnected: true,
      tracks: tracks.length > 0 ? tracks : INITIAL_STUDY_TRACKS,
      institutions: institutions.length > 0 ? institutions : INITIAL_INSTITUTIONS,
      boards: boards.length > 0 ? boards : INITIAL_EXAM_BOARDS,
      positions: positions.length > 0 ? positions : INITIAL_POSITIONS,
      editions: editions.length > 0 ? editions : INITIAL_EXAM_EDITIONS,
      subjects: subjects.length > 0 ? subjects : INITIAL_SUBJECTS,
      legalSources:
        legalSources.length > 0 ? legalSources : INITIAL_VERIFIED_LEGAL_SOURCES,
    };
  } catch (error) {
    logger.error("CATALOG_METADATA_QUERY_FAILED", error);
    return {
      dbConnected: false,
      tracks: INITIAL_STUDY_TRACKS,
      institutions: INITIAL_INSTITUTIONS,
      boards: INITIAL_EXAM_BOARDS,
      positions: INITIAL_POSITIONS,
      editions: INITIAL_EXAM_EDITIONS,
      subjects: INITIAL_SUBJECTS,
      legalSources: INITIAL_VERIFIED_LEGAL_SOURCES,
    };
  }
}

export type FilterFacetTopic = {
  id: string;
  name: string;
  slug: string;
  parentId: string;
  totalCount: number;
  countByTrack: Record<string, number>;
};

export type FilterFacetDiscipline = {
  id: string;
  name: string;
  slug: string;
  totalCount: number;
  countByTrack: Record<string, number>;
  topics: FilterFacetTopic[];
};

export type QuestionBankFilterFacets = {
  totalPublished: number;
  countByTrack: Record<string, number>;
  disciplines: FilterFacetDiscipline[];
  years: number[];
};

/**
 * Calcula contagens reais de questões publicadas (não anuladas por padrão, ou incluindo anuladas)
 * por concurso, disciplina (incluindo descendentes) e assunto específico para alimentar os selects dependentes.
 */
export async function getQuestionBankFilterFacets(params?: {
  includeAnnulled?: boolean;
}): Promise<QuestionBankFilterFacets> {
  if (!isDatabaseConfigured()) {
    return {
      totalPublished: 0,
      countByTrack: {},
      disciplines: [],
      years: [2026, 2025, 2024, 2023, 2022, 2021, 2019],
    };
  }

  try {
    const includeAnnulled = Boolean(params?.includeAnnulled);
    const [rootSubjects, publishedQuestions] = await Promise.all([
      prisma.subject.findMany({
        where: { parentId: null },
        include: { children: { orderBy: { displayOrder: "asc" } } },
        orderBy: [{ displayOrder: "asc" }, { name: "asc" }],
      }),
      prisma.question.findMany({
        where: {
          status: "PUBLISHED",
          ...(includeAnnulled
            ? {}
            : { examInstances: { some: { isAnnulled: false } } }),
        },
        select: {
          id: true,
          subjects: {
            select: {
              subjectId: true,
              subject: { select: { parentId: true } },
            },
          },
          examInstances: {
            where: includeAnnulled ? {} : { isAnnulled: false },
            select: {
              examForm: {
                select: {
                  examEdition: {
                    select: {
                      year: true,
                      position: {
                        select: { studyTrack: { select: { code: true } } },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      }),
    ]);

    const countByTrack: Record<string, number> = {};
    const discTotalSets = new Map<string, Set<string>>();
    const discTrackSets = new Map<string, Map<string, Set<string>>>();
    const topicTotalSets = new Map<string, Set<string>>();
    const topicTrackSets = new Map<string, Map<string, Set<string>>>();
    const yearsSet = new Set<number>();

    const addToSetMap = (map: Map<string, Set<string>>, key: string, qId: string) => {
      let s = map.get(key);
      if (!s) {
        s = new Set();
        map.set(key, s);
      }
      s.add(qId);
    };

    const addToNestedSetMap = (
      map: Map<string, Map<string, Set<string>>>,
      outerKey: string,
      innerKey: string,
      qId: string
    ) => {
      let inner = map.get(outerKey);
      if (!inner) {
        inner = new Map();
        map.set(outerKey, inner);
      }
      addToSetMap(inner, innerKey, qId);
    };

    for (const q of publishedQuestions) {
      const tracksForQuestion = new Set<string>();
      for (const inst of q.examInstances) {
        const code = inst.examForm.examEdition.position.studyTrack.code;
        tracksForQuestion.add(code);
        yearsSet.add(inst.examForm.examEdition.year);
      }

      for (const code of tracksForQuestion) {
        countByTrack[code] = (countByTrack[code] ?? 0) + 1;
      }

      for (const qs of q.subjects) {
        const rootId = qs.subject.parentId ?? qs.subjectId;
        addToSetMap(discTotalSets, rootId, q.id);
        for (const code of tracksForQuestion) {
          addToNestedSetMap(discTrackSets, rootId, code, q.id);
        }

        if (qs.subject.parentId) {
          addToSetMap(topicTotalSets, qs.subjectId, q.id);
          for (const code of tracksForQuestion) {
            addToNestedSetMap(topicTrackSets, qs.subjectId, code, q.id);
          }
        }
      }
    }

    const disciplines: FilterFacetDiscipline[] = rootSubjects.map((root) => {
      const dTrackMap = discTrackSets.get(root.id);
      const dCountByTrack: Record<string, number> = {};
      if (dTrackMap) {
        for (const [code, set] of dTrackMap.entries()) {
          dCountByTrack[code] = set.size;
        }
      }

      const topics: FilterFacetTopic[] = root.children.map((child) => {
        const tTrackMap = topicTrackSets.get(child.id);
        const tCountByTrack: Record<string, number> = {};
        if (tTrackMap) {
          for (const [code, set] of tTrackMap.entries()) {
            tCountByTrack[code] = set.size;
          }
        }
        return {
          id: child.id,
          name: child.name,
          slug: child.slug,
          parentId: root.id,
          totalCount: topicTotalSets.get(child.id)?.size ?? 0,
          countByTrack: tCountByTrack,
        };
      });

      return {
        id: root.id,
        name: root.name,
        slug: root.slug,
        totalCount: discTotalSets.get(root.id)?.size ?? 0,
        countByTrack: dCountByTrack,
        topics,
      };
    });

    return {
      totalPublished: publishedQuestions.length,
      countByTrack,
      disciplines,
      years: Array.from(yearsSet).sort((a, b) => b - a),
    };
  } catch (error) {
    logger.error("QUESTION_FILTER_FACETS_FAILED", error);
    return {
      totalPublished: 0,
      countByTrack: {},
      disciplines: [],
      years: [2026, 2025, 2024, 2023, 2022, 2021, 2019],
    };
  }
}
