import { describe, expect, it } from "vitest";
import {
  auditExamCompleteness,
  detectAnswerKeyDivergences,
  resolveExpectedQuestionCount,
  validateExtractedQuestionItem,
  validateMultiVersionOptionMapping,
} from "@/features/imports/pipeline";

const VALID_SHA = "e8d2e14d699ff8ed4c047574def10130ace6dc9c04d8e35fbf048426472b7714";

describe("Regressão de Auditoria de Gabaritos e Múltiplas Versões de Caderno", () => {
  it("detecta divergência de anulação entre TJSP 08/09/2024 (Q30) e 24/11/2024 (Q21 e Q80)", () => {
    const storedInterior = [
      { originalNumber: 21, answerValue: "C", isAnnulled: false },
      { originalNumber: 30, answerValue: "ANULADA", isAnnulled: true },
      { originalNumber: 80, answerValue: "A", isAnnulled: false },
    ];

    // Gabarito oficial Vunesp 24/11/2024 (Capital — NjY2ODM2OA==): anuladas 21 e 80; 30 válida
    const referenceCapital2411 = {
      21: { answerValue: "ANULADA", isAnnulled: true },
      30: { answerValue: "B", isAnnulled: false },
      80: { answerValue: "ANULADA", isAnnulled: true },
    };

    const divergences = detectAnswerKeyDivergences(
      storedInterior,
      referenceCapital2411
    );

    expect(divergences).toHaveLength(3);
    expect(divergences.map((d) => d.originalNumber)).toEqual([21, 30, 80]);
    expect(divergences[0]?.referenceAnnulled).toBe(true);
    expect(divergences[1]?.storedAnnulled).toBe(true);
    expect(divergences[1]?.referenceAnnulled).toBe(false);
  });

  it("detecta divergência de letra alterada após recurso (retificação de gabarito)", () => {
    const stored = [
      { originalNumber: 12, answerValue: "B", isAnnulled: false },
      { originalNumber: 15, answerValue: "D", isAnnulled: false },
    ];
    const reference = {
      12: { answerValue: "B", isAnnulled: false },
      15: { answerValue: "E", isAnnulled: false },
    };

    const divergences = detectAnswerKeyDivergences(stored, reference);
    expect(divergences).toHaveLength(1);
    expect(divergences[0]?.originalNumber).toBe(15);
    expect(divergences[0]?.storedAnswer).toBe("D");
    expect(divergences[0]?.referenceAnswer).toBe("E");
  });

  it("bloqueia duplicação de caderno secundário sem optionMappingJson explícito", () => {
    const result = validateMultiVersionOptionMapping({
      canonicalAnswer: "B",
      versionAnswer: "B",
      isAnnulled: false,
      optionMapping: null,
      expectedLabels: ["A", "B", "C", "D", "E"],
    });

    expect(result.isValid).toBe(false);
    expect(result.error).toContain("optionMappingJson");
  });

  it("valida mapeamento bijetivo coerente entre caderno Tipo 1 e Tipo 2", () => {
    // No Tipo 2, alternativa C corresponde à alternativa B canônica do Tipo 1
    const result = validateMultiVersionOptionMapping({
      canonicalAnswer: "B",
      versionAnswer: "C",
      isAnnulled: false,
      optionMapping: { A: "D", B: "A", C: "B", D: "C" },
      expectedLabels: ["A", "B", "C", "D"],
    });

    expect(result.isValid).toBe(true);
    expect(result.error).toBeNull();
  });

  it("rejeita caderno secundário quando o gabarito diverge do mapeamento canônico", () => {
    const result = validateMultiVersionOptionMapping({
      canonicalAnswer: "B",
      versionAnswer: "A", // aponta para D, não para B!
      isAnnulled: false,
      optionMapping: { A: "D", B: "A", C: "B", D: "C" },
      expectedLabels: ["A", "B", "C", "D"],
    });

    expect(result.isValid).toBe(false);
    expect(result.error).toContain("Divergência entre cadernos");
  });

  it("encaminha automaticamente itens visuais/figuras para AWAITING_REVIEW sem publicar", () => {
    const res = validateExtractedQuestionItem({
      originalNumber: 24,
      questionType: "TRUE_FALSE",
      statement:
        "[ITEM VISUAL / FIGURA — PÁG. 3] Consulte a figura oficial da prova na página 3 para julgar este item.",
      options: [
        { label: "C", content: "Certo" },
        { label: "E", content: "Errado" },
      ],
      officialAnswer: "C",
      isAnnulled: false,
      subjectSlug: "interpretacao-e-compreensao-de-textos",
      pageNumber: 3,
      requiresHumanReview: true,
      reviewReason: "Item baseado em figura/diagrama (Página 3).",
      sourceDocumentSha256: VALID_SHA,
      examFormVersionLabel: "Caderno Padrão",
    });

    expect(res.isValid).toBe(true);
    expect(res.requiresHumanReview).toBe(true);
    expect(res.targetStatus).toBe("AWAITING_REVIEW");
  });

  it("calcula corretamente completude de prova parcial vs prova completa", () => {
    const partial = auditExamCompleteness({
      expectedCount: 100,
      items: Array.from({ length: 12 }, (_, idx) => ({
        originalNumber: idx + 1,
        officialAnswer: "A",
      })),
    });
    expect(partial.isComplete).toBe(false);
    expect(partial.completenessPercent).toBe(12);
    expect(partial.missingNumbers).toHaveLength(88);

    const complete = auditExamCompleteness({
      expectedCount: 80,
      items: Array.from({ length: 80 }, (_, idx) => ({
        originalNumber: idx + 1,
        officialAnswer: "B",
      })),
    });
    expect(complete.isComplete).toBe(true);
    expect(complete.completenessPercent).toBe(100);
    expect(complete.missingNumbers).toHaveLength(0);
  });

  it("resolve quantidade esperada por edição/caderno (TJSP 2025 = 70 vs TJSP 2024 = 100)", () => {
    const tjsp2025 = resolveExpectedQuestionCount({
      editionExpectedCount: 70,
      trackCode: "TJSP",
    });
    expect(tjsp2025).toBe(70);

    const tjsp2024 = resolveExpectedQuestionCount({
      editionExpectedCount: 100,
      trackCode: "TJSP",
    });
    expect(tjsp2024).toBe(100);

    // Override explícito por ExamForm tem precedência sobre ExamEdition
    const formOverride = resolveExpectedQuestionCount({
      formExpectedCount: 70,
      editionExpectedCount: 100,
      trackCode: "TJSP",
    });
    expect(formOverride).toBe(70);
  });
});
