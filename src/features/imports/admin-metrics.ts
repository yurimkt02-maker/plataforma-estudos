import { isDatabaseConfigured, prisma } from "@/lib/db/prisma";

export type ExamCompletenessSummary = {
  editionId: string;
  editionCode: string;
  title: string;
  trackCode: string;
  examBoardName: string;
  examDate: string | null;
  expectedQuestions: number;
  importedQuestions: number;
  publishedQuestions: number;
  awaitingReviewQuestions: number;
  annulledCount: number;
  extractionPercent: number;
  completenessStatus: "COMPLETE" | "PARTIAL" | "EMPTY";
  verifiedSourceDocsCount: number;
  pendingSourceDocsCount: number;
};

export type AdminInventoryMetrics = {
  dbConnected: boolean;
  totals: {
    publishedQuestions: number;
    awaitingReviewQuestions: number;
    rejectedImportItems: number;
    importedExamsCount: number;
    completeExamsCount: number;
    partialExamsCount: number;
    validatedAnswerKeysCount: number;
    divergentAnswerKeysCount: number;
    questionsWithoutDisciplineCount: number;
    annulledQuestionsCount: number;
    verifiedExplanationsCount: number;
    pendingExplanationsCount: number;
    verifiedLegalSourcesCount: number;
  };
  byTrack: Array<{
    trackCode: string;
    trackName: string;
    publishedQuestions: number;
    awaitingReviewQuestions: number;
    examEditionsWithQuestions: number;
  }>;
  byExam: ExamCompletenessSummary[];
  sourceDocuments: Array<{
    id: string;
    editionCode: string;
    documentType: string;
    title: string;
    officialUrl: string;
    sha256Prefix: string;
    verificationStatus: string;
    linkedQuestions: number;
    linkedAnswerKeys: number;
    sourceDate: string | null;
  }>;
  bySubject: Array<{
    subjectId: string;
    subjectName: string;
    parentName: string | null;
    questionCount: number;
  }>;
  importHistory: Array<{
    id: string;
    editionCode: string;
    editionTitle: string;
    versionLabel: string;
    status: string;
    totalDetected: number;
    totalValidated: number;
    totalPublished: number;
    rejectedCount: number;
    errorMessage: string | null;
    createdAt: string;
    finishedAt: string | null;
  }>;
};

/**
 * Consulta indicadores reais de qualidade do acervo diretamente no Prisma Postgres
 * para o Painel Administrativo (/admin/acervo).
 */
