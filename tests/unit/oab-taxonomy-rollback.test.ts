import { describe, expect, it } from "vitest";
import {
  computeRollbackPlan,
  computeSnapshotChecksum,
  type OabSubjectLinkSnapshot,
} from "../../scripts/maintenance/oab-subjects-snapshot-and-rollback";
import {
  enforceImportPublicationPolicy,
  validateExtractedQuestionItem,
} from "../../src/features/imports/pipeline";

describe("Snapshot e Rollback de Taxonomia OAB", () => {
  const sampleSnapshotLinks: OabSubjectLinkSnapshot[] = [
    {
      questionId: "q-1",
      editionCode: "OAB-37-1FASE",
      originalNumber: 11,
      subjectId: "subj-eleitoral",
      subjectSlug: "oab-direito-eleitoral",
      subjectName: "Direito Eleitoral",
      parentId: null,
      parentSlug: null,
      isPrimary: true,
    },
    {
      questionId: "q-2",
      editionCode: "OAB-41-1FASE",
      originalNumber: 1,
      subjectId: "subj-etica-filho",
      subjectSlug: "direitos-e-prerrogativas-do-advogado",
      subjectName: "Direitos e Prerrogativas",
      parentId: "subj-etica-raiz",
      parentSlug: "etica-e-estatuto-da-oab",
      isPrimary: true,
    },
    {
      questionId: "q-2",
      editionCode: "OAB-41-1FASE",
      originalNumber: 1,
      subjectId: "subj-etica-raiz",
      subjectSlug: "etica-e-estatuto-da-oab",
      subjectName: "Ética Profissional",
      parentId: null,
      parentSlug: null,
      isPrimary: false,
    },
  ];

  it("gera checksum SHA-256 determinístico independente da ordem dos vínculos", () => {
    const h1 = computeSnapshotChecksum(sampleSnapshotLinks);
    const h2 = computeSnapshotChecksum([...sampleSnapshotLinks].reverse());
    expect(h1).toBe(h2);
    expect(h1).toMatch(/^[a-f0-9]{64}$/);
  });

  it("retorna plano vazio quando estado atual é idêntico ao snapshot", () => {
    const plan = computeRollbackPlan(sampleSnapshotLinks, sampleSnapshotLinks);
    expect(plan.toDelete).toHaveLength(0);
    expect(plan.toInsert).toHaveLength(0);
    expect(plan.toUpdatePrimary).toHaveLength(0);
  });

  it("calcula diff reversível exato para desfazer remapeamento e alteração de isPrimary sem duplicidade", () => {
    const mutatedState = [
      // q-1 foi remapeada para constitucional
      { questionId: "q-1", subjectId: "subj-constitucional", isPrimary: true },
      // q-2 teve isPrimary invertido
      { questionId: "q-2", subjectId: "subj-etica-filho", isPrimary: false },
      { questionId: "q-2", subjectId: "subj-etica-raiz", isPrimary: true },
    ];

    const plan = computeRollbackPlan(mutatedState, sampleSnapshotLinks);
    expect(plan.toDelete).toEqual([
      { questionId: "q-1", subjectId: "subj-constitucional" },
    ]);
    expect(plan.toInsert).toEqual([
      { questionId: "q-1", subjectId: "subj-eleitoral", isPrimary: true },
    ]);
    expect(plan.toUpdatePrimary).toEqual([
      { questionId: "q-2", subjectId: "subj-etica-filho", isPrimary: true },
      { questionId: "q-2", subjectId: "subj-etica-raiz", isPrimary: false },
    ]);

    // Simular aplicação do rollback e verificar restauração exata sem duplicidades
    const restored = mutatedState.filter(
      (l) => !plan.toDelete.some((d) => d.questionId === l.questionId && d.subjectId === l.subjectId)
    );
    for (const upd of plan.toUpdatePrimary) {
      const target = restored.find(
        (l) => l.questionId === upd.questionId && l.subjectId === upd.subjectId
      );
      if (target) target.isPrimary = upd.isPrimary;
    }
    restored.push(...plan.toInsert);

    const postRollbackDiff = computeRollbackPlan(restored, sampleSnapshotLinks);
    expect(postRollbackDiff.toDelete).toHaveLength(0);
    expect(postRollbackDiff.toInsert).toHaveLength(0);
    expect(postRollbackDiff.toUpdatePrimary).toHaveLength(0);
    expect(restored).toHaveLength(sampleSnapshotLinks.length);
  });
});

describe("Regra Unificada de Publicação (enforceImportPublicationPolicy)", () => {
  const validItem = validateExtractedQuestionItem({
    originalNumber: 1,
    questionType: "TRUE_FALSE",
    statement: "Enunciado oficial completo com mais de vinte caracteres para validação estrutural.",
    options: [
      { label: "C", content: "Certo" },
      { label: "E", content: "Errado" },
    ],
    officialAnswer: "C",
    isAnnulled: false,
    subjectSlug: "direitos-e-garantias-fundamentais",
    pageNumber: 2,
    sourceDocumentSha256: "a".repeat(64),
    examFormVersionLabel: "Tipo I",
  });

  it("bloqueia publicação automática quando revisão humana efetiva está ausente", () => {
    const res = enforceImportPublicationPolicy({
      validation: validItem,
      hasVerifiedHumanReview: false,
      examDocumentVerified: true,
      answerKeyDocumentVerified: true,
    });
    expect(res.allowedToPublish).toBe(false);
    expect(res.targetQuestionStatus).toBe("AWAITING_REVIEW");
    expect(res.blockingReasons.some((r) => r.includes("Revisão humana efetiva"))).toBe(true);
  });

  it("bloqueia publicação quando documento do gabarito definitivo não está VERIFIED", () => {
    const res = enforceImportPublicationPolicy({
      validation: validItem,
      hasVerifiedHumanReview: true,
      examDocumentVerified: true,
      answerKeyDocumentVerified: false,
    });
    expect(res.allowedToPublish).toBe(false);
    expect(res.targetQuestionStatus).toBe("AWAITING_REVIEW");
  });

  it("permite PUBLISHED somente quando validação estrutural, documentos oficiais e revisão humana estão completos", () => {
    const res = enforceImportPublicationPolicy({
      validation: validItem,
      hasVerifiedHumanReview: true,
      examDocumentVerified: true,
      answerKeyDocumentVerified: true,
    });
    expect(res.allowedToPublish).toBe(true);
    expect(res.targetQuestionStatus).toBe("PUBLISHED");
    expect(res.blockingReasons).toHaveLength(0);
  });
});
