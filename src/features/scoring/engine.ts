export type RulesetConfig = {
  code: string;
  name: string;
  questionType: "MULTIPLE_CHOICE" | "TRUE_FALSE";
  correctPoints: number;
  wrongPoints: number;
  blankPoints: number;
  annulledPolicy: "AWARD_TO_ALL" | "EXCLUDE_FROM_TOTAL" | "RECALCULATE_WEIGHT";
  minPassingPercentage: number;
};

export const OFFICIAL_RULESETS: Record<string, RulesetConfig> = {
  VUNESP_STANDARD_5: {
    code: "VUNESP_STANDARD_5",
    name: "Vunesp — Múltipla Escolha (5 alternativas A–E)",
    questionType: "MULTIPLE_CHOICE",
    correctPoints: 1.0,
    wrongPoints: 0.0,
    blankPoints: 0.0,
    annulledPolicy: "AWARD_TO_ALL",
    minPassingPercentage: 50.0,
  },
  CEBRASPE_CERTO_ERRADO_PRF2021: {
    code: "CEBRASPE_CERTO_ERRADO_PRF2021",
    name: "Cebraspe — Certo/Errado (PRF 2021: +1,00 acerto / -1,00 erro / 0,00 branco)",
    questionType: "TRUE_FALSE",
    correctPoints: 1.0,
    wrongPoints: -1.0,
    blankPoints: 0.0,
    annulledPolicy: "AWARD_TO_ALL",
    minPassingPercentage: 50.0,
  },
  FGV_OAB_1FASE_80: {
    code: "FGV_OAB_1FASE_80",
    name: "FGV — OAB 1ª Fase (80 questões A–D, aprovação mínima 50% / 40 pontos)",
    questionType: "MULTIPLE_CHOICE",
    correctPoints: 1.0,
    wrongPoints: 0.0,
    blankPoints: 0.0,
    annulledPolicy: "AWARD_TO_ALL",
    minPassingPercentage: 50.0,
  },
};

export type OfficialAnswerKeySnapshot = {
  id: string;
  answerValue: string;
  status:
    | "PRELIMINARY"
    | "DEFINITIVE"
    | "RECTIFIED"
    | "ANNULLED"
    | "PENDING_VERIFICATION";
  revisionNumber: number;
  isDefinitive: boolean;
};

export type SingleAnswerEvaluationInput = {
  selectedAnswer: string | null | undefined;
  officialKey: OfficialAnswerKeySnapshot;
  ruleset: RulesetConfig;
  isInstanceAnnulled?: boolean;
  /**
   * Mapeamento opcional entre a letra exibida na versão do caderno (ex: Caderno Azul)
   * e a alternativa correspondente no gabarito daquela versão.
   */
  optionMapping?: Record<string, string> | null;
  weight?: number;
  mode?: "STUDY_FREE" | "HISTORICAL_EXAM";
  excludeAnnulledInFreeStudy?: boolean;
};

export type SingleAnswerEvaluationResult = {
  normalizedSelectedAnswer: string | null;
  resolvedOfficialAnswer: string;
  isBlank: boolean;
  isAnnulled: boolean;
  excludedFromAccuracy: boolean;
  isCorrect: boolean;
  awardedPoints: number;
  maxPossiblePoints: number;
  officialKeyRevisionId: string;
  officialKeyRevisionNumber: number;
  officialKeyStatus: OfficialAnswerKeySnapshot["status"];
};

/**
 * Normaliza a resposta enviada pelo usuário (A-E ou C/E para Certo/Errado).
 */
export function normalizeAnswerToken(
  raw: string | null | undefined
): string | null {
  if (raw === null || raw === undefined) return null;
  const trimmed = raw.trim().toUpperCase();
  if (!trimmed || trimmed === "BLANK" || trimmed === "EM_BRANCO") {
    return null;
  }
  if (trimmed === "CERTO") return "C";
  if (trimmed === "ERRADO") return "E";
  return trimmed;
}

/**
 * Avalia uma única resposta aplicando as regras oficiais do edital ou do modo de estudo.
 * Executado exclusivamente no servidor para impedir manipulação de resultados pelo navegador.
 */
