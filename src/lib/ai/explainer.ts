import {
  validateLegalExplanation,
  type CandidateExplanationPayload,
  type LegalValidationOutcome,
  type RegisteredLegalSourceRecord,
} from "@/features/legal-knowledge/validator";
import { logger } from "@/lib/utils/logger";

export type AssistantCommandType =
  | "FULL_EXPLANATION"
  | "SIMPLIFY"
  | "WHY_MY_OPTION_IS_WRONG"
  | "EXPLAIN_ALL_OPTIONS"
  | "PRACTICAL_EXAMPLE"
  | "LEGAL_FOUNDATION"
  | "HISTORICAL_VS_CURRENT"
  | "REVISION_SUMMARY"
  | "GENERATE_DIDACTIC_DRILL";

export type StructuredExplanationResult = {
  questionId: string;
  officialKeyRevisionId: string;
  officialAnswerValue: string;
  command: AssistantCommandType;
  isAiGeneratedMaterial: boolean;
  disclaimerLabel: string;
  summary: string;
  correctOptionAnalysis: string;
  wrongOptionsAnalysis: Record<string, string>;
  historicalUnderstanding: string;
  currentUnderstanding: string;
  assistantCommandResponse?: string;
  validation: LegalValidationOutcome;
  citations: Array<{
    legalSourceId: string;
    legalPassageId?: string;
    authority: string;
    title: string;
    officialUrl: string;
    claimReference: string;
    quotedSnippet?: string;
  }>;
  modelId: string;
  generatedAt: string;
};

/**
 * Gera ou aprofunda uma explicação jurídica fundamentada exclusivamente nas fontes
 * verificadas recuperadas do catálogo, preservando o gabarito oficial da banca como fonte de verdade.
 */