export async function getAdminInventoryMetrics(): Promise<AdminInventoryMetrics> {
  if (!isDatabaseConfigured()) {
    return {
      dbConnected: false,
      totals: {
        publishedQuestions: 0,
        awaitingReviewQuestions: 0,
        rejectedImportItems: 0,
        importedExamsCount: 0,
        completeExamsCount: 0,
        partialExamsCount: 0,
        validatedAnswerKeysCount: 0,
        divergentAnswerKeysCount: 0,
        questionsWithoutDisciplineCount: 0,
        annulledQuestionsCount: 0,
        verifiedExplanationsCount: 0,
        pendingExplanationsCount: 0,
        verifiedLegalSourcesCount: 0,
      },
      byTrack: [],
      byExam: [],
      sourceDocuments: [],
      bySubject: [],
      importHistory: [],
    };
  }

  const [
    publishedQuestions,
    awaitingReviewQuestions,
    rejectedImportItems,
    validatedAnswerKeysCount,
    annulledQuestionsCount,
    questionsWithoutDisciplineCount,
    verifiedExplanationsCount,
    pendingExplanationsCount,
    verifiedLegalSourcesCount,
    auditDivergenceLogsCount,
    rectifiedKeysCount,
    tracks,
    editions,
    sourceDocs,
    subjects,
    importJobs,
  ] = await Promise.all([
    prisma.question.count({ where: { status: "PUBLISHED" } }),
    prisma.question.count({ where: { status: "AWAITING_REVIEW" } }),
    prisma.importJobItem.count({ where: { validationStatus: "REJECTED" } }),
    prisma.officialAnswerKey.count({ where: { isDefinitive: true } }),
    prisma.examQuestionInstance.count({ where: { isAnnulled: true } }),
    prisma.question.count({
      where: {
        status: { in: ["PUBLISHED", "AWAITING_REVIEW"] },
        subjects: { none: {} },
      },
    }),
    prisma.questionExplanation.count({ where: { status: "VERIFIED" } }),
    prisma.questionExplanation.count({
      where: { status: { not: "VERIFIED" } },
    }),
    prisma.legalSource.count({ where: { verificationStatus: "VERIFIED" } }),
    prisma.contentReviewLog.count({
      where: { action: "ANSWER_KEY_AUDIT_DIVERGENCE" },
    }),
    prisma.officialAnswerKey.count({ where: { status: "RECTIFIED" } }),
    prisma.studyTrack.findMany({
      orderBy: { displayOrder: "asc" },
      include: {
        positions: {
          include: {
            examEditions: {
              include: {
                examForms: {
                  include: {
                    questionInstances: {
                      select: {
                        questionId: true,
                        question: { select: { status: true } },
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
    prisma.examEdition.findMany({
      orderBy: [{ year: "desc" }, { editionCode: "asc" }],
      include: {
        position: { include: { studyTrack: { select: { code: true } } } },
        examBoard: { select: { name: true } },
        ruleset: { select: { code: true, passingRulesJson: true } },
        sourceDocuments: { select: { verificationStatus: true } },
        examForms: {
          include: {
            questionInstances: {
              select: {
                questionId: true,
                originalNumber: true,
                isAnnulled: true,
                question: { select: { status: true } },
              },
            },
          },
        },
      },
    }),
    prisma.sourceDocument.findMany({
      orderBy: { retrievedAt: "desc" },
      include: {
        examEdition: { select: { editionCode: true } },
        _count: { select: { questionSources: true, answerKeys: true } },
      },
    }),
    prisma.subject.findMany({
      include: {
        parent: { select: { name: true } },
        questionSubjects: {
          where: { question: { status: "PUBLISHED" } },
          select: { questionId: true },
        },
      },
      orderBy: [{ displayOrder: "asc" }, { name: "asc" }],
    }),
    prisma.importJob.findMany({
      include: {
        examEdition: true,
        examForm: true,
        items: { select: { validationStatus: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 30,
    }),
  ]);

  const expectedByTrack: Record<string, number> = {
    TJSP: 100,
    PCSP: 80,
    PRF: 120,
    OAB: 80,
  };

  const byExam: ExamCompletenessSummary[] = editions.map((ed) => {
    const rulesObj =
      ed.ruleset.passingRulesJson &&
      typeof ed.ruleset.passingRulesJson === "object" &&
      !Array.isArray(ed.ruleset.passingRulesJson)
        ? (ed.ruleset.passingRulesJson as Record<string, unknown>)
        : {};
    const rulesTotal =
      typeof rulesObj.totalQuestions === "number" ? rulesObj.totalQuestions : null;
    const expectedQuestions =
      rulesTotal ?? expectedByTrack[ed.position.studyTrack.code] ?? 100;
    const defaultForm = ed.examForms.find((f) => f.isDefault) ?? ed.examForms[0];
    const instances = defaultForm?.questionInstances ?? [];

    const activeInstances = instances.filter(
      (i) => i.question.status !== "ARCHIVED"
    );
    const importedNums = new Set(activeInstances.map((i) => i.originalNumber));
    const publishedCount = new Set(
      activeInstances
        .filter((i) => i.question.status === "PUBLISHED")
        .map((i) => i.originalNumber)
    ).size;
    const awaitingCount = new Set(
      activeInstances
        .filter((i) => i.question.status === "AWAITING_REVIEW")
        .map((i) => i.originalNumber)
    ).size;
    const annulledCount = activeInstances.filter((i) => i.isAnnulled).length;

    const importedQuestions = importedNums.size;
    const extractionPercent =
      expectedQuestions > 0
        ? Math.min(
            100,
            Number(((importedQuestions / expectedQuestions) * 100).toFixed(1))
          )
        : 0;

    const completenessStatus: ExamCompletenessSummary["completenessStatus"] =
      importedQuestions === 0
        ? "EMPTY"
        : importedQuestions >= expectedQuestions
          ? "COMPLETE"
          : "PARTIAL";

    return {
      editionId: ed.id,
      editionCode: ed.editionCode,
      title: ed.title,
      trackCode: ed.position.studyTrack.code,
      examBoardName: ed.examBoard.name,
      examDate: ed.examDate?.toISOString().slice(0, 10) ?? null,
      expectedQuestions,
      importedQuestions,
      publishedQuestions: publishedCount,
      awaitingReviewQuestions: awaitingCount,
      annulledCount,
      extractionPercent,
      completenessStatus,
      verifiedSourceDocsCount: ed.sourceDocuments.filter(
        (d) => d.verificationStatus === "VERIFIED"
      ).length,
      pendingSourceDocsCount: ed.sourceDocuments.filter(
        (d) => d.verificationStatus === "PENDING"
      ).length,
    };
  });

  const completeExamsCount = byExam.filter(
    (e) => e.completenessStatus === "COMPLETE"
  ).length;
  const partialExamsCount = byExam.filter(
    (e) => e.completenessStatus === "PARTIAL"
  ).length;
  const importedExamsCount = completeExamsCount + partialExamsCount;

  const byTrack = tracks.map((track) => {
    const publishedIds = new Set<string>();
    const awaitingIds = new Set<string>();
    let editionsCount = 0;

    for (const pos of track.positions) {
      for (const ed of pos.examEditions) {
        let edHasQuestions = false;
        for (const form of ed.examForms) {
          for (const inst of form.questionInstances) {
            if (inst.question.status === "PUBLISHED") {
              publishedIds.add(inst.questionId);
              edHasQuestions = true;
            } else if (inst.question.status === "AWAITING_REVIEW") {
              awaitingIds.add(inst.questionId);
              edHasQuestions = true;
            }
          }
        }
        if (edHasQuestions) editionsCount += 1;
      }
    }

    return {
      trackCode: track.code,
      trackName: track.name,
      publishedQuestions: publishedIds.size,
      awaitingReviewQuestions: awaitingIds.size,
      examEditionsWithQuestions: editionsCount,
    };
  });

  const sourceDocuments = sourceDocs.map((doc) => ({
    id: doc.id,
    editionCode: doc.examEdition.editionCode,
    documentType: doc.documentType,
    title: doc.title,
    officialUrl: doc.officialUrl,
    sha256Prefix: doc.sha256.slice(0, 16),
    verificationStatus: doc.verificationStatus,
    linkedQuestions: doc._count.questionSources,
    linkedAnswerKeys: doc._count.answerKeys,
    sourceDate: doc.sourceDate?.toISOString().slice(0, 10) ?? null,
  }));

  const bySubject = subjects
    .map((s) => ({
      subjectId: s.id,
      subjectName: s.name,
      parentName: s.parent?.name ?? null,
      questionCount: new Set(s.questionSubjects.map((qs) => qs.questionId)).size,
    }))
    .filter((s) => s.questionCount > 0)
    .sort((a, b) => b.questionCount - a.questionCount);

  const importHistory = importJobs.map((job) => ({
    id: job.id,
    editionCode: job.examEdition.editionCode,
    editionTitle: job.examEdition.title,
    versionLabel: job.examForm.versionLabel,
    status: job.status,
    totalDetected: job.totalDetected,
    totalValidated: job.totalValidated,
    totalPublished: job.totalPublished,
    rejectedCount: job.items.filter((i) => i.validationStatus === "REJECTED")
      .length,
    errorMessage: job.errorMessage,
    createdAt: job.createdAt.toISOString(),
    finishedAt: job.finishedAt?.toISOString() ?? null,
  }));

  return {
    dbConnected: true,
    totals: {
      publishedQuestions,
      awaitingReviewQuestions,
      rejectedImportItems,
      importedExamsCount,
      completeExamsCount,
      partialExamsCount,
      validatedAnswerKeysCount,
      divergentAnswerKeysCount: auditDivergenceLogsCount + rectifiedKeysCount,
      questionsWithoutDisciplineCount,
      annulledQuestionsCount,
      verifiedExplanationsCount,
      pendingExplanationsCount,
      verifiedLegalSourcesCount,
    },
    byTrack,
    byExam,
    sourceDocuments,
    bySubject,
    importHistory,
  };
}
