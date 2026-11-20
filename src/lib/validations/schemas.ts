import { z } from "zod";

export const loginSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, "Informe seu e-mail de acesso.")
    .email("Formato de e-mail inválido."),
  password: z
    .string()
    .min(8, "A senha deve ter no mínimo 8 caracteres.")
    .max(128, "Senha excede o limite permitido."),
});

const emptyStringToUndefined = (val: unknown): unknown => {
  if (val === null || val === undefined) return undefined;
  if (typeof val === "string") {
    const trimmed = val.trim();
    return trimmed.length === 0 ? undefined : trimmed;
  }
  return val;
};

const optionalTrimmedString = z.preprocess(
  emptyStringToUndefined,
  z.string().trim().optional()
);

const optionalUuid = z.preprocess(
  emptyStringToUndefined,
  z.string().uuid().optional()
);

const optionalBoolean = z.preprocess((val) => {
  if (val === "" || val === null || val === undefined) return undefined;
  if (val === "true" || val === "1" || val === true) return true;
  if (val === "false" || val === "0" || val === false) return false;
  return val;
}, z.boolean().default(false));

export const questionFilterSchema = z.object({
  trackCode: optionalTrimmedString,
  positionId: optionalUuid,
  examBoardId: optionalUuid,
  institutionId: optionalUuid,
  disciplineId: optionalUuid,
  topicId: optionalUuid,
  subjectId: optionalUuid,
  year: z.preprocess(
    emptyStringToUndefined,
    z.coerce.number().int().min(2000).max(2035).optional()
  ),
  questionType: z.preprocess(
    emptyStringToUndefined,
    z.enum(["MULTIPLE_CHOICE", "TRUE_FALSE"]).optional()
  ),
  difficulty: z.preprocess(
    emptyStringToUndefined,
    z.enum(["EASY", "MEDIUM", "HARD"]).optional()
  ),
  resolutionFilter: z.preprocess(
    emptyStringToUndefined,
    z.enum(["ALL", "RESOLVED", "UNRESOLVED"]).default("ALL")
  ),
  accuracyFilter: z.preprocess(
    emptyStringToUndefined,
    z.enum(["ALL", "CORRECT", "WRONG"]).default("ALL")
  ),
  onlyBookmarked: optionalBoolean,
  onlyVerifiedExplanations: optionalBoolean,
  includeAnnulled: optionalBoolean,
  onlyOutdated: optionalBoolean,
  query: z.preprocess(
    emptyStringToUndefined,
    z.string().trim().max(200).optional()
  ),
  sortBy: z.preprocess(
    emptyStringToUndefined,
    z
      .enum(["RECENT", "DIFFICULTY", "REVIEW_PRIORITY", "ORIGINAL_NUMBER"])
      .default("ORIGINAL_NUMBER")
  ),
  page: z.preprocess(
    emptyStringToUndefined,
    z.coerce.number().int().min(1).default(1)
  ),
  pageSize: z.preprocess(
    emptyStringToUndefined,
    z.coerce.number().int().min(1).max(50).default(15)
  ),
});

export type QuestionFilterInput = z.infer<typeof questionFilterSchema>;

/**
 * Normaliza e valida cada campo individualmente:
 * - Strings vazias ("") viram undefined antes da validação (não invalidam o formulário)
 * - Se um parâmetro específico for realmente inválido (ex.: UUID corrompido na URL),
 *   apenas esse campo é descartado e reportado em `invalidFields`, preservando todos os demais filtros válidos.
 */
export function parseQuestionFiltersResilient(
  rawParams: Record<string, string | string[] | undefined>
): {
  filters: QuestionFilterInput;
  invalidFields: string[];
} {
  const flat: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(rawParams)) {
    const first = Array.isArray(val) ? val[0] : val;
    flat[key] = emptyStringToUndefined(first);
  }
  if (!flat.trackCode && flat.track) {
    flat.trackCode = flat.track;
  }

  const full = questionFilterSchema.safeParse(flat);
  if (full.success) {
    return { filters: full.data, invalidFields: [] };
  }

  const invalidFields = Array.from(
    new Set(
      full.error.issues
        .map((issue) => String(issue.path[0] ?? ""))
        .filter(Boolean)
    )
  );

  const sanitized: Record<string, unknown> = { ...flat };
  for (const badField of invalidFields) {
    delete sanitized[badField];
  }

  const recovered = questionFilterSchema.safeParse(sanitized);
  return {
    filters: recovered.success ? recovered.data : questionFilterSchema.parse({}),
    invalidFields,
  };
}

/**
 * Serializa apenas filtros ativos/não-padrão em URLSearchParams (isomórfico Server + Client).
 */
