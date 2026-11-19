export type SpacedRepetitionInput = {
  isCorrect: boolean;
  previousIntervalDays: number;
  previousEaseFactor: number;
  previousConsecutiveCorrect: number;
  previousErrorCount: number;
  declaredDifficulty?: "EASY" | "MEDIUM" | "HARD";
  now?: Date;
};

export type SpacedRepetitionSchedule = {
  intervalDays: number;
  easeFactor: number;
  consecutiveCorrect: number;
  errorCount: number;
  priority: number;
  status: "PENDING" | "COMPLETED";
  nextReviewAt: Date;
};

const BASE_INTERVALS_DAYS = [1, 3, 7, 14, 30, 60];

/**
 * Calcula o próximo agendamento de revisão espaçada baseado no desempenho real,
 * acertos consecutivos e dificuldade declarada.
 */
export function calculateNextReviewSchedule(
  input: SpacedRepetitionInput
): SpacedRepetitionSchedule {
  const now = input.now ?? new Date();
  let easeFactor = Math.max(1.3, input.previousEaseFactor || 2.5);
  let consecutiveCorrect = input.previousConsecutiveCorrect;
  let errorCount = input.previousErrorCount;
  let intervalDays = 1;

  if (!input.isCorrect) {
    consecutiveCorrect = 0;
    errorCount += 1;
    easeFactor = Number(Math.max(1.3, easeFactor - 0.25).toFixed(2));
    intervalDays = 1;
  } else {
    consecutiveCorrect += 1;
    if (input.declaredDifficulty === "HARD") {
      easeFactor = Number(Math.max(1.3, easeFactor - 0.15).toFixed(2));
    } else if (input.declaredDifficulty === "EASY") {
      easeFactor = Number(Math.min(3.0, easeFactor + 0.15).toFixed(2));
    }

    const baseIndex = Math.min(
      consecutiveCorrect - 1,
      BASE_INTERVALS_DAYS.length - 1
    );
    const baseStep = BASE_INTERVALS_DAYS[baseIndex] ?? 1;

    if (consecutiveCorrect <= 2) {
      intervalDays = baseStep;
    } else {
      intervalDays = Math.max(
        baseStep,
        Math.round(input.previousIntervalDays * easeFactor)
      );
    }

    if (input.declaredDifficulty === "HARD") {
      intervalDays = Math.max(1, Math.round(intervalDays * 0.7));
    }
  }

  // Prioridade mais alta (1 = crítica, 5 = estabilizada) para questões com mais erros e menor sequência de acertos
  const rawPriority = Math.max(
    1,
    Math.min(5, 4 - consecutiveCorrect + Math.min(2, errorCount - 1))
  );

  const nextReviewAt = new Date(
    now.getTime() + intervalDays * 24 * 60 * 60 * 1000
  );

  // Após 4 acertos consecutivos sem erro recente, o item é considerado consolidado
  const status = consecutiveCorrect >= 4 ? "COMPLETED" : "PENDING";

  return {
    intervalDays,
    easeFactor,
    consecutiveCorrect,
    errorCount,
    priority: rawPriority,
    status,
    nextReviewAt,
  };
}