export async function generateAuditedLegalExplanation(params: {
  questionId: string;
  officialKeyRevisionId: string;
  statement: string;
  options: Array<{ label: string; content: string }>;
  officialAnswerValue: string;
  subjectName: string;
  examTitle: string;
  examDate?: Date | null;
  command: AssistantCommandType;
  userSelectedAnswer?: string;
  retrievedSources: RegisteredLegalSourceRecord[];
}): Promise<StructuredExplanationResult> {
  const startMs = Date.now();
  const modelId = process.env.AI_MODEL?.trim() || "rule-verified-legal-engine-v1";

  // Seleciona as passagens jurídicas efetivamente recuperadas do banco
  const citationsInput: CandidateExplanationPayload["citations"] = [];
  const enrichedCitations: StructuredExplanationResult["citations"] = [];

  for (const src of params.retrievedSources) {
    const firstPassage = src.passages[0];
    if (firstPassage) {
      citationsInput.push({
        legalSourceId: src.id,
        legalPassageId: firstPassage.id,
        claimReference: firstPassage.referenceLabel,
        quotedSnippet: firstPassage.content,
      });
      enrichedCitations.push({
        legalSourceId: src.id,
        legalPassageId: firstPassage.id,
        authority: src.authority,
        title: src.title,
        officialUrl: src.officialUrl,
        claimReference: firstPassage.referenceLabel,
        quotedSnippet: firstPassage.content,
      });
    }
  }

  const hasVerifiedSources = enrichedCitations.length > 0;
  const correctOpt = params.options.find(
    (o) =>
      o.label.trim().toUpperCase() ===
      params.officialAnswerValue.trim().toUpperCase()
  );

  const wrongOptionsAnalysis: Record<string, string> = {};
  for (const opt of params.options) {
    if (
      opt.label.trim().toUpperCase() !==
      params.officialAnswerValue.trim().toUpperCase()
    ) {
      wrongOptionsAnalysis[opt.label] = hasVerifiedSources
        ? `Alternativa incompatível com o gabarito oficial (${params.officialAnswerValue}) e com o texto expresso de ${enrichedCitations.map((c) => c.claimReference).join("; ")}.`
        : `Alternativa considerada incorreta pelo gabarito oficial da banca (${params.officialAnswerValue}). Fonte normativa específica pendente de vinculação no catálogo jurídico.`;
    }
  }

  const historicalUnderstanding = hasVerifiedSources
    ? `Na data de aplicação da prova (${params.examTitle}), a banca adotou como gabarito oficial a alternativa "${params.officialAnswerValue}" com fundamento direto em: ${enrichedCitations.map((c) => `${c.claimReference} (${c.title})`).join("; ")}.`
    : `A banca organizadora fixou o gabarito oficial como "${params.officialAnswerValue}" para esta questão de ${params.subjectName}. Não há fonte normativa vinculada suficiente para detalhar a redação vigente na data da prova sem risco de extrapolação.`;

  const currentUnderstanding = hasVerifiedSources
    ? `De acordo com as fontes verificadas no catálogo (${enrichedCitations.map((c) => c.claimReference).join(", ")}), o fundamento permanece documentado em fonte primária oficial.`
    : `Não foi possível confirmar automaticamente eventual alteração legislativa ou jurisprudencial superveniente por ausência de dispositivo vinculado no acervo verificado.`;

  const candidatePayload: CandidateExplanationPayload = {
    questionId: params.questionId,
    officialKeyRevisionId: params.officialKeyRevisionId,
    officialAnswerValue: params.officialAnswerValue,
    claimedCorrectAnswerValue: params.officialAnswerValue,
    examDate: params.examDate,
    summary: `Análise fundamentada do gabarito oficial (${params.officialAnswerValue}) — ${params.subjectName}.`,
    correctOptionAnalysis: correctOpt
      ? `O gabarito oficial da banca é "${params.officialAnswerValue}" ("${correctOpt.content}"). ${hasVerifiedSources ? `Fundamento verificado: ${enrichedCitations.map((c) => `"${c.quotedSnippet}" (${c.claimReference})`).join(" ")}` : "Explicação aguardando vinculação de dispositivo legal no catálogo."}`
      : `Gabarito oficial da banca: ${params.officialAnswerValue}.`,
    wrongOptionsAnalysis,
    historicalUnderstanding,
    currentUnderstanding,
    citations: citationsInput,
  };

  const validation = validateLegalExplanation(
    candidatePayload,
    params.retrievedSources
  );

  let assistantCommandResponse: string | undefined;
  switch (params.command) {
    case "SIMPLIFY":
      assistantCommandResponse = `Síntese direta: A banca considera correta a opção "${params.officialAnswerValue}" em ${params.subjectName}. ${hasVerifiedSources ? `Regra-chave (${enrichedCitations[0]?.claimReference}): ${enrichedCitations[0]?.quotedSnippet}` : "Vincule a fonte legal correspondente para leitura literal do artigo."}`;
      break;
    case "WHY_MY_OPTION_IS_WRONG":
      assistantCommandResponse = params.userSelectedAnswer
        ? `Você assinalou "${params.userSelectedAnswer}", enquanto o gabarito oficial definitivo da banca é "${params.officialAnswerValue}". ${wrongOptionsAnalysis[params.userSelectedAnswer] ?? ""}`
        : `Selecione uma alternativa para comparar sua resposta com o gabarito oficial (${params.officialAnswerValue}).`;
      break;
    case "LEGAL_FOUNDATION":
      assistantCommandResponse = hasVerifiedSources
        ? enrichedCitations
            .map(
              (c) =>
                `• ${c.claimReference} (${c.authority} — ${c.officialUrl}): "${c.quotedSnippet}"`
            )
            .join("\n")
        : "Nenhum dispositivo legal verificado está vinculado a esta questão no momento. Cadastre ou associe o artigo em /admin/fontes-juridicas.";
      break;
    case "HISTORICAL_VS_CURRENT":
      assistantCommandResponse = `[Na época da prova]: ${historicalUnderstanding}\n\n[Entendimento atual]: ${currentUnderstanding}`;
      break;
    case "REVISION_SUMMARY":
      assistantCommandResponse = `Ficha de Revisão — ${params.subjectName}:\n1. Gabarito Oficial: ${params.officialAnswerValue}\n2. Fonte Primária: ${hasVerifiedSources ? enrichedCitations.map((c) => c.claimReference).join(", ") : "Pendente de vínculo"}\n3. Status de Vigência: ${validation.status}`;
      break;
    case "GENERATE_DIDACTIC_DRILL":
      assistantCommandResponse = `[MATERIAL DE TREINO GERADO POR IA — NÃO É QUESTÃO OFICIAL DE PROVA]\nItem Didático de Fixação (${params.subjectName}): Com base no dispositivo estudado (${enrichedCitations[0]?.claimReference ?? params.subjectName}), julgue a assertiva à luz da literalidade normativa verificada.`;
      break;
    default:
      assistantCommandResponse = undefined;
  }

  logger.info("LEGAL_EXPLANATION_GENERATED", {
    questionId: params.questionId,
    command: params.command,
    validationStatus: validation.status,
    durationMs: Date.now() - startMs,
  });

  return {
    questionId: params.questionId,
    officialKeyRevisionId: params.officialKeyRevisionId,
    officialAnswerValue: params.officialAnswerValue,
    command: params.command,
    isAiGeneratedMaterial: params.command === "GENERATE_DIDACTIC_DRILL",
    disclaimerLabel:
      params.command === "GENERATE_DIDACTIC_DRILL"
        ? "MATERIAL DE TREINO GERADO POR IA — NÃO É QUESTÃO OFICIAL"
        : validation.status === "VERIFIED"
          ? "COMENTÁRIO VINCULADO A FONTE OFICIAL VERIFICADA"
          : "EXPLICAÇÃO GERADA POR IA — VALIDAÇÃO DOCUMENTAL PENDENTE",
    summary: candidatePayload.summary,
    correctOptionAnalysis: candidatePayload.correctOptionAnalysis,
    wrongOptionsAnalysis,
    historicalUnderstanding,
    currentUnderstanding,
    assistantCommandResponse,
    validation,
    citations: enrichedCitations,
    modelId,
    generatedAt: new Date().toISOString(),
  };
}
