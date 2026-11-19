import { createHash } from "node:crypto";

export type RegisteredLegalSourceRecord = {
  id: string;
  sourceType: string;
  authority: string;
  title: string;
  officialUrl: string;
  documentNumber?: string | null;
  effectiveFrom?: Date | null;
  effectiveTo?: Date | null;
  verificationStatus: "PENDING" | "VERIFIED" | "OUTDATED" | "DIVERGENT" | "REJECTED";
  passages: Array<{
    id: string;
    referenceLabel: string;
    content: string;
    textHash: string;
    effectiveFrom?: Date | null;
    effectiveTo?: Date | null;
    isCurrentlyInForce: boolean;
  }>;
};

export type CandidateExplanationPayload = {
  questionId: string;
  officialKeyRevisionId: string;
  officialAnswerValue: string;
  claimedCorrectAnswerValue: string;
  examDate?: Date | null;
  summary: string;
  correctOptionAnalysis: string;
  wrongOptionsAnalysis: Record<string, string>;
  historicalUnderstanding: string;
  currentUnderstanding: string;
  citations: Array<{
    legalSourceId: string;
    legalPassageId?: string;
    claimReference: string;
    quotedSnippet?: string;
  }>;
};

export type LegalValidationOutcome = {
  status:
    | "VERIFIED"
    | "PENDING_VERIFICATION"
    | "POSSIBLY_OUTDATED"
    | "DIVERGENCE_IDENTIFIED"
    | "REVIEW_REQUIRED";
  isPublishableAsVerified: boolean;
  hasDivergenceOrUpdate: boolean;
  divergenceNote: string | null;
  sourceSnapshotHash: string;
  issues: string[];
};

/**
 * Calcula o hash de snapshot das fontes jurídicas e versão do gabarito para cache e invalidação automática.
 */
export function computeExplanationSnapshotHash(params: {
  questionId: string;
  officialKeyRevisionId: string;
  passageHashes: string[];
}): string {
  const sortedHashes = [...params.passageHashes].sort().join("|");
  const payload = `${params.questionId}::${params.officialKeyRevisionId}::${sortedHashes}`;
  return createHash("sha256").update(payload).digest("hex");
}

/**
 * Audita e valida rigorosamente um comentário jurídico antes de permitir sua classificação como VERIFIED.
 * Regras aplicadas (Seções 9.4, 11.2, 11.3 e 16):
 * - Jamais permite que a IA contradiga o gabarito oficial sem sinalizar DIVERGENCE_IDENTIFIED.
 * - Rejeita referências a documentos ou dispositivos não cadastrados no acervo verificado.
 * - Exige ao menos uma fonte oficial verificada para marcar como VERIFIED.
 * - Detecta alterações legislativas/jurisprudenciais entre a data da prova e a vigência atual.
 */
