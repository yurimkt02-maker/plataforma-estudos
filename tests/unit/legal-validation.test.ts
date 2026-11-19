import { describe, expect, it } from "vitest";
import {
  validateLegalExplanation,
  type RegisteredLegalSourceRecord,
} from "@/features/legal-knowledge/validator";

const verifiedConstitutionSource: RegisteredLegalSourceRecord = {
  id: "11111111-1111-4111-8111-111111111111",
  sourceType: "CONSTITUTION",
  authority: "Planalto",
  title: "Constituição Federal de 1988",
  officialUrl: "https://www.planalto.gov.br/ccivil_03/constituicao/constituicao.htm",
  documentNumber: "CF/1988",
  verificationStatus: "VERIFIED",
  passages: [
    {
      id: "22222222-2222-4222-8222-222222222222",
      referenceLabel: "CF/1988, Art. 5º, XI",
      content: "A casa é asilo inviolável do indivíduo...",
      textHash: "hash-cf-art5-xi",
      isCurrentlyInForce: true,
    },
  ],
};

const outdatedLawSource: RegisteredLegalSourceRecord = {
  id: "33333333-3333-4333-8333-333333333333",
  sourceType: "FEDERAL_LAW",
  authority: "Planalto",
  title: "Lei nº 8.429/1992 (Redação anterior à Lei 14.230/2021)",
  officialUrl: "https://www.planalto.gov.br/ccivil_03/leis/l8429.htm",
  documentNumber: "Lei 8.429/1992",
  verificationStatus: "VERIFIED",
  passages: [
    {
      id: "44444444-4444-4444-8444-444444444444",
      referenceLabel: "Lei 8.429/1992, Art. 10 (modalidade culposa revogada)",
      content: "Constitui ato de improbidade administrativa que causa lesão ao erário qualquer ação ou omissão, dolosa ou culposa...",
      textHash: "hash-lia-old",
      effectiveTo: new Date("2021-10-25"),
      isCurrentlyInForce: false,
    },
  ],
};

describe("Validação Jurídica e Auditoria de Comentários (Legal Validator)", () => {
  it("aprova como VERIFIED apenas quando alinhado ao gabarito oficial e com citação verificada em vigor", () => {
    const result = validateLegalExplanation(
      {
        questionId: "q-cf-1",
        officialKeyRevisionId: "key-1",
        officialAnswerValue: "A",
        claimedCorrectAnswerValue: "A",
        summary: "Inviolabilidade domiciliar (Art. 5º, XI, CF/88).",
        correctOptionAnalysis: "A alternativa A reproduz o Art. 5º, XI da CF/88.",
        wrongOptionsAnalysis: { B: "Incorreta." },
        historicalUnderstanding: "Na época da prova, regia o Art. 5º, XI da CF/88.",
        currentUnderstanding: "Permanece em pleno vigor o Art. 5º, XI da CF/88.",
        citations: [
          {
            legalSourceId: verifiedConstitutionSource.id,
            legalPassageId: verifiedConstitutionSource.passages[0]!.id,
            claimReference: "CF/1988, Art. 5º, XI",
          },
        ],
      },
      [verifiedConstitutionSource]
    );

    expect(result.status).toBe("VERIFIED");
    expect(result.isPublishableAsVerified).toBe(true);
    expect(result.issues).toHaveLength(0);
  });

  it("bloqueia imediatamente divergência entre a conclusão da IA e o gabarito oficial da banca", () => {
    const result = validateLegalExplanation(
      {
        questionId: "q-cf-1",
        officialKeyRevisionId: "key-1",
        officialAnswerValue: "A",
        claimedCorrectAnswerValue: "C",
        summary: "Divergência.",
        correctOptionAnalysis: "A IA afirma ser C.",
        wrongOptionsAnalysis: {},
        historicalUnderstanding: "Histórico.",
        currentUnderstanding: "Atual.",
        citations: [
          {
            legalSourceId: verifiedConstitutionSource.id,
            legalPassageId: verifiedConstitutionSource.passages[0]!.id,
            claimReference: "CF/1988, Art. 5º, XI",
          },
        ],
      },
      [verifiedConstitutionSource]
    );

    expect(result.status).toBe("DIVERGENCE_IDENTIFIED");
    expect(result.isPublishableAsVerified).toBe(false);
    expect(result.hasDivergenceOrUpdate).toBe(true);
  });

  it("recusa referência inexistente no catálogo jurídico auditado (REVIEW_REQUIRED)", () => {
    const result = validateLegalExplanation(
      {
        questionId: "q-cf-1",
        officialKeyRevisionId: "key-1",
        officialAnswerValue: "A",
        claimedCorrectAnswerValue: "A",
        summary: "Referência inventada.",
        correctOptionAnalysis: "Análise.",
        wrongOptionsAnalysis: {},
        historicalUnderstanding: "Histórico.",
        currentUnderstanding: "Atual.",
        citations: [
          {
            legalSourceId: "99999999-9999-4999-8999-999999999999",
            claimReference: "Lei Inexistente Art. 999",
          },
        ],
      },
      [verifiedConstitutionSource]
    );

    expect(result.status).toBe("REVIEW_REQUIRED");
    expect(result.isPublishableAsVerified).toBe(false);
  });

  it("marca como PENDING_VERIFICATION quando há ausência de fonte confiável vinculada", () => {
    const result = validateLegalExplanation(
      {
        questionId: "q-cf-1",
        officialKeyRevisionId: "key-1",
        officialAnswerValue: "B",
        claimedCorrectAnswerValue: "B",
        summary: "Sem fonte.",
        correctOptionAnalysis: "Análise.",
        wrongOptionsAnalysis: {},
        historicalUnderstanding: "Histórico.",
        currentUnderstanding: "Atual.",
        citations: [],
      },
      [verifiedConstitutionSource]
    );

    expect(result.status).toBe("PENDING_VERIFICATION");
    expect(result.isPublishableAsVerified).toBe(false);
  });

  it("sinaliza POSSIBLY_OUTDATED quando o dispositivo citado sofreu alteração legislativa superveniente", () => {
    const result = validateLegalExplanation(
      {
        questionId: "q-lia-1",
        officialKeyRevisionId: "key-2",
        officialAnswerValue: "D",
        claimedCorrectAnswerValue: "D",
        summary: "Improbidade culposa.",
        correctOptionAnalysis: "Na época da prova admitia-se modalidade culposa.",
        wrongOptionsAnalysis: {},
        historicalUnderstanding: "Antes da Lei 14.230/2021 o Art. 10 punia culpa.",
        currentUnderstanding: "A Lei 14.230/2021 extinguiu a modalidade culposa.",
        citations: [
          {
            legalSourceId: outdatedLawSource.id,
            legalPassageId: outdatedLawSource.passages[0]!.id,
            claimReference: "Lei 8.429/1992, Art. 10",
          },
        ],
      },
      [outdatedLawSource]
    );

    expect(result.status).toBe("POSSIBLY_OUTDATED");
    expect(result.isPublishableAsVerified).toBe(false);
    expect(result.hasDivergenceOrUpdate).toBe(true);
  });
});
