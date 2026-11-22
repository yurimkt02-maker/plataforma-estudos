import { createHash } from "node:crypto";

export type RawImportedQuestionCandidate = {
  originalNumber: number;
  questionType: "MULTIPLE_CHOICE" | "TRUE_FALSE";
  statement: string;
  supportText?: string;
  instruction?: string;
  options: Array<{
    label: string;
    content: string;
  }>;
  officialAnswer: string;
  isAnnulled?: boolean;
  subjectSlug: string;
  pageNumber?: number;
  pageImages?: string[];
  requiresHumanReview?: boolean;
  reviewReason?: string | null;
  sourceDocumentSha256: string;
  examFormVersionLabel: string;
};

export type QuestionValidationIssue = {
  code:
    | "INCOMPLETE_STATEMENT"
    | "MISSING_OPTIONS"
    | "DUPLICATE_OPTION_LABEL"
    | "INVALID_ANSWER_KEY"
    | "MISSING_VERSION_LABEL"
    | "MISSING_DOCUMENT_ORIGIN"
    | "MISSING_SUBJECT"
    | "REQUIRES_VISUAL_REVIEW";
  message: string;
};

export type ValidatedImportItemResult = {
  isValid: boolean;
  requiresHumanReview: boolean;
  targetStatus: "PUBLISHED" | "AWAITING_REVIEW" | "REJECTED";
  canonicalHash: string;
  issues: QuestionValidationIssue[];
};

export type ExamCompletenessAuditResult = {
  expectedCount: number;
  extractedCount: number;
  completenessPercent: number;
  isComplete: boolean;
  missingNumbers: number[];
  duplicateNumbers: number[];
  itemsWithoutAnswerKey: number[];
  itemsRequiringReview: number[];
};

export type AnswerKeyDivergence = {
  originalNumber: number;
  storedAnswer: string;
  referenceAnswer: string;
  storedAnnulled: boolean;
  referenceAnnulled: boolean;
  reason: string;
};

/**
 * Calcula o hash canônico SHA-256 do enunciado + alternativas normalizadas
 * para evitar duplicação da mesma questão quando ela aparece em diferentes versões de caderno.
 */
export function computeQuestionCanonicalHash(params: {
  questionType: "MULTIPLE_CHOICE" | "TRUE_FALSE";
  statement: string;
  options: Array<{ label: string; content: string }>;
}): string {
  const normalizedStatement = params.statement
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();

  const normalizedOptions = [...params.options]
    .map((o) => o.content.trim().replace(/\s+/g, " ").toLowerCase())
    .sort()
    .join("||");

  return createHash("sha256")
    .update(`${params.questionType}::${normalizedStatement}::${normalizedOptions}`)
    .digest("hex");
}

/**
 * Garante que nenhuma questão com extração incompleta, gabarito incompatível,
 * versão indefinida ou origem desconhecida seja aprovada para publicação (Seção 9.5).
 * Itens visuais/duvidosos são encaminhados automaticamente para AWAITING_REVIEW.
 */