export function validateLegalExplanation(
  candidate: CandidateExplanationPayload,
  registeredSources: RegisteredLegalSourceRecord[]
): LegalValidationOutcome {
  const issues: string[] = [];
  const sourceMap = new Map(registeredSources.map((s) => [s.id, s]));
  const passageHashes: string[] = [];

  // 1. Verificar consistência com o gabarito oficial da banca
  const normalizedOfficial = candidate.officialAnswerValue.trim().toUpperCase();
  const normalizedClaimed = candidate.claimedCorrectAnswerValue
    .trim()
    .toUpperCase();

  if (normalizedOfficial !== normalizedClaimed) {
    issues.push(
      `Divergência entre gabarito oficial (${normalizedOfficial}) e conclusão do comentário (${normalizedClaimed}).`
    );
    return {
      status: "DIVERGENCE_IDENTIFIED",
      isPublishableAsVerified: false,
      hasDivergenceOrUpdate: true,
      divergenceNote: issues[0] ?? null,
      sourceSnapshotHash: computeExplanationSnapshotHash({
        questionId: candidate.questionId,
        officialKeyRevisionId: candidate.officialKeyRevisionId,
        passageHashes: ["DIVERGENT"],
      }),
      issues,
    };
  }

  // 2. Verificar se há citações registradas
  if (!candidate.citations || candidate.citations.length === 0) {
    issues.push(
      "Nenhuma fonte oficial verificada foi vinculada ao comentário. Comentários sem fonte não podem ser marcados como verificados."
    );
    return {
      status: "PENDING_VERIFICATION",
      isPublishableAsVerified: false,
      hasDivergenceOrUpdate: false,
      divergenceNote:
        "Explicação gerada sem fonte documental vinculada no catálogo jurídico.",
      sourceSnapshotHash: computeExplanationSnapshotHash({
        questionId: candidate.questionId,
        officialKeyRevisionId: candidate.officialKeyRevisionId,
        passageHashes: ["NO_SOURCES"],
      }),
      issues,
    };
  }

  let hasOutdatedOrModifiedSource = false;
  let hasUnverifiedSource = false;

  for (const citation of candidate.citations) {
    const source = sourceMap.get(citation.legalSourceId);
    if (!source) {
      issues.push(
        `Fonte jurídica referenciada (${citation.legalSourceId} - "${citation.claimReference}") não existe no acervo auditado.`
      );
      return {
        status: "REVIEW_REQUIRED",
        isPublishableAsVerified: false,
        hasDivergenceOrUpdate: true,
        divergenceNote: `Tentativa de citação de fonte inexistente no catálogo (${citation.claimReference}).`,
        sourceSnapshotHash: computeExplanationSnapshotHash({
          questionId: candidate.questionId,
          officialKeyRevisionId: candidate.officialKeyRevisionId,
          passageHashes: ["INVALID_SOURCE"],
        }),
        issues,
      };
    }

    if (source.verificationStatus !== "VERIFIED") {
      hasUnverifiedSource = true;
      issues.push(
        `A fonte "${source.title}" está com status ${source.verificationStatus}.`
      );
    }

    if (source.effectiveTo && source.effectiveTo.getTime() < Date.now()) {
      hasOutdatedOrModifiedSource = true;
      issues.push(
        `A fonte "${source.title}" teve vigência encerrada em ${source.effectiveTo.toISOString().slice(0, 10)}.`
      );
    }

    if (citation.legalPassageId) {
      const passage = source.passages.find(
        (p) => p.id === citation.legalPassageId
      );
      if (!passage) {
        issues.push(
          `Dispositivo "${citation.claimReference}" (${citation.legalPassageId}) não encontrado dentro da fonte "${source.title}".`
        );
        return {
          status: "REVIEW_REQUIRED",
          isPublishableAsVerified: false,
          hasDivergenceOrUpdate: true,
          divergenceNote: `Dispositivo legal citado não localizado na fonte verificada.`,
          sourceSnapshotHash: computeExplanationSnapshotHash({
            questionId: candidate.questionId,
            officialKeyRevisionId: candidate.officialKeyRevisionId,
            passageHashes: ["INVALID_PASSAGE"],
          }),
          issues,
        };
      }

      passageHashes.push(passage.textHash);
      if (!passage.isCurrentlyInForce || passage.effectiveTo) {
        hasOutdatedOrModifiedSource = true;
        issues.push(
          `O dispositivo "${passage.referenceLabel}" sofreu alteração normativa ou revogação superveniente.`
        );
      }
    } else {
      passageHashes.push(source.id);
    }
  }

  // 3. Verificar separação entre entendimento histórico e atual
  if (
    !candidate.historicalUnderstanding.trim() ||
    !candidate.currentUnderstanding.trim()
  ) {
    issues.push(
      "O comentário deve explicitar separadamente o entendimento na data da prova e o entendimento atual."
    );
    hasUnverifiedSource = true;
  }

  const snapshotHash = computeExplanationSnapshotHash({
    questionId: candidate.questionId,
    officialKeyRevisionId: candidate.officialKeyRevisionId,
    passageHashes,
  });

  if (hasOutdatedOrModifiedSource) {
    return {
      status: "POSSIBLY_OUTDATED",
      isPublishableAsVerified: false,
      hasDivergenceOrUpdate: true,
      divergenceNote:
        "Há alteração normativa ou jurisprudencial superveniente identificada nos dispositivos vinculados.",
      sourceSnapshotHash: snapshotHash,
      issues,
    };
  }

  if (hasUnverifiedSource) {
    return {
      status: "PENDING_VERIFICATION",
      isPublishableAsVerified: false,
      hasDivergenceOrUpdate: false,
      divergenceNote: issues.join(" "),
      sourceSnapshotHash: snapshotHash,
      issues,
    };
  }

  return {
    status: "VERIFIED",
    isPublishableAsVerified: true,
    hasDivergenceOrUpdate: false,
    divergenceNote: null,
    sourceSnapshotHash: snapshotHash,
    issues: [],
  };
}
