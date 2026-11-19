import { describe, expect, it } from "vitest";
import {
  evaluateItemPublishEligibility,
  type PublishEligibilityInput,
} from "@/features/imports/pipeline";

function buildVerifiedItem(
  overrides: Partial<PublishEligibilityInput> = {}
): PublishEligibilityInput {
  return {
    originalNumber: 10,
    questionType: "MULTIPLE_CHOICE",
    statement:
      "Considerando o disposto na Lei nº 10.261/68, assinale a alternativa correta sobre o processo revisional.",
    options: [
      { label: "A", content: "Alternativa A completa." },
      { label: "B", content: "Alternativa B completa." },
      { label: "C", content: "Alternativa C completa." },
      { label: "D", content: "Alternativa D completa." },
      { label: "E", content: "Alternativa E completa." },
    ],
    officialAnswer: "D",
    isAnnulled: false,
    subjectSlug: "estatuto-funcionarios-publicos-sp-lei-10261",
    classificationStatus: "CLASSIFIED",
    hasMissingVisualOrTable: false,
    answerKeyVerified: true,
    reviewState: "VERIFIED",
    validationStatus: "VERIFIED",
    reviewedAt: new Date("2026-11-19T18:00:00Z"),
    examDocVerificationStatus: "VERIFIED",
    answerKeyDocVerificationStatus: "VERIFIED",
    ...overrides,
  };
}

describe("Bloqueios Obrigatórios de Publicação na Curadoria (/admin/importacoes)", () => {
  it("autoriza publicação SOMENTE quando revisão humana, documentos, disciplina, visual e gabarito estão verificados", () => {
    const res = evaluateItemPublishEligibility(buildVerifiedItem());
    expect(res.eligible).toBe(true);
    expect(res.blockingReasons).toHaveLength(0);
  });

  it("bloqueia publicação de questão apenas STRUCTURALLY_VALID (sem aprovação humana VERIFIED)", () => {
    const res = evaluateItemPublishEligibility(
      buildVerifiedItem({
        reviewState: "STRUCTURALLY_VALID",
        validationStatus: "PENDING",
        reviewedAt: null,
      })
    );
    expect(res.eligible).toBe(false);
    expect(res.blockingReasons.some((r) => r.includes("Revisão humana incompleta"))).toBe(true);
  });

  it("bloqueia publicação de questão com imagem ou tabela ausente/pendente", () => {
    const res = evaluateItemPublishEligibility(
      buildVerifiedItem({ hasMissingVisualOrTable: true })
    );
    expect(res.eligible).toBe(false);
    expect(res.blockingReasons.some((r) => r.includes("figura/imagem/tabela"))).toBe(true);
  });

  it("bloqueia publicação de questão com classificação pendente (CLASSIFICATION_PENDING)", () => {
    const res = evaluateItemPublishEligibility(
      buildVerifiedItem({
        subjectSlug: "CLASSIFICATION_PENDING",
        classificationStatus: "CLASSIFICATION_PENDING",
      })
    );
    expect(res.eligible).toBe(false);
    expect(res.blockingReasons.some((r) => r.includes("CLASSIFICATION_PENDING"))).toBe(true);
  });

  it("bloqueia publicação quando o gabarito é duvidoso ou ainda não foi conferido com a banca", () => {
    const notChecked = evaluateItemPublishEligibility(
      buildVerifiedItem({ answerKeyVerified: false })
    );
    expect(notChecked.eligible).toBe(false);
    expect(notChecked.blockingReasons.some((r) => r.includes("Gabarito oficial"))).toBe(true);

    const doubtfulKey = evaluateItemPublishEligibility(
      buildVerifiedItem({ officialAnswer: "Z" })
    );
    expect(doubtfulKey.eligible).toBe(false);
    expect(doubtfulKey.blockingReasons.some((r) => r.includes("Gabarito duvidoso"))).toBe(true);
  });

  it("bloqueia publicação quando os PDFs enviados ainda estão PENDING (upload não equivale a verificação)", () => {
    const res = evaluateItemPublishEligibility(
      buildVerifiedItem({
        examDocVerificationStatus: "PENDING",
        answerKeyDocVerificationStatus: "PENDING",
      })
    );
    expect(res.eligible).toBe(false);
    expect(res.blockingReasons.length).toBeGreaterThanOrEqual(2);
  });
});
