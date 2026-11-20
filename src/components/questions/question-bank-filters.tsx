"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Filter,
  Search,
  SlidersHorizontal,
  X,
  RotateCcw,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { Badge, Button, Card } from "@/components/ui";
import type { QuestionFilterInput } from "@/lib/validations/schemas";
import type {
  FilterFacetDiscipline,
  QuestionBankFilterFacets,
} from "@/features/question-bank/service";

export type FilterCatalogOptions = {
  tracks: Array<{ code: string; name: string }>;
  boards: Array<{ id: string; acronym: string; name: string }>;
  positions: Array<{ id: string; code: string; name: string }>;
  institutions: Array<{ id: string; acronym: string; name: string }>;
};

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

export function QuestionBankFilters({
  initialFilters,
  catalog,
  facets,
  totalCount,
  invalidFields = [],
}: {
  initialFilters: QuestionFilterInput;
  catalog: FilterCatalogOptions;
  facets: QuestionBankFilterFacets;
  totalCount: number;
  invalidFields?: string[];
}) {
  const router = useRouter();

  // Resolver disciplineId inicial caso o usuário tenha chegado via URL legada (?subjectId=...)
  const resolvedInitial = useMemo(() => {
    let disciplineId = initialFilters.disciplineId ?? "";
    let topicId = initialFilters.topicId ?? "";

    if (!disciplineId && !topicId && initialFilters.subjectId) {
      const asRoot = facets.disciplines.find(
        (d) => d.id === initialFilters.subjectId
      );
      if (asRoot) {
        disciplineId = asRoot.id;
      } else {
        for (const d of facets.disciplines) {
          const child = d.topics.find((t) => t.id === initialFilters.subjectId);
          if (child) {
            disciplineId = d.id;
            topicId = child.id;
            break;
          }
        }
      }
    } else if (topicId && !disciplineId) {
      for (const d of facets.disciplines) {
        if (d.topics.some((t) => t.id === topicId)) {
          disciplineId = d.id;
          break;
        }
      }
    }

    return { disciplineId, topicId };
  }, [initialFilters, facets.disciplines]);

  const [trackCode, setTrackCode] = useState(initialFilters.trackCode ?? "");
  const [disciplineId, setDisciplineId] = useState(
    resolvedInitial.disciplineId
  );
  const [topicId, setTopicId] = useState(resolvedInitial.topicId);
  const [query, setQuery] = useState(initialFilters.query ?? "");
  const [examBoardId, setExamBoardId] = useState(
    initialFilters.examBoardId ?? ""
  );
  const [positionId, setPositionId] = useState(initialFilters.positionId ?? "");
  const [institutionId, setInstitutionId] = useState(
    initialFilters.institutionId ?? ""
  );
  const [year, setYear] = useState(
    initialFilters.year ? String(initialFilters.year) : ""
  );
  const [questionType, setQuestionType] = useState(
    initialFilters.questionType ?? ""
  );
  const [difficulty, setDifficulty] = useState(initialFilters.difficulty ?? "");
  const [resolutionFilter, setResolutionFilter] = useState<
    QuestionFilterInput["resolutionFilter"]
  >(initialFilters.resolutionFilter);
  const [accuracyFilter, setAccuracyFilter] = useState<
    QuestionFilterInput["accuracyFilter"]
  >(initialFilters.accuracyFilter);
  const [sortBy, setSortBy] = useState<QuestionFilterInput["sortBy"]>(
    initialFilters.sortBy
  );
  const [onlyBookmarked, setOnlyBookmarked] = useState(
    initialFilters.onlyBookmarked
  );
  const [onlyVerifiedExplanations, setOnlyVerifiedExplanations] = useState(
    initialFilters.onlyVerifiedExplanations
  );
  const [includeAnnulled, setIncludeAnnulled] = useState(
    initialFilters.includeAnnulled
  );

  const hasAdvancedActive = Boolean(
    examBoardId ||
      positionId ||
      institutionId ||
      year ||
      questionType ||
      difficulty ||
      resolutionFilter !== "ALL" ||
      accuracyFilter !== "ALL" ||
      onlyBookmarked ||
      onlyVerifiedExplanations ||
      includeAnnulled ||
      sortBy !== "ORIGINAL_NUMBER"
  );
  const [showAdvanced, setShowAdvanced] = useState(hasAdvancedActive);

  // Disciplinas disponíveis conforme o concurso selecionado
  const availableDisciplines = useMemo(() => {
    const getCount = (d: FilterFacetDiscipline) =>
      trackCode ? (d.countByTrack[trackCode] ?? 0) : d.totalCount;

    const list = facets.disciplines
      .map((d) => ({ ...d, activeCount: getCount(d) }))
      .filter((d) => d.activeCount > 0 || d.id === disciplineId)
      .sort((a, b) => b.activeCount - a.activeCount || a.name.localeCompare(b.name));

    return list;
  }, [facets.disciplines, trackCode, disciplineId]);

  // Assuntos dependentes da disciplina selecionada
  const selectedDiscipline = useMemo(
    () => facets.disciplines.find((d) => d.id === disciplineId) ?? null,
    [facets.disciplines, disciplineId]
  );

  const availableTopics = useMemo(() => {
    if (!selectedDiscipline) return [];
    return selectedDiscipline.topics
      .map((t) => ({
        ...t,
        activeCount: trackCode
          ? (t.countByTrack[trackCode] ?? 0)
          : t.totalCount,
      }))
      .filter((t) => t.activeCount > 0 || t.id === topicId)
      .sort((a, b) => b.activeCount - a.activeCount || a.name.localeCompare(b.name));
  }, [selectedDiscipline, trackCode, topicId]);

  // Estimativa imediata de questões disponíveis para a combinação Concurso + Disciplina + Assunto
  const combinationCount = useMemo(() => {
    if (topicId && selectedDiscipline) {
      const t = selectedDiscipline.topics.find((x) => x.id === topicId);
      if (!t) return 0;
      return trackCode ? (t.countByTrack[trackCode] ?? 0) : t.totalCount;
    }
    if (disciplineId && selectedDiscipline) {
      return trackCode
        ? (selectedDiscipline.countByTrack[trackCode] ?? 0)
        : selectedDiscipline.totalCount;
    }
    if (trackCode) {
      return facets.countByTrack[trackCode] ?? 0;
    }
    return facets.totalPublished;
  }, [trackCode, disciplineId, topicId, selectedDiscipline, facets]);

  function handleTrackChange(nextTrack: string) {
    setTrackCode(nextTrack);
    // Limpa disciplina/assunto se não possuírem questões no novo concurso
    if (disciplineId) {
      const disc = facets.disciplines.find((d) => d.id === disciplineId);
      const countInNext = disc
        ? nextTrack
          ? (disc.countByTrack[nextTrack] ?? 0)
          : disc.totalCount
        : 0;
      if (countInNext === 0) {
        setDisciplineId("");
        setTopicId("");
        return;
      }
      if (topicId && disc) {
        const topic = disc.topics.find((t) => t.id === topicId);
        const topicCountInNext = topic
          ? nextTrack
            ? (topic.countByTrack[nextTrack] ?? 0)
            : topic.totalCount
          : 0;
        if (topicCountInNext === 0) {
          setTopicId("");
        }
      }
    }
  }

  function handleDisciplineChange(nextDisciplineId: string) {
    setDisciplineId(nextDisciplineId);
    // Sempre limpar assunto incompatível ao trocar de disciplina
    if (!nextDisciplineId) {
      setTopicId("");
      return;
    }
    const disc = facets.disciplines.find((d) => d.id === nextDisciplineId);
    if (!disc || !disc.topics.some((t) => t.id === topicId)) {
      setTopicId("");
    }
  }

  function navigateWithState(overrides?: Partial<QuestionFilterInput>) {
    const merged: Partial<QuestionFilterInput> = {
      trackCode: trackCode || undefined,
      disciplineId: disciplineId || undefined,
      topicId: topicId || undefined,
      query: query.trim() || undefined,
      examBoardId: examBoardId || undefined,
      positionId: positionId || undefined,
      institutionId: institutionId || undefined,
      year: year ? Number(year) : undefined,
      questionType: (questionType || undefined) as QuestionFilterInput["questionType"],
      difficulty: (difficulty || undefined) as QuestionFilterInput["difficulty"],
      resolutionFilter,
      accuracyFilter,
      onlyBookmarked,
      onlyVerifiedExplanations,
      includeAnnulled,
      sortBy,
      ...overrides,
    };
    const sp = buildQuestionFilterSearchParams(merged, 1);
    const qs = sp.toString();
    router.push(qs ? `/questoes?${qs}` : "/questoes");
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    navigateWithState();
  }

  function handleClearAll() {
    setTrackCode("");
    setDisciplineId("");
    setTopicId("");
    setQuery("");
    setExamBoardId("");
    setPositionId("");
    setInstitutionId("");
    setYear("");
    setQuestionType("");
    setDifficulty("");
    setResolutionFilter("ALL");
    setAccuracyFilter("ALL");
    setOnlyBookmarked(false);
    setOnlyVerifiedExplanations(false);
    setIncludeAnnulled(false);
    setSortBy("ORIGINAL_NUMBER");
    router.push("/questoes");
  }

  // Chips de filtros ativos na URL atual (permitem remoção individual)
  const activeChips: Array<{ key: string; label: string; onRemove: () => void }> =
    [];
  if (initialFilters.trackCode) {
    activeChips.push({
      key: "track",
      label: `Concurso: ${initialFilters.trackCode}`,
      onRemove: () => {
        setTrackCode("");
        navigateWithState({ trackCode: undefined });
      },
    });
  }
  if (resolvedInitial.disciplineId) {
    const discName =
      facets.disciplines.find((d) => d.id === resolvedInitial.disciplineId)
        ?.name ?? "Disciplina";
    activeChips.push({
      key: "discipline",
      label: `Disciplina: ${discName}`,
      onRemove: () => {
        setDisciplineId("");
        setTopicId("");
        navigateWithState({ disciplineId: undefined, topicId: undefined });
      },
    });
  }
  if (resolvedInitial.topicId) {
    const topicName =
      facets.disciplines
        .flatMap((d) => d.topics)
        .find((t) => t.id === resolvedInitial.topicId)?.name ?? "Assunto";
    activeChips.push({
      key: "topic",
      label: `Assunto: ${topicName}`,
      onRemove: () => {
        setTopicId("");
        navigateWithState({ topicId: undefined });
      },
    });
  }
  if (initialFilters.query) {
    activeChips.push({
      key: "query",
      label: `Busca: "${initialFilters.query}"`,
      onRemove: () => {
        setQuery("");
        navigateWithState({ query: undefined });
      },
    });
  }
  if (initialFilters.examBoardId) {
    const b = catalog.boards.find((x) => x.id === initialFilters.examBoardId);
    activeChips.push({
      key: "board",
      label: `Banca: ${b?.acronym ?? "Selecionada"}`,
      onRemove: () => {
        setExamBoardId("");
        navigateWithState({ examBoardId: undefined });
      },
    });
  }
  if (initialFilters.year) {
    activeChips.push({
      key: "year",
      label: `Ano: ${initialFilters.year}`,
      onRemove: () => {
        setYear("");
        navigateWithState({ year: undefined });
      },
    });
  }
  if (initialFilters.questionType) {
    activeChips.push({
      key: "type",
      label:
        initialFilters.questionType === "TRUE_FALSE"
          ? "Certo / Errado"
          : "Múltipla Escolha",
      onRemove: () => {
        setQuestionType("");
        navigateWithState({ questionType: undefined });
      },
    });
  }
  if (initialFilters.resolutionFilter !== "ALL") {
    activeChips.push({
      key: "resolution",
      label:
        initialFilters.resolutionFilter === "RESOLVED"
          ? "Já resolvidas"
          : "Não resolvidas",
      onRemove: () => {
        setResolutionFilter("ALL");
        navigateWithState({ resolutionFilter: "ALL" });
      },
    });
  }
  if (initialFilters.accuracyFilter !== "ALL") {
    activeChips.push({
      key: "accuracy",
      label:
        initialFilters.accuracyFilter === "CORRECT"
          ? "Que acertei"
          : "Que errei",
      onRemove: () => {
        setAccuracyFilter("ALL");
        navigateWithState({ accuracyFilter: "ALL" });
      },
    });
  }
  if (initialFilters.onlyBookmarked) {
    activeChips.push({
      key: "bookmarked",
      label: "Somente favoritas",
      onRemove: () => {
        setOnlyBookmarked(false);
        navigateWithState({ onlyBookmarked: false });
      },
    });
  }
  if (initialFilters.includeAnnulled) {
    activeChips.push({
      key: "annulled",
      label: "Incluindo anuladas",
      onRemove: () => {
        setIncludeAnnulled(false);
        navigateWithState({ includeAnnulled: false });
      },
    });
  }

  return (
    <Card className="p-5 sm:p-6 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3.5 border-b border-border">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-brand-accent shrink-0" />
          <h2 className="font-display text-sm font-semibold text-foreground">
            Filtrar questões oficiais
          </h2>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted tabular-nums-strict">
          <Badge variant="brand">
            {totalCount} {totalCount === 1 ? "questão encontrada" : "questões encontradas"}
          </Badge>
        </div>
      </div>

      {invalidFields.length > 0 && (
        <div
          role="status"
          className="p-3 rounded-md bg-semantic-warning-bg border border-semantic-warning/30 text-xs text-semantic-warning"
        >
          Alguns parâmetros inválidos na URL foram ignorados (
          {invalidFields.join(", ")}). Os demais filtros válidos foram
          preservados.
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Fluxo Principal: 1. Concurso -> 2. Disciplina -> 3. Assunto */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
          <div>
            <label
              htmlFor="filter-track"
              className="block text-xs font-medium text-foreground mb-1.5"
            >
              1. Concurso
            </label>
            <select
              id="filter-track"
              name="trackCode"
              value={trackCode}
              onChange={(e) => handleTrackChange(e.target.value)}
              className="w-full h-10 px-3 rounded-md bg-background border border-border text-xs sm:text-sm text-foreground hover:border-border-strong focus:outline-none focus:border-brand"
            >
              <option value="">
                Todos os concursos ({facets.totalPublished})
              </option>
              {catalog.tracks.map((t) => {
                const count = facets.countByTrack[t.code] ?? 0;
                return (
                  <option key={t.code} value={t.code}>
                    {t.code} — {t.name} ({count} publicadas)
                  </option>
                );
              })}
            </select>
          </div>

          <div>
            <label
              htmlFor="filter-discipline"
              className="block text-xs font-medium text-foreground mb-1.5"
            >
              2. Disciplina
            </label>
            <select
              id="filter-discipline"
              name="disciplineId"
              value={disciplineId}
              onChange={(e) => handleDisciplineChange(e.target.value)}
              className="w-full h-10 px-3 rounded-md bg-background border border-border text-xs sm:text-sm text-foreground hover:border-border-strong focus:outline-none focus:border-brand"
            >
              <option value="">
                Todas as disciplinas ({availableDisciplines.length})
              </option>
              {availableDisciplines.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name} ({d.activeCount})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              htmlFor="filter-topic"
              className="block text-xs font-medium text-foreground mb-1.5"
            >
              3. Assunto / Tema
            </label>
            <select
              id="filter-topic"
              name="topicId"
              value={topicId}
              disabled={!disciplineId || availableTopics.length === 0}
              onChange={(e) => setTopicId(e.target.value)}
              className="w-full h-10 px-3 rounded-md bg-background border border-border text-xs sm:text-sm text-foreground hover:border-border-strong focus:outline-none focus:border-brand disabled:bg-disabled-bg disabled:text-disabled-text disabled:cursor-not-allowed"
            >
              {!disciplineId ? (
                <option value="">Selecione primeiro uma disciplina</option>
              ) : availableTopics.length === 0 ? (
                <option value="">
                  Sem subassuntos cadastrados (todas da disciplina)
                </option>
              ) : (
                <>
                  <option value="">
                    Todos os assuntos de {selectedDiscipline?.name}
                  </option>
                  {availableTopics.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} ({t.activeCount})
                    </option>
                  ))}
                </>
              )}
            </select>
          </div>
        </div>

        {/* Barra de Pesquisa + Botão de Filtros Avançados + Ações */}
        <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-muted absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              id="filter-query"
              name="query"
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar por palavras-chave, artigo, súmula ou instituto..."
              className="w-full h-10 pl-9 pr-3 rounded-md bg-background border border-border text-xs sm:text-sm text-foreground placeholder:text-subtle hover:border-border-strong focus:outline-none focus:border-brand"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setShowAdvanced((prev) => !prev)}
              aria-expanded={showAdvanced}
              className="inline-flex items-center gap-1.5 h-10 px-3.5 rounded-md border border-border bg-surface hover:bg-surface-subtle text-xs font-medium text-foreground transition-colors"
            >
              <SlidersHorizontal className="w-3.5 h-3.5 text-brand-accent" />
              <span>Filtros avançados</span>
              {showAdvanced ? (
                <ChevronUp className="w-3.5 h-3.5 text-muted" />
              ) : (
                <ChevronDown className="w-3.5 h-3.5 text-muted" />
              )}
            </button>

            <Button type="submit" variant="primary" size="md">
              <span>Aplicar filtros</span>
              <span className="px-1.5 py-0.5 rounded bg-white/15 text-[11px] tabular-nums-strict">
                {combinationCount}
              </span>
            </Button>
          </div>
        </div>

        {/* Filtros Avançados Recolhíveis */}
        {showAdvanced && (
          <div className="pt-4 border-t border-border space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div>
                <label
                  htmlFor="filter-board"
                  className="block text-[11px] font-medium text-muted mb-1"
                >
                  Banca Organizadora
                </label>
                <select
                  id="filter-board"
                  value={examBoardId}
                  onChange={(e) => setExamBoardId(e.target.value)}
                  className="w-full h-9 px-2.5 rounded-md bg-background border border-border text-xs text-foreground"
                >
                  <option value="">Todas as bancas</option>
                  {catalog.boards.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.acronym} — {b.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label
                  htmlFor="filter-year"
                  className="block text-[11px] font-medium text-muted mb-1"
                >
                  Ano da Prova
                </label>
                <select
                  id="filter-year"
                  value={year}
                  onChange={(e) => setYear(e.target.value)}
                  className="w-full h-9 px-2.5 rounded-md bg-background border border-border text-xs text-foreground"
                >
                  <option value="">Todos os anos</option>
                  {facets.years.map((y) => (
                    <option key={y} value={String(y)}>
                      {y}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label
                  htmlFor="filter-type"
                  className="block text-[11px] font-medium text-muted mb-1"
                >
                  Modalidade
                </label>
                <select
                  id="filter-type"
                  value={questionType}
                  onChange={(e) => setQuestionType(e.target.value)}
                  className="w-full h-9 px-2.5 rounded-md bg-background border border-border text-xs text-foreground"
                >
                  <option value="">Todas</option>
                  <option value="MULTIPLE_CHOICE">Múltipla Escolha</option>
                  <option value="TRUE_FALSE">Certo / Errado</option>
                </select>
              </div>

              <div>
                <label
                  htmlFor="filter-sort"
                  className="block text-[11px] font-medium text-muted mb-1"
                >
                  Ordenação
                </label>
                <select
                  id="filter-sort"
                  value={sortBy}
                  onChange={(e) =>
                    setSortBy(e.target.value as QuestionFilterInput["sortBy"])
                  }
                  className="w-full h-9 px-2.5 rounded-md bg-background border border-border text-xs text-foreground"
                >
                  <option value="ORIGINAL_NUMBER">Número original</option>
                  <option value="RECENT">Mais recentes</option>
                  <option value="DIFFICULTY">Maior dificuldade</option>
                </select>
              </div>

              <div>
                <label
                  htmlFor="filter-resolution"
                  className="block text-[11px] font-medium text-muted mb-1"
                >
                  Situação de Resolução
                </label>
                <select
                  id="filter-resolution"
                  value={resolutionFilter}
                  onChange={(e) =>
                    setResolutionFilter(
                      e.target.value as QuestionFilterInput["resolutionFilter"]
                    )
                  }
                  className="w-full h-9 px-2.5 rounded-md bg-background border border-border text-xs text-foreground"
                >
                  <option value="ALL">Todas</option>
                  <option value="UNRESOLVED">Não resolvidas (Inéditas)</option>
                  <option value="RESOLVED">Já resolvidas</option>
                </select>
              </div>

              <div>
                <label
                  htmlFor="filter-accuracy"
                  className="block text-[11px] font-medium text-muted mb-1"
                >
                  Desempenho Anterior
                </label>
                <select
                  id="filter-accuracy"
                  value={accuracyFilter}
                  onChange={(e) =>
                    setAccuracyFilter(
                      e.target.value as QuestionFilterInput["accuracyFilter"]
                    )
                  }
                  className="w-full h-9 px-2.5 rounded-md bg-background border border-border text-xs text-foreground"
                >
                  <option value="ALL">Acertadas e erradas</option>
                  <option value="WRONG">Somente que errei</option>
                  <option value="CORRECT">Somente que acertei</option>
                </select>
              </div>

              <div>
                <label
                  htmlFor="filter-position"
                  className="block text-[11px] font-medium text-muted mb-1"
                >
                  Cargo / Exame
                </label>
                <select
                  id="filter-position"
                  value={positionId}
                  onChange={(e) => setPositionId(e.target.value)}
                  className="w-full h-9 px-2.5 rounded-md bg-background border border-border text-xs text-foreground"
                >
                  <option value="">Todos os cargos</option>
                  {catalog.positions.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label
                  htmlFor="filter-institution"
                  className="block text-[11px] font-medium text-muted mb-1"
                >
                  Instituição / Órgão
                </label>
                <select
                  id="filter-institution"
                  value={institutionId}
                  onChange={(e) => setInstitutionId(e.target.value)}
                  className="w-full h-9 px-2.5 rounded-md bg-background border border-border text-xs text-foreground"
                >
                  <option value="">Todas as instituições</option>
                  {catalog.institutions.map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.acronym} — {i.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-4 text-xs text-muted">
              <label className="inline-flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={onlyBookmarked}
                  onChange={(e) => setOnlyBookmarked(e.target.checked)}
                  className="rounded border-border"
                />
                <span>Somente favoritas</span>
              </label>
              <label className="inline-flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeAnnulled}
                  onChange={(e) => setIncludeAnnulled(e.target.checked)}
                  className="rounded border-border"
                />
                <span>Incluir questões anuladas</span>
              </label>
              <label className="inline-flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={onlyVerifiedExplanations}
                  onChange={(e) =>
                    setOnlyVerifiedExplanations(e.target.checked)
                  }
                  className="rounded border-border"
                />
                <span>Com comentário verificado</span>
              </label>
            </div>
          </div>
        )}
      </form>

      {/* Chips de Filtros Ativos + Limpar Todos */}
      {activeChips.length > 0 && (
        <div className="pt-3 border-t border-border flex flex-wrap items-center gap-2">
          {activeChips.map((chip) => (
            <button
              key={chip.key}
              type="button"
              onClick={chip.onRemove}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-brand-tint text-brand-accent border border-brand/20 text-[11px] font-medium hover:bg-brand/15 transition-colors"
            >
              <span>{chip.label}</span>
              <X className="w-3 h-3" />
            </button>
          ))}
          <button
            type="button"
            onClick={handleClearAll}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium text-muted hover:text-foreground transition-colors"
          >
            <RotateCcw className="w-3 h-3" />
            <span>Limpar todos</span>
          </button>
        </div>
      )}
    </Card>
  );
}