export function evaluateSingleAnswer(
  input: SingleAnswerEvaluationInput
): SingleAnswerEvaluationResult {
  const weight = input.weight ?? 1.0;
  const normalizedSelected = normalizeAnswerToken(input.selectedAnswer);
  const rawOfficial = normalizeAnswerToken(input.officialKey.answerValue) ?? "";

  // Caso a versão de caderno possua permutação de alternativas documentada
  const mappedSelected =
    normalizedSelected && input.optionMapping?.[normalizedSelected]
      ? normalizeAnswerToken(input.optionMapping[normalizedSelected])
      : normalizedSelected;

  const isAnnulled =
    Boolean(input.isInstanceAnnulled) ||
    input.officialKey.status === "ANNULLED" ||
    rawOfficial === "ANULADA" ||
    rawOfficial === "*";

  const isBlank = mappedSelected === null;
  const maxPossiblePoints = Number(
    (input.ruleset.correctPoints * weight).toFixed(2)
  );

  if (isAnnulled) {
    // No modo de estudo livre, permite excluir questões anuladas do cálculo de acurácia padrão
    if (
      input.mode === "STUDY_FREE" &&
      input.excludeAnnulledInFreeStudy === true
    ) {
      return {
        normalizedSelectedAnswer: normalizedSelected,
        resolvedOfficialAnswer: "ANULADA",
        isBlank,
        isAnnulled: true,
        excludedFromAccuracy: true,
        isCorrect: false,
        awardedPoints: 0,
        maxPossiblePoints: 0,
        officialKeyRevisionId: input.officialKey.id,
        officialKeyRevisionNumber: input.officialKey.revisionNumber,
        officialKeyStatus: input.officialKey.status,
      };
    }

    if (input.ruleset.annulledPolicy === "AWARD_TO_ALL") {
      return {
        normalizedSelectedAnswer: normalizedSelected,
        resolvedOfficialAnswer: "ANULADA",
        isBlank,
        isAnnulled: true,
        excludedFromAccuracy: false,
        isCorrect: true,
        awardedPoints: maxPossiblePoints,
        maxPossiblePoints,
        officialKeyRevisionId: input.officialKey.id,
        officialKeyRevisionNumber: input.officialKey.revisionNumber,
        officialKeyStatus: input.officialKey.status,
      };
    }

    return {
      normalizedSelectedAnswer: normalizedSelected,
      resolvedOfficialAnswer: "ANULADA",
      isBlank,
      isAnnulled: true,
      excludedFromAccuracy: true,
      isCorrect: false,
      awardedPoints: 0,
      maxPossiblePoints: 0,
      officialKeyRevisionId: input.officialKey.id,
      officialKeyRevisionNumber: input.officialKey.revisionNumber,
      officialKeyStatus: input.officialKey.status,
    };
  }

  if (isBlank) {
    return {
      normalizedSelectedAnswer: null,
      resolvedOfficialAnswer: rawOfficial,
      isBlank: true,
      isAnnulled: false,
      excludedFromAccuracy: false,
      isCorrect: false,
      awardedPoints: Number((input.ruleset.blankPoints * weight).toFixed(2)),
      maxPossiblePoints,
      officialKeyRevisionId: input.officialKey.id,
      officialKeyRevisionNumber: input.officialKey.revisionNumber,
      officialKeyStatus: input.officialKey.status,
    };
  }

  const isCorrect = mappedSelected === rawOfficial;
  const awardedPoints = isCorrect
    ? Number((input.ruleset.correctPoints * weight).toFixed(2))
    : Number((input.ruleset.wrongPoints * weight).toFixed(2));

  return {
    normalizedSelectedAnswer: normalizedSelected,
    resolvedOfficialAnswer: rawOfficial,
    isBlank: false,
    isAnnulled: false,
    excludedFromAccuracy: false,
    isCorrect,
    awardedPoints,
    maxPossiblePoints,
    officialKeyRevisionId: input.officialKey.id,
    officialKeyRevisionNumber: input.officialKey.revisionNumber,
    officialKeyStatus: input.officialKey.status,
  };
}

export type SimulationGradingItem = {
  simulationItemId: string;
  questionId: string;
  subjectId: string;
  subjectName: string;
  selectedAnswer: string | null | undefined;
  officialKey: OfficialAnswerKeySnapshot;
  isInstanceAnnulled?: boolean;
  optionMapping?: Record<string, string> | null;
  weight?: number;
};

export type SubjectPerformanceBreakdown = {
  subjectId: string;
  subjectName: string;
  totalItems: number;
  correctCount: number;
  wrongCount: number;
  blankCount: number;
  annulledCount: number;
  netPoints: number;
  maxPoints: number;
  percentageScore: number;
};

