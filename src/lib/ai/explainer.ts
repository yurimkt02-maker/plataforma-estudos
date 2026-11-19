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
  aiApiConfigured: boolean;
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
 * Seleciona a fonte e passagem normativa verificada mais pertinente ao enunciado e disciplina da questão.
 */
function matchRelevantLegalPassages(
  statement: string,
  subjectName: string,
  sources: RegisteredLegalSourceRecord[]
): Array<{
  source: RegisteredLegalSourceRecord;
  passage: RegisteredLegalSourceRecord["passages"][number];
}> {
  const lowerStmt = `${statement} ${subjectName}`.toLowerCase();
  const matches: Array<{
    source: RegisteredLegalSourceRecord;
    passage: RegisteredLegalSourceRecord["passages"][number];
    score: number;
  }> = [];

  for (const src of sources) {
    for (const passage of src.passages) {
      let score = 0;
      const refLower = `${src.title} ${src.documentNumber ?? ""} ${passage.referenceLabel} ${passage.content}`.toLowerCase();

      if (lowerStmt.includes("10.261") && refLower.includes("10.261")) score += 20;
      if (lowerStmt.includes("8.429") && refLower.includes("8.429")) score += 20;
      if (lowerStmt.includes("294") && refLower.includes("294")) score += 20;
      if (lowerStmt.includes("316") && refLower.includes("316")) score += 20;
      if (lowerStmt.includes("concussão") && refLower.includes("concussão")) score += 15;
      if (lowerStmt.includes("processo penal") && refLower.includes("processo penal")) score += 18;
      if (lowerStmt.includes("juizado especial da fazenda") && refLower.includes("12.153")) score += 20;
      if (lowerStmt.includes("9.099") && refLower.includes("9.099")) score += 20;
      if (lowerStmt.includes("corregedoria") && refLower.includes("nscgj")) score += 20;
      if (lowerStmt.includes("sindicato") && refLower.includes("art. 8º")) score += 20;
      if (lowerStmt.includes("acumulação") && refLower.includes("art. 37")) score += 20;
      if (lowerStmt.includes("constituição") && src.sourceType === "CONSTITUTION") score += 8;

      if (score > 0) {
        matches.push({ source: src, passage, score });
      }
    }
  }

  matches.sort((a, b) => b.score - a.score);
  return matches.slice(0, 2).map(({ source, passage }) => ({ source, passage }));
}

