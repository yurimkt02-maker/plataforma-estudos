import { describe, expect, it } from "vitest";
import {
  evaluateSingleAnswer,
  gradeSimulationAttempt,
  OFFICIAL_RULESETS,
  type OfficialAnswerKeySnapshot,
} from "@/features/scoring/engine";

const vunespRuleset = OFFICIAL_RULESETS.VUNESP_STANDARD_5!;
const prfRuleset = OFFICIAL_RULESETS.CEBRASPE_CERTO_ERRADO_PRF2021!;

const definitiveKeyB: OfficialAnswerKeySnapshot = {
  id: "00000000-0000-4000-8000-000000000001",
  answerValue: "B",
  status: "DEFINITIVE",
  revisionNumber: 1,
  isDefinitive: true,
};

const definitiveKeyCerto: OfficialAnswerKeySnapshot = {
  id: "00000000-0000-4000-8000-000000000002",
  answerValue: "C",
  status: "DEFINITIVE",
  revisionNumber: 1,
  isDefinitive: true,
};

const annulledKey: OfficialAnswerKeySnapshot = {
  id: "00000000-0000-4000-8000-000000000003",
  answerValue: "ANULADA",
  status: "ANNULLED",
  revisionNumber: 2,
  isDefinitive: true,
};

describe("Motor de Correção (Scoring Engine)", () => {
  it("avalia acerto, erro e resposta em branco em múltipla escolha (Vunesp TJSP/PCSP)", () => {
    const correct = evaluateSingleAnswer({
      selectedAnswer: "B",
      officialKey: definitiveKeyB,
      ruleset: vunespRuleset,
    });
    expect(correct.isCorrect).toBe(true);
    expect(correct.awardedPoints).toBe(1.0);
    expect(correct.officialKeyRevisionId).toBe(definitiveKeyB.id);

    const wrong = evaluateSingleAnswer({
      selectedAnswer: "D",
      officialKey: definitiveKeyB,
      ruleset: vunespRuleset,
    });
    expect(wrong.isCorrect).toBe(false);
    expect(wrong.awardedPoints).toBe(0.0);

    const blank = evaluateSingleAnswer({
      selectedAnswer: null,
      officialKey: definitiveKeyB,
      ruleset: vunespRuleset,
    });
    expect(blank.isBlank).toBe(true);
    expect(blank.isCorrect).toBe(false);
    expect(blank.awardedPoints).toBe(0.0);
  });

  it("aplica pontuação negativa (-1,00) e resposta em branco (0,00) no modelo Cebraspe PRF 2021", () => {
    const hit = evaluateSingleAnswer({
      selectedAnswer: "CERTO",
      officialKey: definitiveKeyCerto,
      ruleset: prfRuleset,
    });
    expect(hit.isCorrect).toBe(true);
    expect(hit.awardedPoints).toBe(1.0);

    const miss = evaluateSingleAnswer({
      selectedAnswer: "ERRADO",
      officialKey: definitiveKeyCerto,
      ruleset: prfRuleset,
    });
    expect(miss.isCorrect).toBe(false);
    expect(miss.awardedPoints).toBe(-1.0);

    const blank = evaluateSingleAnswer({
      selectedAnswer: "",
      officialKey: definitiveKeyCerto,
      ruleset: prfRuleset,
    });
    expect(blank.isBlank).toBe(true);
    expect(blank.awardedPoints).toBe(0.0);
  });

  it("trata questões anuladas conforme o edital na prova histórica e permite exclusão no estudo livre", () => {
    const historicalAnnulled = evaluateSingleAnswer({
      selectedAnswer: "E",
      officialKey: annulledKey,
      ruleset: vunespRuleset,
      mode: "HISTORICAL_EXAM",
    });
    expect(historicalAnnulled.isAnnulled).toBe(true);
    expect(historicalAnnulled.isCorrect).toBe(true);
    expect(historicalAnnulled.awardedPoints).toBe(1.0);

    const freeStudyExcluded = evaluateSingleAnswer({
      selectedAnswer: "E",
      officialKey: annulledKey,
      ruleset: vunespRuleset,
      mode: "STUDY_FREE",
      excludeAnnulledInFreeStudy: true,
    });
    expect(freeStudyExcluded.isAnnulled).toBe(true);
    expect(freeStudyExcluded.excludedFromAccuracy).toBe(true);
    expect(freeStudyExcluded.awardedPoints).toBe(0);
    expect(freeStudyExcluded.maxPossiblePoints).toBe(0);
  });

  it("suporta versões de caderno com alternativas reordenadas (optionMapping)", () => {
    // No Caderno V2, a alternativa exibida como "A" equivale à alternativa "B" do gabarito-base
    const mappedHit = evaluateSingleAnswer({
      selectedAnswer: "A",
      officialKey: definitiveKeyB,
      ruleset: vunespRuleset,
      optionMapping: { A: "B", B: "C", C: "D", D: "E", E: "A" },
    });
    expect(mappedHit.isCorrect).toBe(true);
    expect(mappedHit.awardedPoints).toBe(1.0);
  });

  it("bloqueia alteração de simulado já encerrado e permite recálculo auditado em retificação de gabarito", () => {
    expect(() =>
      gradeSimulationAttempt({
        attemptStatus: "COMPLETED",
        ruleset: prfRuleset,
        items: [],
      })
    ).toThrow(/Simulados já encerrados/);

    const rectifiedKey: OfficialAnswerKeySnapshot = {
      id: "00000000-0000-4000-8000-000000000099",
      answerValue: "E",
      status: "RECTIFIED",
      revisionNumber: 2,
      isDefinitive: true,
    };

    const report = gradeSimulationAttempt({
      attemptStatus: "COMPLETED",
      allowRecalculationOnRectification: true,
      ruleset: prfRuleset,
      items: [
        {
          simulationItemId: "item-1",
          questionId: "q-1",
          subjectId: "subj-ctb",
          subjectName: "Legislação de Trânsito",
          selectedAnswer: "E",
          officialKey: rectifiedKey,
        },
        {
          simulationItemId: "item-2",
          questionId: "q-2",
          subjectId: "subj-ctb",
          subjectName: "Legislação de Trânsito",
          selectedAnswer: "E",
          officialKey: definitiveKeyCerto,
        },
        {
          simulationItemId: "item-3",
          questionId: "q-3",
          subjectId: "subj-penal",
          subjectName: "Direito Penal",
          selectedAnswer: null,
          officialKey: definitiveKeyCerto,
        },
      ],
    });

    // 1 acerto (+1) + 1 erro (-1) + 1 em branco (0) = pontuação líquida 0
    expect(report.correctCount).toBe(1);
    expect(report.wrongCount).toBe(1);
    expect(report.blankCount).toBe(1);
    expect(report.rawScore).toBe(1.0);
    expect(report.netScore).toBe(0.0);
    expect(report.bySubject).toHaveLength(2);
  });
});
