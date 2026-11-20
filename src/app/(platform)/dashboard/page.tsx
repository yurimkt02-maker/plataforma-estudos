import Link from "next/link";
import {
  ArrowRight,
  BookOpenCheck,
  CheckCircle2,
  Clock,
  RotateCcw,
  Timer,
  AlertCircle,
  Bookmark,
  FolderKanban,
  Play,
} from "lucide-react";
import { requireServerAuth } from "@/lib/auth/session";
import { getDashboardOverview } from "@/features/question-bank/service";
import { Badge, Card, ProgressBar } from "@/components/ui";
import { cn } from "@/lib/utils/cn";

function formatStudyDuration(totalSeconds: number): string {
  if (totalSeconds <= 0) return "0h 00m";
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  return `${hours}h ${String(minutes).padStart(2, "0")}m`;
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ track?: string }>;
}) {
  const user = await requireServerAuth();
  const resolvedParams = await searchParams;
  const activeTrackCode =
    resolvedParams.track?.toUpperCase() || user.activeTrackCode || "TJSP";

  const overview = await getDashboardOverview({
    userId: user.id,
    trackCode: activeTrackCode,
  });

  const firstName = user.name.split(" ")[0] || user.name;
  const dailyPercent =
    overview.dailyGoalQuestions > 0
      ? Math.min(
          100,
          Math.round(
            (overview.todayAnsweredCount / overview.dailyGoalQuestions) * 100
          )
        )
      : 0;

  return (
    <div className="space-y-5 sm:space-y-6">
      {/* 1. Card Principal — Continuar de Onde Parei (Único Degradê Seletivo da Tela) */}
      <Card
        variant="brand-hero"
        className="p-5 sm:p-6 lg:p-7 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-5"
      >
        <div className="space-y-2 max-w-2xl min-w-0">
          <div className="flex flex-wrap items-center gap-2 text-[11px] font-medium text-white/80">
            <span className="px-2 py-0.5 rounded-full bg-white/15 text-white">
              {activeTrackCode}
            </span>
            <span>Olá, {firstName}</span>
            {overview.resumeTarget.kind !== "NEW_SESSION" && (
              <>
                <span aria-hidden="true">•</span>
                <span>Sessão anterior disponível</span>
              </>
            )}
          </div>

          <h2 className="font-display text-xl sm:text-2xl font-semibold tracking-tight text-white leading-snug">
            {overview.resumeTarget.label}
          </h2>

          <p className="text-xs sm:text-sm text-white/80 leading-relaxed truncate sm:whitespace-normal">
            <strong className="font-medium text-white">
              {overview.resumeTarget.contextTitle}
            </strong>
            {" — "}
            {overview.resumeTarget.contextSubtitle}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <Link
            href={overview.resumeTarget.href}
            className="inline-flex items-center justify-center gap-2 h-10 px-4 sm:px-5 rounded-md bg-white text-[#2C2152] hover:bg-[#FAF8F5] text-xs sm:text-sm font-semibold transition-colors shadow-subtle flex-1 sm:flex-none"
          >
            <Play className="w-3.5 h-3.5 fill-current shrink-0" />
            <span>{overview.resumeTarget.shortLabel}</span>
          </Link>
          <Link
            href={`/simulados?track=${activeTrackCode}`}
            className="inline-flex items-center justify-center gap-1.5 h-10 px-4 rounded-md bg-white/10 hover:bg-white/20 border border-white/20 text-white text-xs sm:text-sm font-medium transition-colors flex-1 sm:flex-none"
          >
            <Timer className="w-3.5 h-3.5 shrink-0" />
            <span>Novo simulado</span>
          </Link>
        </div>
      </Card>

      {/* 2. Prioridade Mobile & Desktop: Revisões Pendentes + Meta Diária */}
      <section
        aria-label="Revisões e meta diária"
        className="grid grid-cols-1 lg:grid-cols-12 gap-4"
      >
        {/* Revisões Pendentes (2º bloco no mobile para ação imediata) */}
        <Card className="lg:col-span-5 p-4 sm:p-5 flex items-center justify-between gap-4">
          <div className="space-y-1 min-w-0">
            <div className="flex items-center gap-2">
              <RotateCcw className="w-4 h-4 text-brand-accent shrink-0" />
              <span className="text-xs font-semibold text-foreground">
                Revisões pendentes
              </span>
              {overview.pendingReviewsCount > 0 && (
                <Badge variant="warning">Hoje</Badge>
              )}
            </div>
            <p className="text-xs text-muted">
              {overview.pendingReviewsCount > 0 ? (
                <>
                  <strong className="text-foreground tabular-nums-strict">
                    {overview.pendingReviewsCount}
                  </strong>{" "}
                  {overview.pendingReviewsCount === 1
                    ? "questão aguardando revisão espaçada"
                    : "questões aguardando revisão espaçada"}
                </>
              ) : (
                "Fila de revisão espaçada em dia."
              )}
            </p>
          </div>

          <Link
            href={`/revisoes?track=${activeTrackCode}`}
            className={cn(
              "shrink-0 inline-flex items-center gap-1 h-9 px-3 rounded-md text-xs font-medium transition-colors",
              overview.pendingReviewsCount > 0
                ? "bg-brand text-white hover:bg-brand-dark"
                : "bg-surface-subtle text-foreground hover:bg-border/60"
            )}
          >
            <span>{overview.pendingReviewsCount > 0 ? "Revisar" : "Ver fila"}</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </Card>

        {/* Meta Diária Real (UserSettings.dailyGoalQuestions vs tentativas de hoje) */}
        <Card className="lg:col-span-7 p-4 sm:p-5 flex flex-col justify-center gap-2.5">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-xs font-semibold text-foreground">
                Meta diária
              </span>
              <span className="text-xs text-muted tabular-nums-strict">
                {overview.todayAnsweredCount} / {overview.dailyGoalQuestions}{" "}
                questões hoje
              </span>
            </div>
            <span className="text-xs font-semibold text-brand-accent tabular-nums-strict shrink-0">
              {dailyPercent}%
            </span>
          </div>
          <ProgressBar
            value={overview.todayAnsweredCount}
            max={overview.dailyGoalQuestions}
            size="md"
            tone={dailyPercent >= 100 ? "success" : "brand"}
          />
          <p className="text-[11px] text-muted">
            {overview.todayAnsweredCount === 0
              ? "Resolva sua primeira questão hoje para iniciar o progresso diário."
              : dailyPercent >= 100
                ? "Meta diária atingida hoje. Excelente constância."
                : `Faltam ${Math.max(0, overview.dailyGoalQuestions - overview.todayAnsweredCount)} questões para concluir a meta de hoje.`}
          </p>
        </Card>
      </section>

      {/* 3. Indicadores Essenciais (2x2 mobile / 4-col desktop — 100% dados reais) */}
      <section
        aria-label="Indicadores essenciais"
        className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4"
      >
        <Card className="p-4 sm:p-5">
          <div className="flex items-center justify-between text-muted mb-2">
            <span className="text-[11px] sm:text-xs font-medium truncate">
              Resolvidas ({activeTrackCode})
            </span>
            <BookOpenCheck className="w-4 h-4 text-brand-accent shrink-0" />
          </div>
          <div className="font-display text-xl sm:text-2xl font-semibold text-foreground tabular-nums-strict">
            {overview.metrics.uniqueQuestionsAttempted}
          </div>
          <p className="text-[11px] text-muted mt-1 truncate">
            {overview.metrics.totalAttempts} tentativas •{" "}
            {overview.unresolvedQuestionsCount} inéditas
          </p>
        </Card>

        <Card className="p-4 sm:p-5">
          <div className="flex items-center justify-between text-muted mb-2">
            <span className="text-[11px] sm:text-xs font-medium truncate">
              1ª Tentativa
            </span>
            <CheckCircle2 className="w-4 h-4 text-semantic-success shrink-0" />
          </div>
          <div className="font-display text-xl sm:text-2xl font-semibold text-foreground tabular-nums-strict">
            {overview.metrics.totalAttempts > 0
              ? `${overview.metrics.firstTryAccuracyRate.toFixed(1)}%`
              : "—"}
          </div>
          <p className="text-[11px] text-muted mt-1 truncate">
            {overview.metrics.totalAttempts > 0
              ? `Geral: ${overview.metrics.overallAttemptAccuracy.toFixed(1)}%`
              : "Sem tentativas nesta trilha"}
          </p>
        </Card>

        <Card className="p-4 sm:p-5">
          <div className="flex items-center justify-between text-muted mb-2">
            <span className="text-[11px] sm:text-xs font-medium truncate">
              Caderno de Erros
            </span>
            <AlertCircle className="w-4 h-4 text-semantic-error shrink-0" />
          </div>
          <div className="font-display text-xl sm:text-2xl font-semibold text-foreground tabular-nums-strict">
            {overview.errorNotebookCount}
          </div>
          <p className="text-[11px] text-muted mt-1 truncate">
            <Link
              href={`/cadernos?track=${activeTrackCode}`}
              className="text-brand-accent hover:underline font-medium"
            >
              {overview.errorNotebookCount > 0
                ? "Refazer erros →"
                : "Abrir cadernos →"}
            </Link>
          </p>
        </Card>

        <Card className="p-4 sm:p-5">
          <div className="flex items-center justify-between text-muted mb-2">
            <span className="text-[11px] sm:text-xs font-medium truncate">
              Tempo Acumulado
            </span>
            <Clock className="w-4 h-4 text-subtle shrink-0" />
          </div>
          <div className="font-display text-xl sm:text-2xl font-semibold text-foreground tabular-nums-strict">
            {formatStudyDuration(overview.metrics.totalTimeSpentSeconds)}
          </div>
          <p className="text-[11px] text-muted mt-1 truncate">
            {overview.metrics.averageTimePerAttemptSeconds > 0
              ? `Média de ${overview.metrics.averageTimePerAttemptSeconds}s/questão`
              : "Tempo cronometrado"}
          </p>
        </Card>
      </section>

      {/* 4. Grade Assimétrica 65/35 — Disciplinas + Concursos | Simulados + Erros */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Coluna Principal (8/12) */}
        <div className="lg:col-span-8 space-y-5">
          {/* Desempenho por Disciplina */}
          <Card className="p-5 sm:p-6">
            <div className="flex items-center justify-between gap-2 pb-3.5 mb-4 border-b border-border">
              <div>
                <h3 className="font-display text-sm font-semibold text-foreground">
                  Desempenho por disciplina ({activeTrackCode})
                </h3>
                <p className="text-xs text-muted mt-0.5">
                  Aproveitamento real com base nas suas respostas registradas
                </p>
              </div>
              <Link
                href={`/estatisticas?track=${activeTrackCode}`}
                className="text-xs font-medium text-brand-accent hover:underline shrink-0"
              >
                Ver estatísticas
              </Link>
            </div>

            {overview.subjectBreakdown.length > 0 ? (
              <div className="space-y-4">
                {overview.subjectBreakdown.slice(0, 6).map((subj) => (
                  <div key={subj.subjectId} className="space-y-1.5">
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <span className="font-medium text-foreground truncate">
                        {subj.subjectName}
                      </span>
                      <span className="text-muted shrink-0 tabular-nums-strict">
                        {subj.attempts} resp. •{" "}
                        <strong
                          className={cn(
                            "font-semibold",
                            subj.accuracy >= 70
                              ? "text-semantic-success"
                              : subj.accuracy >= 50
                                ? "text-semantic-warning"
                                : "text-semantic-error"
                          )}
                        >
                          {subj.accuracy}%
                        </strong>
                      </span>
                    </div>
                    <ProgressBar
                      value={subj.accuracy}
                      max={100}
                      size="sm"
                      tone={
                        subj.accuracy >= 70
                          ? "success"
                          : subj.accuracy >= 50
                            ? "warning"
                            : "error"
                      }
                    />
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-6 text-center space-y-3">
                <p className="text-xs sm:text-sm text-muted">
                  Ainda não há respostas registradas na trilha{" "}
                  <strong className="text-foreground">{activeTrackCode}</strong>.
                </p>
                <Link
                  href={`/questoes?track=${activeTrackCode}`}
                  className="inline-flex items-center gap-1.5 h-9 px-4 rounded-md bg-brand text-white hover:bg-brand-dark text-xs font-medium transition-colors"
                >
                  <span>Iniciar questões de {activeTrackCode}</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            )}
          </Card>

          {/* Progresso por Concurso (Substitui os 4 cards grandes redundantes) */}
          <Card className="p-5 sm:p-6">
            <div className="flex items-center justify-between gap-2 pb-3.5 mb-4 border-b border-border">
              <div>
                <h3 className="font-display text-sm font-semibold text-foreground">
                  Progresso por concurso
                </h3>
                <p className="text-xs text-muted mt-0.5">
                  Selecione uma trilha para filtrar seus indicadores
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {overview.trackProgress.map((tp) => {
                const isSelected = tp.code === activeTrackCode;
                const pct =
                  tp.publishedCount > 0
                    ? Math.round((tp.attemptedCount / tp.publishedCount) * 100)
                    : 0;
                return (
                  <Link
                    key={tp.code}
                    href={`/dashboard?track=${tp.code}`}
                    className={cn(
                      "p-3.5 rounded-lg border transition-colors space-y-2.5",
                      isSelected
                        ? "bg-brand-tint/60 border-brand"
                        : "bg-background/60 border-border hover:border-border-strong"
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-display text-sm font-semibold text-foreground">
                            {tp.code}
                          </span>
                          {isSelected && <Badge variant="brand">Ativa</Badge>}
                        </div>
                        <p className="text-[11px] text-muted truncate mt-0.5">
                          {tp.targetRole}
                        </p>
                      </div>
                      <span className="text-xs font-semibold text-foreground tabular-nums-strict shrink-0">
                        {tp.publishedCount > 0 ? `${pct}%` : "—"}
                      </span>
                    </div>

                    <ProgressBar
                      value={tp.attemptedCount}
                      max={Math.max(tp.publishedCount, 1)}
                      size="sm"
                      tone="brand"
                    />

                    <div className="flex items-center justify-between text-[11px] text-muted tabular-nums-strict">
                      <span>{tp.attemptedCount} resolvidas</span>
                      <span>
                        {tp.publishedCount > 0
                          ? `${tp.publishedCount} no acervo`
                          : "Em preparação"}
                      </span>
                    </div>
                  </Link>
                );
              })}
            </div>
          </Card>
        </div>

        {/* Coluna Lateral (4/12) */}
        <div className="lg:col-span-4 space-y-5">
          {/* Simulados Recentes */}
          <Card className="p-5">
            <div className="flex items-center justify-between gap-2 pb-3 mb-3.5 border-b border-border">
              <div className="flex items-center gap-2">
                <Timer className="w-4 h-4 text-brand-accent" />
                <h3 className="font-display text-sm font-semibold text-foreground">
                  Simulados recentes
                </h3>
              </div>
              <Link
                href={`/simulados?track=${activeTrackCode}`}
                className="text-xs font-medium text-brand-accent hover:underline"
              >
                Todos
              </Link>
            </div>

            {overview.recentSimulations.length > 0 ? (
              <div className="space-y-2.5">
                {overview.recentSimulations.slice(0, 3).map((sim) => {
                  const isInProgress = sim.status === "IN_PROGRESS";
                  const href = isInProgress
                    ? `/simulados/${sim.simulationId}?attemptId=${sim.id}`
                    : `/simulados/${sim.simulationId}/resultado?attemptId=${sim.id}`;
                  return (
                    <Link
                      key={sim.id}
                      href={href}
                      className="block p-3 rounded-md bg-background/70 border border-border hover:border-border-strong transition-colors space-y-1.5"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className="text-xs font-medium text-foreground line-clamp-1">
                          {sim.title}
                        </span>
                        <Badge
                          variant={isInProgress ? "brand" : "neutral"}
                          className="shrink-0"
                        >
                          {isInProgress
                            ? "Em andamento"
                            : `${sim.percentageScore.toFixed(0)}%`}
                        </Badge>
                      </div>
                      <div className="flex items-center justify-between text-[11px] text-muted tabular-nums-strict">
                        <span>
                          {isInProgress
                            ? "Clique para retomar"
                            : `Nota líquida: ${sim.netScore} / ${sim.maxScore}`}
                        </span>
                        <ArrowRight className="w-3 h-3 text-subtle" />
                      </div>
                    </Link>
                  );
                })}
              </div>
            ) : (
              <div className="py-4 text-center space-y-3">
                <p className="text-xs text-muted">
                  Nenhum simulado realizado ainda.
                </p>
                <Link
                  href={`/simulados?track=${activeTrackCode}`}
                  className="inline-flex items-center justify-center gap-1.5 w-full h-9 px-3 rounded-md bg-surface-subtle hover:bg-border/60 text-xs font-medium text-foreground transition-colors"
                >
                  <span>Montar primeiro simulado</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            )}
          </Card>

          {/* Caderno de Erros & Atalhos de Sessão */}
          <Card className="p-5 space-y-4">
            <div className="flex items-center justify-between gap-2 pb-3 border-b border-border">
              <div className="flex items-center gap-2">
                <FolderKanban className="w-4 h-4 text-brand-accent" />
                <h3 className="font-display text-sm font-semibold text-foreground">
                  Atalhos de estudo
                </h3>
              </div>
            </div>

            <div className="space-y-2">
              <Link
                href={`/cadernos?track=${activeTrackCode}`}
                className="flex items-center justify-between p-3 rounded-md bg-background/70 border border-border hover:border-border-strong transition-colors"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <AlertCircle className="w-4 h-4 text-semantic-error shrink-0" />
                  <div className="min-w-0">
                    <span className="text-xs font-medium text-foreground block">
                      Caderno de erros
                    </span>
                    <span className="text-[11px] text-muted block truncate">
                      {overview.errorNotebookCount > 0
                        ? `${overview.errorNotebookCount} questões para recuperar`
                        : "Nenhum erro pendente"}
                    </span>
                  </div>
                </div>
                <ArrowRight className="w-3.5 h-3.5 text-subtle shrink-0" />
              </Link>

              <Link
                href={`/questoes?track=${activeTrackCode}&onlyBookmarked=true`}
                className="flex items-center justify-between p-3 rounded-md bg-background/70 border border-border hover:border-border-strong transition-colors"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <Bookmark className="w-4 h-4 text-brand-accent shrink-0" />
                  <div className="min-w-0">
                    <span className="text-xs font-medium text-foreground block">
                      Questões favoritas
                    </span>
                    <span className="text-[11px] text-muted block truncate">
                      Acessar itens salvos para revisão
                    </span>
                  </div>
                </div>
                <ArrowRight className="w-3.5 h-3.5 text-subtle shrink-0" />
              </Link>

              <Link
                href={`/questoes?track=${activeTrackCode}`}
                className="flex items-center justify-between p-3 rounded-md bg-background/70 border border-border hover:border-border-strong transition-colors"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <BookOpenCheck className="w-4 h-4 text-brand-accent shrink-0" />
                  <div className="min-w-0">
                    <span className="text-xs font-medium text-foreground block">
                      Banco de questões
                    </span>
                    <span className="text-[11px] text-muted block truncate">
                      Filtrar por banca, ano e disciplina
                    </span>
                  </div>
                </div>
                <ArrowRight className="w-3.5 h-3.5 text-subtle shrink-0" />
              </Link>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