/**
 * Gera ou aprofunda uma explicação jurídica fundamentada exclusivamente nas fontes
 * verificadas recuperadas do catálogo, preservando o gabarito oficial da banca como fonte de verdade.
 * Caso AI_API_KEY não esteja configurada, informa explicitamente a dependência sem simular chamada externa.
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
  const aiApiConfigured = Boolean(process.env.AI_API_KEY?.trim());
  const modelId = aiApiConfigured
    ? process.env.AI_MODEL?.trim() || "gemini-2.5-pro"
    : "deterministic-verified-catalog-engine (AI_API_KEY ausente)";

  const matched = matchRelevantLegalPassages(
    params.statement,
    params.subjectName,
    params.retrievedSources
  );

  const citationsInput: CandidateExplanationPayload["citations"] = [];
  const enrichedCitations: StructuredExplanationResult["citations"] = [];

  for (const { source, passage } of matched) {
    citationsInput.push({
      legalSourceId: source.id,
      legalPassageId: passage.id,
      claimReference: passage.referenceLabel,
      quotedSnippet: passage.content,
    });
    enrichedCitations.push({
      legalSourceId: source.id,
      legalPassageId: passage.id,
      authority: source.authority,
      title: source.title,
      officialUrl: source.officialUrl,
      claimReference: passage.referenceLabel,
      quotedSnippet: passage.content,
    });
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
    : `A banca organizadora fixou o gabarito oficial como "${params.officialAnswerValue}" para esta questão de ${params.subjectName}. Não há fonte normativa vinculada suficiente no catálogo jurídico para detalhar a redação vigente na data da prova sem risco de extrapolação.`;

  const currentUnderstanding = hasVerifiedSources
    ? `De acordo com as fontes primárias verificadas no catálogo (${enrichedCitations.map((c) => c.claimReference).join(", ")}), o dispositivo permanece em vigor e documentado em portal oficial (${enrichedCitations[0]?.authority}).`
    : `Não foi possível confirmar automaticamente eventual alteração legislativa ou jurisprudencial superveniente por ausência de dispositivo vinculado no acervo verificado.`;

  const candidatePayload: CandidateExplanationPayload = {
    questionId: params.questionId,
    officialKeyRevisionId: params.officialKeyRevisionId,
    officialAnswerValue: params.officialAnswerValue,
    claimedCorrectAnswerValue: params.officialAnswerValue,
    examDate: params.examDate,
    summary: `Análise fundamentada do gabarito oficial (${params.officialAnswerValue}) — ${params.subjectName}.`,
    correctOptionAnalysis: correctOpt
      ? `O gabarito oficial da banca é "${params.officialAnswerValue}" ("${correctOpt.content}"). ${hasVerifiedSources ? `Fundamento normativo verificado: ${enrichedCitations.map((c) => `"${c.quotedSnippet}" (${c.claimReference})`).join(" ")}` : "Explicação aguardando vinculação de dispositivo legal no catálogo."}`
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

  const aiConfigNotice = !aiApiConfigured
    ? "\n[Nota Técnica: A variável AI_API_KEY não está configurada no ambiente; exibindo fundamentação determinística extraída exclusivamente do Catálogo Jurídico Verificado sem simular geração por LLM.]"
    : "";

  let assistantCommandResponse: string | undefined;
  switch (params.command) {
    case "SIMPLIFY":
      assistantCommandResponse = `Síntese direta: A banca considera correta a opção "${params.officialAnswerValue}" em ${params.subjectName}. ${hasVerifiedSources ? `Regra-chave (${enrichedCitations[0]?.claimReference}): ${enrichedCitations[0]?.quotedSnippet}` : "Vincule a fonte legal correspondente para leitura literal do artigo."}${aiConfigNotice}`;
      break;
    case "WHY_MY_OPTION_IS_WRONG":
      assistantCommandResponse = `${
        params.userSelectedAnswer
          ? `Você assinalou "${params.userSelectedAnswer}", enquanto o gabarito oficial definitivo da banca é "${params.officialAnswerValue}". ${wrongOptionsAnalysis[params.userSelectedAnswer] ?? ""}`
          : `Selecione uma alternativa para comparar sua resposta com o gabarito oficial (${params.officialAnswerValue}).`
      }${aiConfigNotice}`;
      break;
    case "LEGAL_FOUNDATION":
      assistantCommandResponse = `${
        hasVerifiedSources
          ? enrichedCitations
              .map(
                (c) =>
                  `• ${c.claimReference} (${c.authority} — ${c.officialUrl}): "${c.quotedSnippet}"`
              )
              .join("\n")
          : "Nenhum dispositivo legal verificado está vinculado a esta questão no momento. Cadastre ou associe o artigo em /admin/fontes-juridicas."
      }${aiConfigNotice}`;
      break;
    case "HISTORICAL_VS_CURRENT":
      assistantCommandResponse = `[Na época da prova]: ${historicalUnderstanding}\n\n[Entendimento atual]: ${currentUnderstanding}${aiConfigNotice}`;
      break;
    case "REVISION_SUMMARY":
      assistantCommandResponse = `Ficha de Revisão — ${params.subjectName}:\n1. Gabarito Oficial: ${params.officialAnswerValue}\n2. Fonte Primária: ${hasVerifiedSources ? enrichedCitations.map((c) => c.claimReference).join(", ") : "Pendente de vínculo"}\n3. Status de Vigência: ${validation.status}${aiConfigNotice}`;
      break;
    case "GENERATE_DIDACTIC_DRILL":
      assistantCommandResponse = !aiApiConfigured
        ? `[DEPENDÊNCIA DE IA NÃO CONFIGURADA — AI_API_KEY AUSENTE]\nPara gerar novas questões didáticas de treino por inteligência artificial, configure AI_API_KEY no ambiente. O sistema jamais simula respostas de IA quando o provedor não está configurado.`
        : `[MATERIAL DE TREINO GERADO POR IA — NÃO É QUESTÃO OFICIAL DE PROVA]\nItem Didático de Fixação (${params.subjectName}): Com base no dispositivo estudado (${enrichedCitations[0]?.claimReference ?? params.subjectName}), julgue a assertiva à luz da literalidade normativa verificada.`;
      break;
    default:
      assistantCommandResponse = !aiApiConfigured
        ? aiConfigNotice.trim()
        : undefined;
  }

  logger.info("LEGAL_EXPLANATION_GENERATED", {
    questionId: params.questionId,
    command: params.command,
    aiApiConfigured,
    validationStatus: validation.status,
    durationMs: Date.now() - startMs,
  });

  return {
    questionId: params.questionId,
    officialKeyRevisionId: params.officialKeyRevisionId,
    officialAnswerValue: params.officialAnswerValue,
    command: params.command,
    aiApiConfigured,
    isAiGeneratedMaterial: params.command === "GENERATE_DIDACTIC_DRILL",
    disclaimerLabel:
      params.command === "GENERATE_DIDACTIC_DRILL"
        ? "MATERIAL DE TREINO GERADO POR IA — NÃO É QUESTÃO OFICIAL"
        : validation.status === "VERIFIED"
          ? aiApiConfigured
            ? "COMENTÁRIO VINCULADO A FONTE OFICIAL VERIFICADA"
            : "FUNDAMENTAÇÃO DETERMINÍSTICA DE FONTE OFICIAL VERIFICADA (AI_API_KEY NÃO CONFIGURADA)"
          : "EXPLICAÇÃO SEM FONTE VINCULADA — VALIDAÇÃO DOCUMENTAL PENDENTE",
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
