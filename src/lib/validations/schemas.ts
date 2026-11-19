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

export const questionFilterSchema = z.object({
  trackCode: z.string().trim().optional(),
  positionId: z.string().uuid().optional(),
  examBoardId: z.string().uuid().optional(),
  institutionId: z.string().uuid().optional(),
  subjectId: z.string().uuid().optional(),
  year: z.coerce.number().int().min(2000).max(2035).optional(),
  questionType: z.enum(["MULTIPLE_CHOICE", "TRUE_FALSE"]).optional(),
  difficulty: z.enum(["EASY", "MEDIUM", "HARD"]).optional(),
  resolutionFilter: z
    .enum(["ALL", "RESOLVED", "UNRESOLVED"])
    .default("ALL"),
  accuracyFilter: z.enum(["ALL", "CORRECT", "WRONG"]).default("ALL"),
  onlyBookmarked: z.coerce.boolean().default(false),
  onlyVerifiedExplanations: z.coerce.boolean().default(false),
  includeAnnulled: z.coerce.boolean().default(false),
  onlyOutdated: z.coerce.boolean().default(false),
  query: z.string().trim().max(200).optional(),
  sortBy: z
    .enum(["RECENT", "DIFFICULTY", "REVIEW_PRIORITY", "ORIGINAL_NUMBER"])
    .default("ORIGINAL_NUMBER"),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(15),
});

export type QuestionFilterInput = z.infer<typeof questionFilterSchema>;

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
