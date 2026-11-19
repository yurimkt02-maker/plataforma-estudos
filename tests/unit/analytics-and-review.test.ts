import { describe, expect, it } from "vitest";
import { computeStudyAnalytics } from "@/features/analytics/calculator";
import { calculateNextReviewSchedule } from "@/features/review/spaced-repetition";
import { questionFilterSchema } from "@/lib/validations/schemas";

describe("Cálculos Estatísticos e Revisão Espaçada", () => {
  it("diferencia total de tentativas de questões únicas, acerto na 1ª tentativa e recuperação de erros", () => {
    const t0 = new Date("2026-11-10T10:00:00Z");
    const t1 = new Date("2026-11-11T10:00:00Z");
    const t2 = new Date("2026-11-12T10:00:00Z");

    const metrics = computeStudyAnalytics([
      // Questão 1: acertou na 1ª tentativa
      {
        questionId: "q-1",
        subjectId: "s-1",
        subjectName: "Direito Constitucional",
        trackCode: "TJSP",
        isCorrect: true,
        timeSpentSeconds: 60,
        answeredAt: t0,
      },
      // Questão 2: errou na 1ª tentativa e depois recuperou na 2ª tentativa
      {
        questionId: "q-2",
        subjectId: "s-1",
        subjectName: "Direito Constitucional",
        trackCode: "TJSP",
        isCorrect: false,
        timeSpentSeconds: 90,
        answeredAt: t1,
      },
      {
        questionId: "q-2",
        subjectId: "s-1",
        subjectName: "Direito Constitucional",
        trackCode: "TJSP",
        isCorrect: true,
        timeSpentSeconds: 45,
        answeredAt: t2,
      },
    ]);

    expect(metrics.totalAttempts).toBe(3);
    expect(metrics.totalCorrectAttempts).toBe(2);
    expect(metrics.uniqueQuestionsAttempted).toBe(2);
    expect(metrics.uniqueQuestionsCorrectFirstTry).toBe(1);
    expect(metrics.firstTryAccuracyRate).toBe(50.0);
    expect(metrics.uniqueQuestionsInitiallyWrong).toBe(1);
    expect(metrics.uniqueQuestionsRecovered).toBe(1);
    expect(metrics.errorRecoveryRate).toBe(100.0);
    expect(metrics.averageTimePerAttemptSeconds).toBe(65);
  });

  it("calcula intervalos progressivos de revisão espaçada e reinicia ao errar", () => {
    const firstError = calculateNextReviewSchedule({
      isCorrect: false,
      previousIntervalDays: 7,
      previousEaseFactor: 2.5,
      previousConsecutiveCorrect: 2,
      previousErrorCount: 1,
    });
    expect(firstError.consecutiveCorrect).toBe(0);
    expect(firstError.intervalDays).toBe(1);
    expect(firstError.errorCount).toBe(2);
    expect(firstError.status).toBe("PENDING");

    const recovery1 = calculateNextReviewSchedule({
      isCorrect: true,
      previousIntervalDays: firstError.intervalDays,
      previousEaseFactor: firstError.easeFactor,
      previousConsecutiveCorrect: firstError.consecutiveCorrect,
      previousErrorCount: firstError.errorCount,
    });
    expect(recovery1.consecutiveCorrect).toBe(1);
    expect(recovery1.intervalDays).toBe(1);

    const recovery2 = calculateNextReviewSchedule({
      isCorrect: true,
      previousIntervalDays: recovery1.intervalDays,
      previousEaseFactor: recovery1.easeFactor,
      previousConsecutiveCorrect: recovery1.consecutiveCorrect,
      previousErrorCount: recovery1.errorCount,
    });
    expect(recovery2.consecutiveCorrect).toBe(2);
    expect(recovery2.intervalDays).toBe(3);
  });

  it("valida filtros do banco de questões com Zod", () => {
    const parsed = questionFilterSchema.parse({
      trackCode: "PRF",
      questionType: "TRUE_FALSE",
      resolutionFilter: "UNRESOLVED",
      onlyVerifiedExplanations: "true",
      page: "2",
      pageSize: "20",
    });

    expect(parsed.trackCode).toBe("PRF");
    expect(parsed.onlyVerifiedExplanations).toBe(true);
    expect(parsed.page).toBe(2);
    expect(parsed.pageSize).toBe(20);
  });
});