export function validateExtractedQuestionItem(
  item: RawImportedQuestionCandidate
): ValidatedImportItemResult {
  const issues: QuestionValidationIssue[] = [];

  if (!item.sourceDocumentSha256 || item.sourceDocumentSha256.length !== 64) {
    issues.push({
      code: "MISSING_DOCUMENT_ORIGIN",
      message:
        "Origem documental ausente ou hash SHA-256 do PDF oficial inválido.",
    });
  }

  if (!item.examFormVersionLabel || !item.examFormVersionLabel.trim()) {
    issues.push({
      code: "MISSING_VERSION_LABEL",
      message:
        "Versão do caderno de prova indefinida. É obrigatório identificar o caderno antes de associar o gabarito.",
    });
  }

  if (!item.statement || item.statement.trim().length < 20) {
    issues.push({
      code: "INCOMPLETE_STATEMENT",
      message:
        "Enunciado ausente ou truncado (menos de 20 caracteres úteis).",
    });
  }

  if (!item.subjectSlug || !item.subjectSlug.trim()) {
    issues.push({
      code: "MISSING_SUBJECT",
      message: "Classificação de disciplina/assunto ausente.",
    });
  }

  const expectedMinOptions = item.questionType === "MULTIPLE_CHOICE" ? 4 : 2;
  if (!item.options || item.options.length < expectedMinOptions) {
    issues.push({
      code: "MISSING_OPTIONS",
      message: `Quantidade insuficiente de alternativas (${item.options?.length ?? 0}). Mínimo exigido para ${item.questionType}: ${expectedMinOptions}.`,
    });
  }

  const labels = new Set<string>();
  for (const opt of item.options ?? []) {
    const normalizedLabel = opt.label.trim().toUpperCase();
    if (labels.has(normalizedLabel)) {
      issues.push({
        code: "DUPLICATE_OPTION_LABEL",
        message: `Alternativa duplicada detectada (${normalizedLabel}).`,
      });
    }
    labels.add(normalizedLabel);

    if (!opt.content || !opt.content.trim()) {
      issues.push({
        code: "MISSING_OPTIONS",
        message: `Texto da alternativa ${normalizedLabel} está vazio.`,
      });
    }
  }

  const normalizedKey = item.officialAnswer?.trim().toUpperCase() ?? "";
  const isAnnulled =
    Boolean(item.isAnnulled) ||
    normalizedKey === "ANULADA" ||
    normalizedKey === "*" ||
    normalizedKey === "X";

  if (!isAnnulled) {
    if (item.questionType === "MULTIPLE_CHOICE" && !labels.has(normalizedKey)) {
      issues.push({
        code: "INVALID_ANSWER_KEY",
        message: `Gabarito oficial (${normalizedKey}) não corresponde a nenhuma alternativa extraída (${Array.from(labels).join(", ")}).`,
      });
    }
    if (
      item.questionType === "TRUE_FALSE" &&
      normalizedKey !== "C" &&
      normalizedKey !== "E" &&
      normalizedKey !== "CERTO" &&
      normalizedKey !== "ERRADO"
    ) {
      issues.push({
        code: "INVALID_ANSWER_KEY",
        message: `Gabarito de questão Certo/Errado inválido (${normalizedKey}). Esperado: C ou E.`,
      });
    }
  }

  const requiresHumanReview = Boolean(item.requiresHumanReview);
  if (requiresHumanReview) {
    issues.push({
      code: "REQUIRES_VISUAL_REVIEW",
      message:
        item.reviewReason ||
        "Item sinalizado para revisão humana (figura, diagrama ou extração ambígua).",
    });
  }

  const blockingIssues = issues.filter(
    (i) => i.code !== "REQUIRES_VISUAL_REVIEW"
  );

  const canonicalHash = computeQuestionCanonicalHash({
    questionType: item.questionType,
    statement: item.statement || "",
    options: item.options || [],
  });

  const isValid = blockingIssues.length === 0;
  const targetStatus: ValidatedImportItemResult["targetStatus"] = !isValid
    ? "REJECTED"
    : requiresHumanReview
      ? "AWAITING_REVIEW"
      : "PUBLISHED";

  return {
    isValid,
    requiresHumanReview,
    targetStatus,
    canonicalHash,
    issues,
  };
}

export type PublicationPolicyEvaluation = {
  allowedToPublish: boolean;
  targetQuestionStatus: "PUBLISHED" | "AWAITING_REVIEW" | "REJECTED";
  blockingReasons: string[];
};

/**
 * Regra unificada de publicação para scripts e fluxo administrativo:
 * impede que qualquer item seja promovido a PUBLISHED sem:
 * 1) validação estrutural aprovada e sem pendência visual/ambígua;
 * 2) documento do caderno de prova verificado (VERIFIED);
 * 3) documento do gabarito oficial definitivo verificado (VERIFIED);
 * 4) revisão humana efetiva registrada (nunca inferida automaticamente).
 */
