import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  computeRollbackPlan,
  computeSnapshotChecksum,
  type OabSubjectLinkSnapshot,
} from "../../scripts/maintenance/oab-subjects-snapshot-and-rollback";
import {
  computeApprovedIdsChecksum,
  partitionLoteACandidates,
  validateApprovedLoteASelection,
  type LoteACandidate,
} from "../../scripts/maintenance/apply-oab-lote-a";
import {
  computeTargetedSubjectUpdate,
  WRONG_PRF2013_TRAFFIC_SLUGS,
} from "../../scripts/maintenance/apply-prf-2013-fixes";
import {
  assertLegacyDirectPublishBlocked,
  enforceImportPublicationPolicy,
  resolveIdempotentQuestionWrite,
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
      { questionId: "q-1", subjectId: "subj-constitucional", isPrimary: true },
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

describe("Guardas de Segurança — OAB Lote A (53 limpos vs 12 ambíguos bloqueados)", () => {
  const mkCandidate = (id: string, isAmbiguous: boolean): LoteACandidate => ({
    questionId: id,
    editionCode: "OAB-37-1FASE",
    qNum: 11,
    currentSlug: "oab-direito-eleitoral",
    proposedSlug: "oab-direito-constitucional",
    targetSubjectId: "subj-const",
    evidence: 'enunciado: "controle concentrado"',
    confidence: "ALTA_CONCORDANCIA_TEXTO_E_BLOCO",
    isAmbiguous,
    ambiguityNote: isAmbiguous ? "Empate de escore" : null,
    excerpt: "Trecho real",
  });

  const clean = [mkCandidate("q-clean-1", false), mkCandidate("q-clean-2", false)];
  const amb = [mkCandidate("q-amb-1", true)];

  it("separa estritamente cleanCandidates de ambiguousItems", () => {
    const res = partitionLoteACandidates([...clean, ...amb]);
    expect(res.cleanCandidates.map((c) => c.questionId)).toEqual(["q-clean-1", "q-clean-2"]);
    expect(res.ambiguousItems.map((c) => c.questionId)).toEqual(["q-amb-1"]);
  });

  it("recusa manifesto que inclua qualquer questão ambígua", () => {
    const ids = ["q-clean-1", "q-clean-2", "q-amb-1"];
    const res = validateApprovedLoteASelection({
      cleanCandidates: clean,
      ambiguousItems: amb,
      manifest: {
        batch: "OAB_LOTE_A",
        approvedByHuman: true,
        expectedCount: ids.length,
        approvedQuestionIds: ids,
        checksumSha256: computeApprovedIdsChecksum(ids),
      },
      liveEleitoralQuestionIds: new Set(ids),
    });
    expect(res.valid).toBe(false);
    expect(res.errors.some((e) => e.includes("ambíguas bloqueadas"))).toBe(true);
  });

  it("recusa seleção sem approvedByHuman: true ou quando a disciplina atual no banco mudou", () => {
    const ids = ["q-clean-1", "q-clean-2"];
    const noApproval = validateApprovedLoteASelection({
      cleanCandidates: clean,
      ambiguousItems: amb,
      manifest: {
        batch: "OAB_LOTE_A",
        approvedByHuman: false,
        expectedCount: 2,
        approvedQuestionIds: ids,
        checksumSha256: computeApprovedIdsChecksum(ids),
      },
      liveEleitoralQuestionIds: new Set(ids),
    });
    expect(noApproval.valid).toBe(false);

    const staleDb = validateApprovedLoteASelection({
      cleanCandidates: clean,
      ambiguousItems: amb,
      manifest: {
        batch: "OAB_LOTE_A",
        approvedByHuman: true,
        expectedCount: 2,
        approvedQuestionIds: ids,
        checksumSha256: computeApprovedIdsChecksum(ids),
      },
      liveEleitoralQuestionIds: new Set(["q-clean-1"]), // q-clean-2 já mudou no banco
    });
    expect(staleDb.valid).toBe(false);
    expect(staleDb.errors.some((e) => e.includes("Revalidação falhou"))).toBe(true);
  });

  it("aceita exatamente a seleção limpa aprovada e revalidada, inclusive por subconjunto parcial", () => {
    const subsetIds = ["q-clean-1"];
    const okSubset = validateApprovedLoteASelection({
      cleanCandidates: clean,
      ambiguousItems: amb,
      manifest: {
        batch: "OAB_LOTE_A",
        approvedByHuman: true,
        expectedCount: 1,
        approvedQuestionIds: subsetIds,
        checksumSha256: computeApprovedIdsChecksum(subsetIds),
      },
      liveEleitoralQuestionIds: new Set(["q-clean-1", "q-clean-2"]),
    });
    expect(okSubset.valid).toBe(true);
    expect(okSubset.approvedItems.map((i) => i.questionId)).toEqual(["q-clean-1"]);
  });
});

describe("Regra Unificada de Publicação e Idempotência PRF 2013", () => {
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

  it("bloqueia publicação automática de novos itens quando revisão humana está ausente", () => {
    const policy = enforceImportPublicationPolicy({
      validation: validItem,
      hasVerifiedHumanReview: false,
      examDocumentVerified: true,
      answerKeyDocumentVerified: true,
    });
    expect(policy.allowedToPublish).toBe(false);
    expect(policy.targetQuestionStatus).toBe("AWAITING_REVIEW");

    const createPlan = resolveIdempotentQuestionWrite({
      existing: null,
      incomingStatement: "Novo enunciado",
      incomingSupportText: "Texto de apoio",
      policy,
    });
    expect(createPlan.action).toBe("CREATE");
    if (createPlan.action === "CREATE") {
      expect(createPlan.status).toBe("AWAITING_REVIEW");
      expect(createPlan.publishedAt).toBeNull();
    }
  });

  it("NUNCA despublica nem sobrescreve texto/assets de questão já PUBLISHED ao reexecutar o importador", () => {
    const policyWithoutNewReview = enforceImportPublicationPolicy({
      validation: validItem,
      hasVerifiedHumanReview: false,
      examDocumentVerified: true,
      answerKeyDocumentVerified: true,
    });

    const plan = resolveIdempotentQuestionWrite({
      existing: {
        id: "q-prf-18",
        status: "PUBLISHED",
        statement: "Enunciado original publicado",
        supportText: "Texto limpo sem Markdown bruto",
        validatedAt: new Date("2026-11-22T12:00:00Z"),
        publishedAt: new Date("2026-11-22T12:00:00Z"),
        assetsCount: 1,
      },
      incomingStatement: "Enunciado vindo do JSON",
      incomingSupportText: "![Grafico](/images/questions/prf-2013/x.png)\n\nTexto bruto",
      policy: policyWithoutNewReview,
    });

    expect(plan.action).toBe("PRESERVE_EXISTING");
  });

  it("preserva supportText limpo quando questão pendente já possui QuestionAsset migrado", () => {
    const policy = enforceImportPublicationPolicy({
      validation: validItem,
      hasVerifiedHumanReview: false,
      examDocumentVerified: true,
      answerKeyDocumentVerified: true,
    });

    const plan = resolveIdempotentQuestionWrite({
      existing: {
        id: "q-pending-18",
        status: "AWAITING_REVIEW",
        statement: "Enunciado pendente",
        supportText: "Texto de apoio higienizado",
        validatedAt: null,
        publishedAt: null,
        assetsCount: 1,
      },
      incomingStatement: "Enunciado pendente",
      incomingSupportText: "![Grafico](/images/questions/prf-2013/x.png)\n\nTexto bruto",
      policy,
    });

    expect(plan.action).toBe("UPDATE_PENDING");
    if (plan.action === "UPDATE_PENDING") {
      expect(plan.supportText).toBe("Texto de apoio higienizado");
    }
  });

  it("substitui cirurgicamente apenas vínculos incorretos de trânsito, preservando vínculos adicionais legítimos", () => {
    const plan = computeTargetedSubjectUpdate({
      existingLinks: [
        { subjectId: "s-crimes-transito", subjectSlug: "crimes-de-transito", isPrimary: true },
        { subjectId: "s-ctb-root", subjectSlug: "legislacao-de-transito-ctb", isPrimary: false },
        { subjectId: "s-extra-valido", subjectSlug: "etica-no-servico-publico", isPrimary: false },
      ],
      wrongSlugs: WRONG_PRF2013_TRAFFIC_SLUGS,
      targetChildId: "s-teoria-crime",
      targetParentId: "s-penal-root",
    });

    expect(plan.subjectIdsToRemove).toEqual(["s-crimes-transito", "s-ctb-root"]);
    expect(plan.preservedAdditionalSlugs).toEqual(["etica-no-servico-publico"]);
    expect(plan.subjectToUpsertPrimary).toBe("s-teoria-crime");
    expect(plan.subjectToUpsertParent).toBe("s-penal-root");
  });
});

describe("Bloqueio Incondicional de Scripts Históricos de Publicação Direta", () => {
  const legacyScripts = [
    "scripts/imports/import-multi-career-real.ts",
    "scripts/imports/import-oab-2023-2026-batch.ts",
    "scripts/imports/import-oab-42-and-45.ts",
    "scripts/imports/remediate-and-import-complete.ts",
  ];

  it("assertLegacyDirectPublishBlocked sempre lança erro incondicional", () => {
    expect(() => assertLegacyDirectPublishBlocked("legacy-test.ts")).toThrow(
      /BLOQUEADO INCONDICIONALMENTE PELA POLÍTICA DE CURADORIA/
    );
  });

  it("todos os 4 scripts históricos removem qualquer flag de bypass e invocam assertLegacyDirectPublishBlocked", () => {
    for (const relPath of legacyScripts) {
      const src = fs.readFileSync(path.join(process.cwd(), relPath), "utf-8");
      expect(src).not.toContain("--allow-legacy-historical-script");
      expect(src).toContain("assertLegacyDirectPublishBlocked");
    }
  });
});