export type SimulationGradingReport = {
  rawScore: number;
  netScore: number;
  maxScore: number;
  percentageScore: number;
  passed: boolean;
  correctCount: number;
  wrongCount: number;
  blankCount: number;
  annulledCount: number;
  itemResults: Array<
    SingleAnswerEvaluationResult & {
      simulationItemId: string;
      questionId: string;
      subjectId: string;
    }
  >;
  bySubject: SubjectPerformanceBreakdown[];
};

/**
 * Corrige um simulado inteiro garantindo integridade transacional, suporte a pontuação líquida negativa
 * (ex: Cebraspe PRF 2021) e detalhamento por disciplina.
 */
export function gradeSimulationAttempt(params: {
  attemptStatus: "IN_PROGRESS" | "COMPLETED" | "ABANDONED";
  ruleset: RulesetConfig;
  items: SimulationGradingItem[];
  allowRecalculationOnRectification?: boolean;
}): SimulationGradingReport {
  const {
    attemptStatus,
    ruleset,
    items,
    allowRecalculationOnRectification = false,
  } = params;

  if (attemptStatus !== "IN_PROGRESS" && !allowRecalculationOnRectification) {
    throw new Error(
      "Simulados já encerrados não podem receber novas respostas ou alterações diretas."
    );
  }

  let rawScore = 0;
  let netScore = 0;
  let maxScore = 0;
  let correctCount = 0;
  let wrongCount = 0;
  let blankCount = 0;
  let annulledCount = 0;

  const subjectMap = new Map<string, SubjectPerformanceBreakdown>();
  const itemResults: SimulationGradingReport["itemResults"] = [];

  for (const item of items) {
    const evalResult = evaluateSingleAnswer({
      selectedAnswer: item.selectedAnswer,
      officialKey: item.officialKey,
      ruleset,
      isInstanceAnnulled: item.isInstanceAnnulled,
      optionMapping: item.optionMapping,
      weight: item.weight ?? 1.0,
      mode: "HISTORICAL_EXAM",
    });

    itemResults.push({
      ...evalResult,
      simulationItemId: item.simulationItemId,
      questionId: item.questionId,
      subjectId: item.subjectId,
    });

    maxScore += evalResult.maxPossiblePoints;
    netScore += evalResult.awardedPoints;
    if (evalResult.awardedPoints > 0) {
      rawScore += evalResult.awardedPoints;
    }

    if (evalResult.isAnnulled) {
      annulledCount += 1;
      if (evalResult.isCorrect) {
        correctCount += 1;
      }
    } else if (evalResult.isBlank) {
      blankCount += 1;
    } else if (evalResult.isCorrect) {
      correctCount += 1;
    } else {
      wrongCount += 1;
    }

    const existingSubj = subjectMap.get(item.subjectId) ?? {
      subjectId: item.subjectId,
      subjectName: item.subjectName,
      totalItems: 0,
      correctCount: 0,
      wrongCount: 0,
      blankCount: 0,
      annulledCount: 0,
      netPoints: 0,
      maxPoints: 0,
      percentageScore: 0,
    };

    existingSubj.totalItems += 1;
    existingSubj.netPoints = Number(
      (existingSubj.netPoints + evalResult.awardedPoints).toFixed(2)
    );
    existingSubj.maxPoints = Number(
      (existingSubj.maxPoints + evalResult.maxPossiblePoints).toFixed(2)
    );

    if (evalResult.isAnnulled) {
      existingSubj.annulledCount += 1;
      if (evalResult.isCorrect) existingSubj.correctCount += 1;
    } else if (evalResult.isBlank) {
      existingSubj.blankCount += 1;
    } else if (evalResult.isCorrect) {
      existingSubj.correctCount += 1;
    } else {
      existingSubj.wrongCount += 1;
    }

    existingSubj.percentageScore =
      existingSubj.maxPoints > 0
        ? Number(
            Math.max(
              0,
              (existingSubj.netPoints / existingSubj.maxPoints) * 100
            ).toFixed(2)
          )
        : 0;

    subjectMap.set(item.subjectId, existingSubj);
  }

  const roundedRaw = Number(rawScore.toFixed(2));
  const roundedNet = Number(netScore.toFixed(2));
  const roundedMax = Number(maxScore.toFixed(2));
  const percentageScore =
    roundedMax > 0
      ? Number(Math.max(0, (roundedNet / roundedMax) * 100).toFixed(2))
      : 0;

  return {
    rawScore: roundedRaw,
    netScore: roundedNet,
    maxScore: roundedMax,
    percentageScore,
    passed: percentageScore >= ruleset.minPassingPercentage,
    correctCount,
    wrongCount,
    blankCount,
    annulledCount,
    itemResults,
    bySubject: Array.from(subjectMap.values()),
  };
}
