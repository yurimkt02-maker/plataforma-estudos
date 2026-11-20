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
    const whereClause: Record<string, unknown> = {
      status: "PUBLISHED",
    };

    if (filters.questionType) {
      whereClause.questionType = filters.questionType;
    }
    if (filters.difficulty) {
      whereClause.difficulty = filters.difficulty;
    }
    if (filters.onlyOutdated) {
      whereClause.isOutdated = true;
    }
    if (filters.subjectId) {
      whereClause.subjects = {
        some: { subjectId: filters.subjectId },
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
      whereClause.OR = [
        { statement: { contains: filters.query, mode: "insensitive" } },
        { supportText: { contains: filters.query, mode: "insensitive" } },
      ];
    }

    if (filters.resolutionFilter === "RESOLVED") {
      whereClause.attempts = { some: { userId } };
    } else if (filters.resolutionFilter === "UNRESOLVED") {
      whereClause.attempts = { none: { userId } };
    }

    if (filters.accuracyFilter === "CORRECT") {
      whereClause.attempts = { some: { userId, isCorrect: true } };
    } else if (filters.accuracyFilter === "WRONG") {
      whereClause.attempts = { some: { userId, isCorrect: false } };
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

    const skip = (filters.page - 1) * filters.pageSize;

    const [totalCount, rows] = await Promise.all([
      prisma.question.count({ where: whereClause }),
      prisma.question.findMany({
        where: whereClause,
        skip,
        take: filters.pageSize,
        orderBy:
          filters.sortBy === "DIFFICULTY"
            ? { difficulty: "desc" }
            : { publishedAt: "desc" },
        include: {
          options: { orderBy: { displayOrder: "asc" } },
          assets: { orderBy: { position: "asc" } },
          subjects: { include: { subject: true } },
          sources: { include: { sourceDocument: true } },
          explanations: {
            where: { status: "VERIFIED" },
            select: { id: true },
          },
          bookmarks: {
            where: { userId },
            select: { id: true },
          },
          attempts: {
            where: { userId },
            orderBy: { answeredAt: "desc" },
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
        },
      }),
    ]);

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
