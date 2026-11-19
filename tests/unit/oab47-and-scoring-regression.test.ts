import { describe, expect, it } from "vitest";
import {
  evaluateSingleAnswer,
  gradeSimulationAttempt,
  OFFICIAL_RULESETS,
  type OfficialAnswerKeySnapshot,
} from "@/features/scoring/engine";

const oabRuleset = OFFICIAL_RULESETS.FGV_OAB_1FASE_80!;
const prfRuleset = OFFICIAL_RULESETS.CEBRASPE_CERTO_ERRADO_PRF2021!;

const q47AnnulledKey: OfficialAnswerKeySnapshot = {
  id: "00000000-0000-4000-8000-000000000047",
  answerValue: "ANULADA",
  status: "ANNULLED",
  revisionNumber: 1,
  isDefinitive: true,
};

const keyB: OfficialAnswerKeySnapshot = {
  id: "00000000-0000-4000-8000-000000000011",
  answerValue: "B",
  status: "DEFINITIVE",
  revisionNumber: 1,
  isDefinitive: true,
};

const keyC: OfficialAnswerKeySnapshot = {
  id: "00000000-0000-4000-8000-000000000012",
  answerValue: "C",
  status: "DEFINITIVE",
  revisionNumber: 1,
  isDefinitive: true,
};

describe("Regressão OAB 47º Exame (Anulação Q47) e Contraste Certo/Errado (PRF) vs Múltipla Escolha", () => {
  it("atribui pontuação integral na Questão 47 anulada do 47º Exame OAB (Tipo 1) mesmo em resposta divergente ou em branco", () => {
    const markedWrong = evaluateSingleAnswer({
      selectedAnswer: "A",
      officialKey: q47AnnulledKey,
      ruleset: oabRuleset,
    });
    expect(markedWrong.isAnnulled).toBe(true);
    expect(markedWrong.isCorrect).toBe(true);
    expect(markedWrong.awardedPoints).toBe(1);

    const leftBlank = evaluateSingleAnswer({
      selectedAnswer: null,
      officialKey: q47AnnulledKey,
      ruleset: oabRuleset,
    });
    expect(leftBlank.isAnnulled).toBe(true);
    expect(leftBlank.isCorrect).toBe(true);
    expect(leftBlank.awardedPoints).toBe(1);
  });

  it("diferencia corretamente penalidade Certo/Errado (PRF Cebraspe -1) de múltipla escolha (OAB/TJSP/PCSP 0)", () => {
    const prfResult = gradeSimulationAttempt({
      attemptStatus: "IN_PROGRESS",
      ruleset: prfRuleset,
      items: [
        { simulationItemId: "i1", questionId: "q1", selectedAnswer: "C", officialKey: keyC, subjectId: "s1", subjectName: "CTB" },
        { simulationItemId: "i2", questionId: "q2", selectedAnswer: "E", officialKey: keyC, subjectId: "s1", subjectName: "CTB" },
        { simulationItemId: "i3", questionId: "q3", selectedAnswer: null, officialKey: keyC, subjectId: "s1", subjectName: "CTB" },
        { simulationItemId: "i4", questionId: "q4", selectedAnswer: "C", officialKey: q47AnnulledKey, subjectId: "s1", subjectName: "CTB" },
      ],
    });
    expect(prfResult.netScore).toBe(1);
    expect(prfResult.wrongCount).toBe(1);
    expect(prfResult.blankCount).toBe(1);
    expect(prfResult.annulledCount).toBe(1);

    const oabResult = gradeSimulationAttempt({
      attemptStatus: "IN_PROGRESS",
      ruleset: oabRuleset,
      items: [
        { simulationItemId: "o1", questionId: "oq1", selectedAnswer: "B", officialKey: keyB, subjectId: "s2", subjectName: "Ética" },
        { simulationItemId: "o2", questionId: "oq2", selectedAnswer: "A", officialKey: keyB, subjectId: "s2", subjectName: "Ética" },
        { simulationItemId: "o3", questionId: "oq3", selectedAnswer: null, officialKey: keyB, subjectId: "s2", subjectName: "Ética" },
        { simulationItemId: "o4", questionId: "oq4", selectedAnswer: "D", officialKey: q47AnnulledKey, subjectId: "s2", subjectName: "Empresarial" },
      ],
    });
    expect(oabResult.netScore).toBe(2);
    expect(oabResult.percentageScore).toBe(50);
  });
});