export function enforceImportPublicationPolicy(params: {
  validation: ValidatedImportItemResult;
  hasVerifiedHumanReview: boolean;
  examDocumentVerified: boolean;
  answerKeyDocumentVerified: boolean;
}): PublicationPolicyEvaluation {
  const {
    validation,
    hasVerifiedHumanReview,
    examDocumentVerified,
    answerKeyDocumentVerified,
  } = params;

  if (!validation.isValid) {
    return {
      allowedToPublish: false,
      targetQuestionStatus: "REJECTED",
      blockingReasons: validation.issues.map((i) => i.message),
    };
  }

  const blockingReasons: string[] = [];
  if (!examDocumentVerified) {
    blockingReasons.push("Documento oficial do caderno de prova não está marcado como VERIFIED.");
  }
  if (!answerKeyDocumentVerified) {
    blockingReasons.push("Documento oficial do gabarito definitivo não está marcado como VERIFIED.");
  }
  if (validation.requiresHumanReview) {
    blockingReasons.push("Item sinalizado com pendência visual ou ambiguidade que exige conferência humana.");
  }
  if (!hasVerifiedHumanReview) {
    blockingReasons.push("Revisão humana efetiva ausente (ContentReviewLog obrigatório antes de publicar).");
  }

  if (blockingReasons.length > 0) {
    return {
      allowedToPublish: false,
      targetQuestionStatus: "AWAITING_REVIEW",
      blockingReasons,
    };
  }

  return {
    allowedToPublish: true,
    targetQuestionStatus: "PUBLISHED",
    blockingReasons: [],
  };
}

export type ExistingQuestionSnapshot = {
  id: string;
  status: "DRAFT" | "AWAITING_REVIEW" | "APPROVED" | "PUBLISHED" | "ARCHIVED";
  statement: string;
  supportText: string | null;
  validatedAt: Date | null;
  publishedAt: Date | null;
  assetsCount: number;
};

export type IdempotentQuestionWritePlan =
  | {
      action: "CREATE";
      status: "PUBLISHED" | "AWAITING_REVIEW";
      statement: string;
      supportText: string | null;
      validatedAt: Date | null;
      publishedAt: Date | null;
    }
  | {
      action: "PRESERVE_EXISTING";
      reason: string;
    }
  | {
      action: "UPDATE_PENDING";
      status: "PUBLISHED" | "AWAITING_REVIEW" | "ARCHIVED";
      statement: string;
      supportText: string | null;
      validatedAt: Date | null;
      publishedAt: Date | null;
    };

/**
 * Garante idempotência segura em reexecuções de importadores:
 * - Registros já PUBLISHED nunca são rebaixados para AWAITING_REVIEW pela ausência de nova revisão,
 *   nunca perdem publishedAt/validatedAt e nunca têm supportText/assets migrados sobrescritos.
 * - Novos registros obedecem estritamente à PublicationPolicyEvaluation.
 * - Registros pendentes (DRAFT/AWAITING_REVIEW) só podem ser atualizados sem sobrescrever
 *   supportText limpo quando já existem QuestionAsset migrados.
 */
