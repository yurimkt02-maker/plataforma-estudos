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
    | "MISSING_SUBJECT";
  message: string;
};

export type ValidatedImportItemResult = {
  isValid: boolean;
  canonicalHash: string;
  issues: QuestionValidationIssue[];
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
    normalizedKey === "*";

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

  const canonicalHash = computeQuestionCanonicalHash({
    questionType: item.questionType,
    statement: item.statement || "",
    options: item.options || [],
  });

  return {
    isValid: issues.length === 0,
    canonicalHash,
    issues,
  };
}
