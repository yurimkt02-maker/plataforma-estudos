export type AttemptRecordForAnalytics = {
  questionId: string;
  subjectId: string;
  subjectName: string;
  trackCode: string;
  isCorrect: boolean;
  timeSpentSeconds: number;
  answeredAt: Date;
};

export type PerformanceMetricsSummary = {
  totalAttempts: number;
  totalCorrectAttempts: number;
  overallAttemptAccuracy: number;
  uniqueQuestionsAttempted: number;
  uniqueQuestionsCorrectFirstTry: number;
  firstTryAccuracyRate: number;
  uniqueQuestionsInitiallyWrong: number;
  uniqueQuestionsRecovered: number;
  errorRecoveryRate: number;
  totalTimeSpentSeconds: number;
  averageTimePerAttemptSeconds: number;
};

/**
 * Calcula estatísticas rigorosas diferenciando tentativas totais de questões únicas,
 * taxa de acerto na primeira tentativa e taxa de recuperação de erros anteriores.
 */
export function computeStudyAnalytics(
  attempts: AttemptRecordForAnalytics[]
): PerformanceMetricsSummary {
  if (attempts.length === 0) {
    return {
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
  }

  // Ordenar cronologicamente para identificar a 1ª tentativa e recuperações reais
  const sorted = [...attempts].sort(
    (a, b) => a.answeredAt.getTime() - b.answeredAt.getTime()
  );

  let totalCorrectAttempts = 0;
  let totalTimeSpentSeconds = 0;

  const questionHistory = new Map<
    string,
    {
      firstTryCorrect: boolean;
      hadError: boolean;
      latestCorrect: boolean;
      attemptCount: number;
    }
  >();

  for (const att of sorted) {
    if (att.isCorrect) totalCorrectAttempts += 1;
    totalTimeSpentSeconds += Math.max(0, att.timeSpentSeconds);

    const existing = questionHistory.get(att.questionId);
    if (!existing) {
      questionHistory.set(att.questionId, {
        firstTryCorrect: att.isCorrect,
        hadError: !att.isCorrect,
        latestCorrect: att.isCorrect,
        attemptCount: 1,
      });
    } else {
      existing.attemptCount += 1;
      if (!att.isCorrect) existing.hadError = true;
      existing.latestCorrect = att.isCorrect;
    }
  }

  const uniqueQuestionsAttempted = questionHistory.size;
  let uniqueQuestionsCorrectFirstTry = 0;
  let uniqueQuestionsInitiallyWrong = 0;
  let uniqueQuestionsRecovered = 0;

  for (const qState of questionHistory.values()) {
    if (qState.firstTryCorrect) {
      uniqueQuestionsCorrectFirstTry += 1;
    }
    if (qState.hadError) {
      uniqueQuestionsInitiallyWrong += 1;
      if (qState.attemptCount > 1 && qState.latestCorrect) {
        uniqueQuestionsRecovered += 1;
      }
    }
  }

  const totalAttempts = sorted.length;
  const overallAttemptAccuracy = Number(
    ((totalCorrectAttempts / totalAttempts) * 100).toFixed(2)
  );
  const firstTryAccuracyRate =
    uniqueQuestionsAttempted > 0
      ? Number(
          (
            (uniqueQuestionsCorrectFirstTry / uniqueQuestionsAttempted) *
            100
          ).toFixed(2)
        )
      : 0;
  const errorRecoveryRate =
    uniqueQuestionsInitiallyWrong > 0
      ? Number(
          (
            (uniqueQuestionsRecovered / uniqueQuestionsInitiallyWrong) *
            100
          ).toFixed(2)
        )
      : 0;
  const averageTimePerAttemptSeconds = Math.round(
    totalTimeSpentSeconds / totalAttempts
  );

  return {
    totalAttempts,
    totalCorrectAttempts,
    overallAttemptAccuracy,
    uniqueQuestionsAttempted,
    uniqueQuestionsCorrectFirstTry,
    firstTryAccuracyRate,
    uniqueQuestionsInitiallyWrong,
    uniqueQuestionsRecovered,
    errorRecoveryRate,
    totalTimeSpentSeconds,
    averageTimePerAttemptSeconds,
  };
}
