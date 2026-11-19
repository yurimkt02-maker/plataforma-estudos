import Link from "next/link";
import {
  Filter,
  Search,
  FileUp,
  BookOpenCheck,
  SlidersHorizontal,
} from "lucide-react";
import { requireServerAuth } from "@/lib/auth/session";
import { questionFilterSchema } from "@/lib/validations/schemas";
import {
  getAcademicCatalogMetadata,
  searchPublishedQuestions,
} from "@/features/question-bank/service";
import { QuestionWorkspaceCard } from "@/components/questions/question-workspace";

export default async function QuestionBankPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const user = await requireServerAuth();
  const rawParams = await searchParams;

  const parsedFilters = questionFilterSchema.safeParse({
    ...rawParams,
    trackCode: rawParams.trackCode || rawParams.track || undefined,
  });

  const filters = parsedFilters.success
    ? parsedFilters.data
    : questionFilterSchema.parse({});

  const [catalog, searchResult] = await Promise.all([
    getAcademicCatalogMetadata(),
    searchPublishedQuestions({
      userId: user.id,
      filters,
    }),
  ]);

  return (
    <div className="space-y-6">
      {/* Painel de Filtros Rápidos e Avançados (Referência funcional: Qconcursos, visual autoral limpo) */}
      <section className="bg-surface border border-border rounded-lg p-6 shadow-card">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 mb-5 border-b border-border">
          <div className="flex items-center gap-2.5">
            <Filter className="w-4 h-4 text-navy" />
            <h2 className="font-display text-sm font-semibold text-foreground">
              Banco de Questões Oficiais Verificadas
            </h2>
          </div>
          <span className="text-xs text-muted">
            {searchResult.totalCount} questão(ões) oficial(is) encontrada(s)
          </span>
        </div>

        <form method="GET" action="/questoes" className="space-y-4">
          {/* Pesquisa textual e filtros rápidos principais */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
            <div className="sm:col-span-2">
              <label
                htmlFor="filter-query"
                className="block text-[11px] font-medium text-muted mb-1"
              >
                Pesquisa textual (PostgreSQL Full Text Search)
              </label>
              <div className="relative">
                <Search className="w-4 h-4 text-muted absolute left-3 top-2.5" />
                <input
                  id="filter-query"
                  name="query"
                  type="search"
                  defaultValue={filters.query ?? ""}
                  placeholder="Buscar por palavras-chave, súmula, artigo ou instituto..."
                  className="w-full h-9 pl-9 pr-3 rounded-md bg-background border border-border text-xs text-foreground focus:outline-none focus:border-petrol"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="filter-track"
                className="block text-[11px] font-medium text-muted mb-1"
              >
                Carreira / Concurso
              </label>
              <select
                id="filter-track"
                name="trackCode"
                defaultValue={filters.trackCode ?? ""}
                className="w-full h-9 px-3 rounded-md bg-background border border-border text-xs text-foreground"
              >
                <option value="">Todas as carreiras (TJSP, PCSP, PRF, OAB)</option>
                {catalog.tracks.map((t) => (
                  <option key={t.code} value={t.code}>
                    {t.code} — {t.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="filter-type"
                className="block text-[11px] font-medium text-muted mb-1"
              >
                Modalidade da Questão
              </label>
              <select
                id="filter-type"
                name="questionType"
                defaultValue={filters.questionType ?? ""}
                className="w-full h-9 px-3 rounded-md bg-background border border-border text-xs text-foreground"
              >
                <option value="">Todas (Múltipla Escolha &amp; Certo/Errado)</option>
                <option value="MULTIPLE_CHOICE">Múltipla Escolha (A–E / A–D)</option>
                <option value="TRUE_FALSE">Certo / Errado (Cebraspe)</option>
              </select>
            </div>
          </div>

          {/* Segunda linha de filtros: Disciplina, Banca, Cargo, Ano e Modalidade */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 pt-1">
            <div>
              <label
                htmlFor="filter-subject"
                className="block text-[11px] font-medium text-muted mb-1"
              >
                Disciplina / Assunto (Cross-carreira)
              </label>
              <select
                id="filter-subject"
                name="subjectId"
                defaultValue={filters.subjectId ?? ""}
                className="w-full h-9 px-3 rounded-md bg-background border border-border text-xs text-foreground"
              >
                <option value="">Todas as disciplinas e assuntos</option>
                {catalog.subjects.map((subj) => (
                  <optgroup key={subj.slug} label={subj.name}>
                    {"id" in subj && (
                      <option value={subj.id as string}>
                        {subj.name} (Geral)
                      </option>
                    )}
                    {subj.children?.map((child) =>
                      "id" in child ? (
                        <option key={child.slug} value={child.id as string}>
                          └ {child.name}
                        </option>
                      ) : null
                    )}
                  </optgroup>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="filter-board"
                className="block text-[11px] font-medium text-muted mb-1"
              >
                Banca Organizadora
              </label>
              <select
                id="filter-board"
                name="examBoardId"
                defaultValue={filters.examBoardId ?? ""}
                className="w-full h-9 px-3 rounded-md bg-background border border-border text-xs text-foreground"
              >
                <option value="">Todas as bancas (Vunesp, Cebraspe, FGV)</option>
                {catalog.boards.map((b) =>
                  "id" in b ? (
                    <option key={b.acronym} value={b.id as string}>
                      {b.acronym} — {b.name}
                    </option>
                  ) : null
                )}
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
                name="positionId"
                defaultValue={filters.positionId ?? ""}
                className="w-full h-9 px-3 rounded-md bg-background border border-border text-xs text-foreground"
              >
                <option value="">Todos os cargos</option>
                {catalog.positions.map((p) =>
                  "id" in p ? (
                    <option key={p.code} value={p.id as string}>
                      {p.name}
                    </option>
                  ) : null
                )}
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
                name="institutionId"
                defaultValue={filters.institutionId ?? ""}
                className="w-full h-9 px-3 rounded-md bg-background border border-border text-xs text-foreground"
              >
                <option value="">Todas as instituições</option>
                {catalog.institutions.map((inst) =>
                  "id" in inst ? (
                    <option key={inst.acronym} value={inst.id as string}>
                      {inst.acronym} — {inst.name}
                    </option>
                  ) : null
                )}
              </select>
            </div>
          </div>

          {/* Terceira linha de filtros: Resolução, Acurácia, Dificuldade, Ano e Ordenação */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5 pt-1">
            <div>
              <label
                htmlFor="filter-resolution"
                className="block text-[11px] font-medium text-muted mb-1"
              >
                Situação de Resolução
              </label>
              <select
                id="filter-resolution"
                name="resolutionFilter"
                defaultValue={filters.resolutionFilter}
                className="w-full h-9 px-3 rounded-md bg-background border border-border text-xs text-foreground"
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
                name="accuracyFilter"
                defaultValue={filters.accuracyFilter}
                className="w-full h-9 px-3 rounded-md bg-background border border-border text-xs text-foreground"
              >
                <option value="ALL">Acertadas e Erradas</option>
                <option value="WRONG">Somente questões que errei</option>
                <option value="CORRECT">Somente questões que acertei</option>
              </select>
            </div>

            <div>
              <label
                htmlFor="filter-difficulty"
                className="block text-[11px] font-medium text-muted mb-1"
              >
                Dificuldade Estimada
              </label>
              <select
                id="filter-difficulty"
                name="difficulty"
                defaultValue={filters.difficulty ?? ""}
                className="w-full h-9 px-3 rounded-md bg-background border border-border text-xs text-foreground"
              >
                <option value="">Qualquer dificuldade</option>
                <option value="EASY">Fácil</option>
                <option value="MEDIUM">Média</option>
                <option value="HARD">Difícil</option>
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
                name="year"
                defaultValue={filters.year ? String(filters.year) : ""}
                className="w-full h-9 px-3 rounded-md bg-background border border-border text-xs text-foreground"
              >
                <option value="">Todos os anos</option>
                <option value="2025">2025</option>
                <option value="2024">2024</option>
                <option value="2023">2023</option>
                <option value="2022">2022</option>
                <option value="2021">2021</option>
              </select>
            </div>

            <div>
              <label
                htmlFor="filter-sort"
                className="block text-[11px] font-medium text-muted mb-1"
              >
                Ordenar por
              </label>
              <select
                id="filter-sort"
                name="sortBy"
                defaultValue={filters.sortBy}
                className="w-full h-9 px-3 rounded-md bg-background border border-border text-xs text-foreground"
              >
                <option value="ORIGINAL_NUMBER">Número original da prova</option>
                <option value="RECENT">Mais recentes</option>
                <option value="DIFFICULTY">Maior dificuldade</option>
                <option value="REVIEW_PRIORITY">Prioridade de revisão</option>
              </select>
            </div>
          </div>

          {/* Checkboxes de filtros avançados */}
          <div className="pt-3 border-t border-border flex flex-wrap items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-4 text-xs text-muted">
              <span className="inline-flex items-center gap-1.5 font-medium text-foreground">
                <SlidersHorizontal className="w-3.5 h-3.5 text-petrol" />
                Critérios adicionais:
              </span>
              <label className="inline-flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  name="onlyVerifiedExplanations"
                  value="true"
                  defaultChecked={filters.onlyVerifiedExplanations}
                  className="rounded border-border"
                />
                <span>Com comentário jurídico verificado</span>
              </label>
              <label className="inline-flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  name="onlyBookmarked"
                  value="true"
                  defaultChecked={filters.onlyBookmarked}
                  className="rounded border-border"
                />
                <span>Somente favoritas</span>
              </label>
              <label className="inline-flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  name="includeAnnulled"
                  value="true"
                  defaultChecked={filters.includeAnnulled}
                  className="rounded border-border"
                />
                <span>Incluir anuladas</span>
              </label>
            </div>

            <div className="flex items-center gap-2">
              <Link
                href="/questoes"
                className="h-9 px-3.5 inline-flex items-center justify-center rounded-md border border-border text-xs font-medium text-muted hover:text-foreground"
              >
                Limpar filtros
              </Link>
              <button
                type="submit"
                className="h-9 px-5 inline-flex items-center justify-center rounded-md bg-navy hover:bg-navy-light text-white text-xs font-medium transition-colors"
              >
                Aplicar filtros
              </button>
            </div>
          </div>
        </form>
      </section>

      {/* Lista de Questões ou Estado Vazio Autêntico */}
      {searchResult.items.length === 0 ? (
        <section className="bg-surface border border-border rounded-lg p-10 text-center space-y-4 shadow-subtle">
          <div className="w-12 h-12 rounded-full bg-surface-subtle text-navy inline-flex items-center justify-center mx-auto">
            <BookOpenCheck className="w-6 h-6" />
          </div>
          <div className="max-w-lg mx-auto space-y-1.5">
            <h3 className="font-display text-base font-semibold text-foreground">
              Nenhuma questão oficial publicada corresponde aos filtros atuais
            </h3>
            <p className="text-xs text-muted leading-relaxed">
              Seguindo a diretriz de integridade documental (Seção 1.3 e 17), o
              sistema jamais popula o banco com questões fictícias inventadas
              por IA. Para estudar questões reais verificadas do TJSP, PCSP, PRF
              ou OAB, importe e aprove o PDF oficial da prova e seu gabarito
              definitivo no painel de curadoria.
            </p>
          </div>
          <div className="pt-2 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/admin/importacoes"
              className="inline-flex items-center gap-2 h-9 px-4 rounded-md bg-navy hover:bg-navy-light text-white text-xs font-medium transition-colors"
            >
              <FileUp className="w-4 h-4" />
              <span>Importar prova oficial (PDF + Gabarito)</span>
            </Link>
            <Link
              href="/fontes"
              className="inline-flex items-center gap-2 h-9 px-4 rounded-md border border-border hover:border-petrol text-xs font-medium text-foreground transition-colors"
            >
              <span>Ver catálogo de provas e fontes oficiais</span>
            </Link>
          </div>
        </section>
      ) : (
        <div className="space-y-6">
          {searchResult.items.map((item, idx) => (
            <QuestionWorkspaceCard
              key={item.id}
              question={item}
              indexLabel={`Questão ${(searchResult.page - 1) * searchResult.pageSize + idx + 1} (Nº Original #${item.originalNumber})`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
