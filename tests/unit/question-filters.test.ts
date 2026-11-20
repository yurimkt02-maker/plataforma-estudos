import { describe, expect, it } from "vitest";
import {
  parseQuestionFiltersResilient,
  questionFilterSchema,
} from "@/lib/validations/schemas";
import { buildQuestionSearchWhereClause } from "@/features/question-bank/service";
import { buildQuestionFilterSearchParams } from "@/components/questions/question-bank-filters";

const UUID_DISC = "fdfe9b2f-4858-4b69-87d2-fae6ce43a23d";
const UUID_TOPIC_1 = "234ad262-6fbb-46b0-a23e-05d05e8bb491";
const UUID_TOPIC_2 = "da672189-9545-4d1e-8c7d-f9bb1ed397ec";
const UUID_BOARD = "11111111-1111-4111-8111-111111111111";
const UUID_USER = "22222222-2222-4222-8222-222222222222";

describe("Filtros do Banco de Questões — Validação, Hierarquia e Combinação", () => {
  it("normaliza parâmetros UUID e opcionais vazios ('') para undefined sem invalidar a pesquisa", () => {
    const parsed = questionFilterSchema.safeParse({
      trackCode: "OAB",
      disciplineId: UUID_DISC,
      topicId: "",
      subjectId: "",
      positionId: "",
      examBoardId: "",
      institutionId: "",
      year: "",
      questionType: "",
      difficulty: "",
      query: "   ",
      resolutionFilter: "ALL",
      accuracyFilter: "ALL",
      page: "",
    });

    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.trackCode).toBe("OAB");
      expect(parsed.data.disciplineId).toBe(UUID_DISC);
      expect(parsed.data.topicId).toBeUndefined();
      expect(parsed.data.positionId).toBeUndefined();
      expect(parsed.data.examBoardId).toBeUndefined();
      expect(parsed.data.institutionId).toBeUndefined();
      expect(parsed.data.year).toBeUndefined();
      expect(parsed.data.query).toBeUndefined();
      expect(parsed.data.page).toBe(1);
    }
  });

  it("preserva filtros válidos mesmo quando um parâmetro isolado da URL é inválido (sem silenciar erro)", () => {
    const { filters, invalidFields } = parseQuestionFiltersResilient({
      track: "PRF",
      disciplineId: UUID_DISC,
      positionId: "uuid-corrompido",
      year: "2021",
    });

    expect(invalidFields).toEqual(["positionId"]);
    expect(filters.trackCode).toBe("PRF");
    expect(filters.disciplineId).toBe(UUID_DISC);
    expect(filters.year).toBe(2021);
    expect(filters.positionId).toBeUndefined();
  });

  it("inclui disciplina principal e todos os assuntos descendentes no filtro Prisma when resolvedSubjectIds tem múltiplos IDs", () => {
    const filters = questionFilterSchema.parse({
      trackCode: "PRF",
      disciplineId: UUID_DISC,
    });

    const where = buildQuestionSearchWhereClause({
      userId: UUID_USER,
      filters,
      resolvedSubjectIds: [UUID_DISC, UUID_TOPIC_1, UUID_TOPIC_2],
    });

    expect(where.status).toBe("PUBLISHED");
    expect(where.subjects).toEqual({
      some: { subjectId: { in: [UUID_DISC, UUID_TOPIC_1, UUID_TOPIC_2] } },
    });
    expect(where.examInstances).toEqual({
      some: {
        isAnnulled: false,
        examForm: {
          examEdition: {
            position: {
              studyTrack: { code: "PRF" },
            },
          },
        },
      },
    });
  });

  it("restringe exatamente ao assunto específico quando topicId é informado", () => {
    const filters = questionFilterSchema.parse({
      trackCode: "PRF",
      disciplineId: UUID_DISC,
      topicId: UUID_TOPIC_1,
    });

    const where = buildQuestionSearchWhereClause({
      userId: UUID_USER,
      filters,
      resolvedSubjectIds: [UUID_TOPIC_1],
    });

    expect(where.subjects).toEqual({
      some: { subjectId: UUID_TOPIC_1 },
    });
  });

  it("combina resolutionFilter e accuracyFilter via AND sem sobrescrever condições conflitantes", () => {
    const filters = questionFilterSchema.parse({
      resolutionFilter: "UNRESOLVED",
      accuracyFilter: "WRONG",
    });

    const where = buildQuestionSearchWhereClause({
      userId: UUID_USER,
      filters,
    });

    expect(where.attempts).toBeUndefined();
    expect(where.AND).toEqual([
      { attempts: { none: { userId: UUID_USER } } },
      { attempts: { some: { userId: UUID_USER, isCorrect: false } } },
    ]);
  });

  it("combina concurso + disciplina + assunto + banca + ano + favoritas + anuladas corretamente", () => {
    const filters = questionFilterSchema.parse({
      trackCode: "OAB",
      disciplineId: UUID_DISC,
      topicId: UUID_TOPIC_1,
      examBoardId: UUID_BOARD,
      year: "2025",
      onlyBookmarked: "true",
      includeAnnulled: "true",
      resolutionFilter: "RESOLVED",
      accuracyFilter: "CORRECT",
    });

    const where = buildQuestionSearchWhereClause({
      userId: UUID_USER,
      filters,
      resolvedSubjectIds: [UUID_TOPIC_1],
    });

    expect(where.bookmarks).toEqual({ some: { userId: UUID_USER } });
    expect(where.AND).toEqual([
      { attempts: { some: { userId: UUID_USER } } },
      { attempts: { some: { userId: UUID_USER, isCorrect: true } } },
    ]);
    expect(where.examInstances).toEqual({
      some: {
        examForm: {
          examEdition: {
            year: 2025,
            examBoardId: UUID_BOARD,
            position: {
              studyTrack: { code: "OAB" },
            },
          },
        },
      },
    });
  });

  it("preserva todos os filtros ativos na URL ao paginar e omite parâmetros vazios", () => {
    const spPage2 = buildQuestionFilterSearchParams(
      {
        trackCode: "OAB",
        disciplineId: UUID_DISC,
        topicId: UUID_TOPIC_1,
        year: 2024,
        onlyBookmarked: true,
        resolutionFilter: "ALL",
        accuracyFilter: "WRONG",
        sortBy: "ORIGINAL_NUMBER",
      },
      2
    );

    expect(spPage2.get("trackCode")).toBe("OAB");
    expect(spPage2.get("disciplineId")).toBe(UUID_DISC);
    expect(spPage2.get("topicId")).toBe(UUID_TOPIC_1);
    expect(spPage2.get("year")).toBe("2024");
    expect(spPage2.get("onlyBookmarked")).toBe("true");
    expect(spPage2.get("accuracyFilter")).toBe("WRONG");
    expect(spPage2.get("page")).toBe("2");
    expect(spPage2.has("resolutionFilter")).toBe(false);
    expect(spPage2.has("sortBy")).toBe(false);
    expect(spPage2.has("positionId")).toBe(false);
  });
});
