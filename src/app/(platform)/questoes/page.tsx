import Link from "next/link";
import {
  BookOpenCheck,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
} from "lucide-react";
import { requireServerAuth } from "@/lib/auth/session";
import {
  buildQuestionFilterSearchParams,
  parseQuestionFiltersResilient,
} from "@/lib/validations/schemas";
import {
  getAcademicCatalogMetadata,
  getQuestionBankFilterFacets,
  searchPublishedQuestions,
} from "@/features/question-bank/service";
import { QuestionBankFilters } from "@/components/questions/question-bank-filters";
import { QuestionWorkspaceCard } from "@/components/questions/question-workspace";
import { Card } from "@/components/ui";

export default async function QuestionBankPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireServerAuth();
  const rawParams = await searchParams;

  const { filters, invalidFields } = parseQuestionFiltersResilient(rawParams);

  const [catalog, facets, searchResult] = await Promise.all([
    getAcademicCatalogMetadata(),
    getQuestionBankFilterFacets({
      includeAnnulled: filters.includeAnnulled,
    }),
    searchPublishedQuestions({
      userId: user.id,
      filters,
    }),
  ]);

  const totalPages = Math.max(
    1,
    Math.ceil(searchResult.totalCount / searchResult.pageSize)
  );
  const currentSearch = buildQuestionFilterSearchParams(filters).toString();
  const currentReturnUrl = currentSearch
    ? `/questoes?${currentSearch}`
    : "/questoes";

  const prevPageHref =
    searchResult.page > 1
      ? `/questoes?${buildQuestionFilterSearchParams(filters, searchResult.page - 1).toString()}`
      : null;
  const nextPageHref =
    searchResult.page < totalPages
      ? `/questoes?${buildQuestionFilterSearchParams(filters, searchResult.page + 1).toString()}`
      : null;

  const filterCatalog = {
    tracks: catalog.tracks.map((t) => ({ code: t.code, name: t.name })),
    boards: catalog.boards
      .filter((b): b is typeof b & { id: string } => "id" in b && typeof b.id === "string")
      .map((b) => ({ id: b.id, acronym: b.acronym, name: b.name })),
    positions: catalog.positions
      .filter((p): p is typeof p & { id: string } => "id" in p && typeof p.id === "string")
      .map((p) => ({ id: p.id, code: p.code, name: p.name })),
    institutions: catalog.institutions
      .filter((i): i is typeof i & { id: string } => "id" in i && typeof i.id === "string")
      .map((i) => ({ id: i.id, acronym: i.acronym, name: i.name })),
  };

  return (
    <div className="space-y-6">
      <QuestionBankFilters
        initialFilters={filters}
        catalog={filterCatalog}
        facets={facets}
        totalCount={searchResult.totalCount}
        invalidFields={invalidFields}
      />

      {searchResult.items.length === 0 ? (
        <Card className="p-8 sm:p-10 text-center space-y-4">
          <div className="w-12 h-12 rounded-full bg-surface-subtle text-brand-accent inline-flex items-center justify-center mx-auto">
            <BookOpenCheck className="w-6 h-6" />
          </div>
          <div className="max-w-lg mx-auto space-y-1.5">
            <h3 className="font-display text-base font-semibold text-foreground">
              Nenhuma questão publicada encontrada para esta combinação
            </h3>
            <p className="text-xs sm:text-sm text-muted leading-relaxed">
              {filters.trackCode &&
              (facets.countByTrack[filters.trackCode.toUpperCase()] ?? 0) === 0
                ? `Ainda não há questões publicadas para estudo na trilha ${filters.trackCode.toUpperCase()}. Você pode selecionar outra carreira com acervo publicado (como OAB ou PRF) ou limpar os filtros.`
                : "Os critérios selecionados não retornaram questões disponíveis. Tente remover um dos filtros ativos ou limpar todos os critérios."}
            </p>
          </div>
          <div className="pt-2 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/questoes"
              className="inline-flex items-center gap-2 h-9 px-4 rounded-md bg-brand hover:bg-brand-dark text-white text-xs font-medium transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Limpar todos os filtros</span>
            </Link>
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-2 h-9 px-4 rounded-md border border-border hover:border-border-strong text-xs font-medium text-foreground transition-colors"
            >
              <span>Voltar ao início</span>
            </Link>
          </div>
        </Card>
      ) : (
        <>
          <div className="space-y-6">
            {searchResult.items.map((item, idx) => (
              <QuestionWorkspaceCard
                key={item.id}
                question={item}
                indexLabel={`Questão ${(searchResult.page - 1) * searchResult.pageSize + idx + 1} (Nº Original #${item.originalNumber})`}
                returnTo={currentReturnUrl}
              />
            ))}
          </div>

          {/* Paginação preservando todos os filtros ativos na URL */}
          {totalPages > 1 && (
            <nav
              aria-label="Paginação de questões"
              className="flex items-center justify-between gap-3 pt-2"
            >
              <div className="text-xs text-muted tabular-nums-strict">
                Página <strong className="text-foreground">{searchResult.page}</strong> de{" "}
                <strong className="text-foreground">{totalPages}</strong> •{" "}
                {searchResult.totalCount} questões
              </div>
              <div className="flex items-center gap-2">
                {prevPageHref ? (
                  <Link
                    href={prevPageHref}
                    className="inline-flex items-center gap-1 h-9 px-3 rounded-md border border-border bg-surface hover:border-border-strong text-xs font-medium text-foreground transition-colors"
                  >
                    <ChevronLeft className="w-4 h-4" />
                    <span>Anterior</span>
                  </Link>
                ) : (
                  <span className="inline-flex items-center gap-1 h-9 px-3 rounded-md border border-border bg-disabled-bg text-disabled-text text-xs font-medium">
                    <ChevronLeft className="w-4 h-4" />
                    <span>Anterior</span>
                  </span>
                )}

                {nextPageHref ? (
                  <Link
                    href={nextPageHref}
                    className="inline-flex items-center gap-1 h-9 px-3 rounded-md border border-border bg-surface hover:border-border-strong text-xs font-medium text-foreground transition-colors"
                  >
                    <span>Próxima</span>
                    <ChevronRight className="w-4 h-4" />
                  </Link>
                ) : (
                  <span className="inline-flex items-center gap-1 h-9 px-3 rounded-md border border-border bg-disabled-bg text-disabled-text text-xs font-medium">
                    <span>Próxima</span>
                    <ChevronRight className="w-4 h-4" />
                  </span>
                )}
              </div>
            </nav>
          )}
        </>
      )}
    </div>
  );
}