export function resolveIdempotentQuestionWrite(params: {
  existing: ExistingQuestionSnapshot | null;
  incomingStatement: string;
  incomingSupportText: string | null;
  policy: PublicationPolicyEvaluation;
  now?: Date;
}): IdempotentQuestionWritePlan {
  const { existing, incomingStatement, incomingSupportText, policy } = params;
  const now = params.now ?? new Date();

  if (policy.targetQuestionStatus === "REJECTED") {
    return {
      action: "PRESERVE_EXISTING",
      reason: "Item rejeitado pela validação estrutural; nenhuma escrita permitida.",
    };
  }

  if (!existing) {
    const isPub = policy.allowedToPublish && policy.targetQuestionStatus === "PUBLISHED";
    return {
      action: "CREATE",
      status: isPub ? "PUBLISHED" : "AWAITING_REVIEW",
      statement: incomingStatement,
      supportText: incomingSupportText,
      validatedAt: isPub ? now : null,
      publishedAt: isPub ? now : null,
    };
  }

  // Registros históricos já publicados são imutáveis frente a reexecuções automáticas de importação
  if (existing.status === "PUBLISHED") {
    return {
      action: "PRESERVE_EXISTING",
      reason:
        "Questão já publicada (PUBLISHED) preservada integralmente (status, publishedAt, enunciado, texto de apoio e QuestionAsset intactos).",
    };
  }

  // Registro ainda não publicado: atualizar apenas sem sobrescrever assets/supportText já higienizados
  const shouldKeepExistingSupport =
    existing.assetsCount > 0 &&
    Boolean(incomingSupportText && /!\[[^\]]*\]\(\/images\//.test(incomingSupportText));

  const isPub = policy.allowedToPublish && policy.targetQuestionStatus === "PUBLISHED";
  return {
    action: "UPDATE_PENDING",
    status: isPub ? "PUBLISHED" : existing.status === "ARCHIVED" ? "ARCHIVED" : "AWAITING_REVIEW",
    statement: incomingStatement,
    supportText: shouldKeepExistingSupport ? existing.supportText : incomingSupportText,
    validatedAt: isPub ? (existing.validatedAt ?? now) : existing.validatedAt,
    publishedAt: isPub ? (existing.publishedAt ?? now) : existing.publishedAt,
  };
}

/**
 * Bloqueio incondicional para scripts históricos de carga direta em `PUBLISHED`.
 * Não aceita flags de bypass em linha de comando: novas publicações devem
 * passar obrigatoriamente pelo fluxo de curadoria com revisão humana efetiva.
 */
export function assertLegacyDirectPublishBlocked(scriptName: string): void {
  throw new Error(
    `BLOQUEADO INCONDICIONALMENTE PELA POLÍTICA DE CURADORIA (${scriptName}): ` +
      "este script histórico não pode mais gravar status PUBLISHED automaticamente. " +
      "O arquivo é mantido apenas para auditoria somente leitura; utilize /admin/importacoes e enforceImportPublicationPolicy."
  );
}

/**
 * Resolve a quantidade oficial esperada de questões priorizando:
 * 1) ExamForm.expectedQuestionCount (ex.: caderno específico)
 * 2) ExamEdition.expectedQuestionCount (ex.: TJSP 2025 = 70 vs TJSP 2024 = 100)
 * 3) ExamRuleset.passingRulesJson.totalQuestions
 * 4) Fallback por carreira apenas se nenhum valor específico estiver configurado.
 */
export function resolveExpectedQuestionCount(params: {
  formExpectedCount?: number | null;
  editionExpectedCount?: number | null;
  rulesetPassingRules?: unknown;
  trackCode?: string | null;
}): number {
  if (
    typeof params.formExpectedCount === "number" &&
    params.formExpectedCount > 0
  ) {
    return params.formExpectedCount;
  }
  if (
    typeof params.editionExpectedCount === "number" &&
    params.editionExpectedCount > 0
  ) {
    return params.editionExpectedCount;
  }
  if (
    params.rulesetPassingRules &&
    typeof params.rulesetPassingRules === "object" &&
    !Array.isArray(params.rulesetPassingRules)
  ) {
    const total = (params.rulesetPassingRules as Record<string, unknown>)
      .totalQuestions;
    if (typeof total === "number" && total > 0) {
      return total;
    }
  }
  const track = (params.trackCode ?? "").toUpperCase();
  if (track === "PRF") return 120;
  if (track === "TJSP") return 100;
  if (track === "PCSP" || track === "OAB") return 80;
  return 100;
}

/**
 * Executa auditoria de completude de um caderno de prova extraído (números faltantes,
 * duplicidades de numeração, itens sem gabarito e percentual de extração).
 */
export function auditExamCompleteness(params: {
  expectedCount: number;
  items: Array<{
    originalNumber: number;
    officialAnswer?: string | null;
    requiresHumanReview?: boolean;
  }>;
}): ExamCompletenessAuditResult {
  const seen = new Set<number>();
  const duplicates = new Set<number>();
  const withoutKey: number[] = [];
  const requiringReview: number[] = [];

  for (const item of params.items) {
    if (seen.has(item.originalNumber)) {
      duplicates.add(item.originalNumber);
    }
    seen.add(item.originalNumber);

    if (!item.officialAnswer || !item.officialAnswer.trim()) {
      withoutKey.push(item.originalNumber);
    }
    if (item.requiresHumanReview) {
      requiringReview.push(item.originalNumber);
    }
  }

  const missingNumbers: number[] = [];
  for (let n = 1; n <= params.expectedCount; n++) {
    if (!seen.has(n)) {
      missingNumbers.push(n);
    }
  }

  const extractedCount = seen.size;
  const completenessPercent =
    params.expectedCount > 0
      ? Number(((extractedCount / params.expectedCount) * 100).toFixed(1))
      : 0;

  return {
    expectedCount: params.expectedCount,
    extractedCount,
    completenessPercent,
    isComplete:
      params.expectedCount > 0 &&
      missingNumbers.length === 0 &&
      duplicates.size === 0 &&
      withoutKey.length === 0,
    missingNumbers,
    duplicateNumbers: Array.from(duplicates).sort((a, b) => a - b),
    itemsWithoutAnswerKey: withoutKey.sort((a, b) => a - b),
    itemsRequiringReview: requiringReview.sort((a, b) => a - b),
  };
}

/**
 * Compara um conjunto de gabaritos armazenados contra um gabarito oficial de referência
 * para detectar divergências (alterações pós-recurso, anulações ou erro de caderno/data).
 */
export function detectAnswerKeyDivergences(
  stored: Array<{
    originalNumber: number;
    answerValue: string;
    isAnnulled: boolean;
  }>,
  reference: Record<number, { answerValue: string; isAnnulled: boolean }>
): AnswerKeyDivergence[] {
  const divergences: AnswerKeyDivergence[] = [];

  for (const item of stored) {
    const ref = reference[item.originalNumber];
    if (!ref) continue;

    const storedNorm = item.answerValue.trim().toUpperCase();
    const refNorm = ref.answerValue.trim().toUpperCase();

    if (item.isAnnulled !== ref.isAnnulled) {
      divergences.push({
        originalNumber: item.originalNumber,
        storedAnswer: storedNorm,
        referenceAnswer: refNorm,
        storedAnnulled: item.isAnnulled,
        referenceAnnulled: ref.isAnnulled,
        reason: ref.isAnnulled
          ? "Questão anulada no gabarito oficial de referência, mas marcada como válida no banco."
          : "Questão marcada como anulada no banco, mas válida no gabarito oficial de referência (verificar data/caderno).",
      });
    } else if (!ref.isAnnulled && storedNorm !== refNorm) {
      divergences.push({
        originalNumber: item.originalNumber,
        storedAnswer: storedNorm,
        referenceAnswer: refNorm,
        storedAnnulled: item.isAnnulled,
        referenceAnnulled: ref.isAnnulled,
        reason: `Alternativa divergente: armazenado=${storedNorm}, referência oficial=${refNorm}.`,
      });
    }
  }

  return divergences;
}

export type ImportItemReviewState =
  | "STRUCTURALLY_VALID"
  | "AWAITING_REVIEW"
  | "VERIFIED"
  | "REJECTED";

export type PublishEligibilityInput = {
  originalNumber: number;
  questionType: "MULTIPLE_CHOICE" | "TRUE_FALSE";
  statement: string;
  options: Array<{ label: string; content: string }>;
  officialAnswer: string;
  isAnnulled?: boolean;
  subjectSlug: string;
  classificationStatus?: "CLASSIFIED" | "CLASSIFICATION_PENDING";
  hasMissingVisualOrTable?: boolean;
  answerKeyVerified?: boolean;
  reviewState?: ImportItemReviewState;
  validationStatus: string;
  reviewedAt: Date | string | null;
  examDocVerificationStatus: string;
  answerKeyDocVerificationStatus: string;
};

export type PublishEligibilityResult = {
  eligible: boolean;
  blockingReasons: string[];
};

/**
 * Gate rigoroso de publicação: impede que qualquer questão estruturalmente válida
 * seja publicada sem revisão humana explícita (VERIFIED), classificação de disciplina,
 * verificação de figuras/tabelas e conferência independente do gabarito definitivo.
 */
export function evaluateItemPublishEligibility(
  item: PublishEligibilityInput
): PublishEligibilityResult {
  const blockingReasons: string[] = [];

  if (item.examDocVerificationStatus !== "VERIFIED") {
    blockingReasons.push(
      "PDF do caderno de prova ainda não foi conferido/verificado pelo administrador."
    );
  }
  if (item.answerKeyDocVerificationStatus !== "VERIFIED") {
    blockingReasons.push(
      "PDF do gabarito definitivo ainda não foi conferido/verificado pelo administrador."
    );
  }

  if (item.reviewState !== "VERIFIED" || item.validationStatus !== "VERIFIED") {
    blockingReasons.push(
      `Revisão humana incompleta (estado atual: ${item.reviewState ?? item.validationStatus}). Apenas itens explicitamente aprovados como VERIFIED podem ser publicados.`
    );
  }

  if (!item.reviewedAt) {
    blockingReasons.push(
      "Registro de revisão humana ausente (reviewedAt nulo)."
    );
  }

  if (
    item.classificationStatus === "CLASSIFICATION_PENDING" ||
    !item.subjectSlug ||
    item.subjectSlug === "CLASSIFICATION_PENDING"
  ) {
    blockingReasons.push(
      "Classificação de disciplina pendente (CLASSIFICATION_PENDING). Selecione a disciplina antes de publicar."
    );
  }

  if (item.hasMissingVisualOrTable) {
    blockingReasons.push(
      "Item sinalizado com figura/imagem/tabela ausente ou não conferida."
    );
  }

  if (!item.answerKeyVerified) {
    blockingReasons.push(
      "Gabarito oficial deste item ainda não foi conferido individualmente com o gabarito definitivo da banca."
    );
  }

  if (!item.statement || item.statement.trim().length < 20) {
    blockingReasons.push("Enunciado ausente ou truncado.");
  }

  const normalizedKey = (item.officialAnswer ?? "").trim().toUpperCase();
  const isAnnulled =
    Boolean(item.isAnnulled) ||
    normalizedKey === "ANULADA" ||
    normalizedKey === "*" ||
    normalizedKey === "X";

  if (!isAnnulled) {
    const labels = new Set(item.options.map((o) => o.label.trim().toUpperCase()));
    if (item.questionType === "MULTIPLE_CHOICE" && !labels.has(normalizedKey)) {
      blockingReasons.push(
        `Gabarito duvidoso ou incompatível (${normalizedKey || "VAZIO"}) com as alternativas extraídas.`
      );
    }
    if (
      item.questionType === "TRUE_FALSE" &&
      normalizedKey !== "C" &&
      normalizedKey !== "E"
    ) {
      blockingReasons.push(
        `Gabarito Certo/Errado inválido ou duvidoso (${normalizedKey || "VAZIO"}).`
      );
    }
  }

  return {
    eligible: blockingReasons.length === 0,
    blockingReasons,
  };
}

/**
 * Valida o mapeamento de alternativas entre duas versões de caderno da mesma prova
 * (ex.: Versão 1 -> Versão 2 ou Tipo 1 Branca -> Tipo 2 Verde), garantindo bijeção
 * e coerência do gabarito oficial entre versões.
 */
export function validateMultiVersionOptionMapping(params: {
  canonicalAnswer: string;
  versionAnswer: string;
  isAnnulled: boolean;
  optionMapping: Record<string, string> | null;
  expectedLabels: string[];
}): { isValid: boolean; error: string | null } {
  if (params.isAnnulled) {
    return { isValid: true, error: null };
  }

  if (!params.optionMapping) {
    return {
      isValid: false,
      error:
        "Caderno secundário sem optionMappingJson explícito — proibido duplicar gabarito de versão secundária sem mapa validado.",
    };
  }

  const keys = Object.keys(params.optionMapping).map((k) => k.toUpperCase());
  const values = Object.values(params.optionMapping).map((v) => v.toUpperCase());
  const expectedSet = new Set(params.expectedLabels.map((l) => l.toUpperCase()));

  if (keys.length !== expectedSet.size || new Set(values).size !== expectedSet.size) {
    return {
      isValid: false,
      error: "Mapa de alternativas de caderno secundário não constitui bijeção completa.",
    };
  }

  for (const lbl of expectedSet) {
    if (!keys.includes(lbl) || !values.includes(lbl)) {
      return {
        isValid: false,
        error: `Alternativa ${lbl} ausente no mapa de correspondência entre cadernos.`,
      };
    }
  }

  // optionMapping mapeia letra do caderno secundário -> letra canônica (Versão 1)
  const mappedToCanonical =
    params.optionMapping[params.versionAnswer.toUpperCase()]?.toUpperCase();
  if (mappedToCanonical !== params.canonicalAnswer.toUpperCase()) {
    return {
      isValid: false,
      error: `Divergência entre cadernos: gabarito na versão (${params.versionAnswer}) aponta para ${mappedToCanonical ?? "N/A"}, mas gabarito canônico é ${params.canonicalAnswer}.`,
    };
  }

  return { isValid: true, error: null };
}