export function buildQuestionFilterSearchParams(
  state: Partial<QuestionFilterInput>,
  overridePage?: number
): URLSearchParams {
  const sp = new URLSearchParams();
  if (state.trackCode) sp.set("trackCode", state.trackCode);
  if (state.disciplineId) sp.set("disciplineId", state.disciplineId);
  if (state.topicId) sp.set("topicId", state.topicId);
  if (state.examBoardId) sp.set("examBoardId", state.examBoardId);
  if (state.positionId) sp.set("positionId", state.positionId);
  if (state.institutionId) sp.set("institutionId", state.institutionId);
  if (state.year) sp.set("year", String(state.year));
  if (state.questionType) sp.set("questionType", state.questionType);
  if (state.difficulty) sp.set("difficulty", state.difficulty);
  if (state.resolutionFilter && state.resolutionFilter !== "ALL") {
    sp.set("resolutionFilter", state.resolutionFilter);
  }
  if (state.accuracyFilter && state.accuracyFilter !== "ALL") {
    sp.set("accuracyFilter", state.accuracyFilter);
  }
  if (state.onlyBookmarked) sp.set("onlyBookmarked", "true");
  if (state.onlyVerifiedExplanations) {
    sp.set("onlyVerifiedExplanations", "true");
  }
  if (state.includeAnnulled) sp.set("includeAnnulled", "true");
  if (state.query && state.query.trim().length > 0) {
    sp.set("query", state.query.trim());
  }
  if (state.sortBy && state.sortBy !== "ORIGINAL_NUMBER") {
    sp.set("sortBy", state.sortBy);
  }
  const page = overridePage ?? state.page;
  if (page && page > 1) {
    sp.set("page", String(page));
  }
  return sp;
}

export const submitAnswerSchema = z.object({
  questionId: z.string().uuid("ID da questão inválido."),
  examQuestionInstanceId: z
    .string()
    .uuid("ID da instância de prova inválido."),
  selectedAnswer: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^(A|B|C|D|E|CERTO|ERRADO)$/, "Alternativa inválida.")
    .nullable(),
  timeSpentSeconds: z.number().int().min(0).max(7200).default(0),
  studySessionId: z.string().uuid().optional(),
  declaredDifficulty: z.enum(["EASY", "MEDIUM", "HARD"]).optional(),
  idempotencyKey: z.string().trim().min(8).max(128).optional(),
});

export type SubmitAnswerInput = z.infer<typeof submitAnswerSchema>;

export const createSimulationSchema = z.object({
  title: z
    .string()
    .trim()
    .min(3, "Informe um título para o simulado.")
    .max(140),
  mode: z.enum(["CUSTOM", "PAST_EXAM", "WEAKNESS_FOCUS"]),
  trackCode: z.string().trim().min(2).max(20),
  examEditionId: z.string().uuid().optional(),
  examFormId: z.string().uuid().optional(),
  subjectIds: z.array(z.string().uuid()).optional(),
  totalQuestions: z.coerce.number().int().min(5).max(120).default(40),
  durationMinutes: z.coerce.number().int().min(15).max(360).default(240),
  rulesetCode: z
    .enum([
      "VUNESP_STANDARD_5",
      "CEBRASPE_CERTO_ERRADO_PRF2021",
      "FGV_OAB_1FASE_80",
    ])
    .default("VUNESP_STANDARD_5"),
});

export type CreateSimulationInput = z.infer<typeof createSimulationSchema>;

export const saveSimulationResponsesSchema = z.object({
  responses: z
    .array(
      z.object({
        simulationItemId: z.string().uuid(),
        selectedAnswer: z
          .string()
          .trim()
          .toUpperCase()
          .regex(/^(A|B|C|D|E|CERTO|ERRADO)$/)
          .nullable(),
        markedForReview: z.boolean().default(false),
        timeSpentSeconds: z.number().int().min(0).max(7200).default(0),
      })
    )
    .min(1),
  elapsedSeconds: z.number().int().min(0).optional(),
});

export const explanationRequestSchema = z.object({
  questionId: z.string().uuid(),
  examQuestionInstanceId: z.string().uuid().optional(),
  command: z
    .enum([
      "FULL_EXPLANATION",
      "SIMPLIFY",
      "WHY_MY_OPTION_IS_WRONG",
      "EXPLAIN_ALL_OPTIONS",
      "PRACTICAL_EXAMPLE",
      "LEGAL_FOUNDATION",
      "HISTORICAL_VS_CURRENT",
      "REVISION_SUMMARY",
      "GENERATE_DIDACTIC_DRILL",
    ])
    .default("FULL_EXPLANATION"),
  userSelectedAnswer: z.string().trim().optional(),
});

export const createImportJobSchema = z.object({
  examEditionId: z.string().uuid(),
  examFormId: z.string().uuid(),
  examPdfTitle: z.string().trim().min(3).max(200),
  examPdfOfficialUrl: z.string().url("Informe a URL oficial da prova."),
  examPdfSha256: z
    .string()
    .regex(/^[a-f0-9]{64}$/i, "Hash SHA-256 inválido (64 caracteres hex)."),
  answerKeyOfficialUrl: z.string().url("Informe a URL oficial do gabarito."),
  answerKeySha256: z
    .string()
    .regex(/^[a-f0-9]{64}$/i, "Hash SHA-256 do gabarito inválido."),
  rightsNotes: z.string().trim().max(500).optional(),
  idempotencyKey: z.string().trim().min(8).max(128),
  extractedItems: z
    .array(
      z.object({
        originalNumber: z.number().int().min(1).max(250),
        questionType: z.enum(["MULTIPLE_CHOICE", "TRUE_FALSE"]),
        statement: z.string().trim().min(15),
        supportText: z.string().trim().optional(),
        instruction: z.string().trim().optional(),
        options: z
          .array(
            z.object({
              label: z.string().trim().min(1).max(10),
              content: z.string().trim().min(1),
            })
          )
          .min(2),
        officialAnswer: z.string().trim().min(1).max(10),
        isAnnulled: z.boolean().default(false),
        subjectSlug: z.string().trim().min(2),
        pageNumber: z.number().int().min(1).optional(),
      })
    )
    .min(1, "A importação deve conter ao menos uma questão extraída."),
});
