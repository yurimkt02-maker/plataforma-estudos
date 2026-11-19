import Link from "next/link";
import {
  ArrowRight,
  BookOpenCheck,
  CheckCircle2,
  Clock,
  RotateCcw,
  Timer,
  AlertTriangle,
  Database,
  Scale,
  FileUp,
} from "lucide-react";
import { requireServerAuth } from "@/lib/auth/session";
import { getDashboardOverview } from "@/features/question-bank/service";
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

  const activeTrackInfo =
    overview.tracks.find((t) => t.code === activeTrackCode) ??
    overview.tracks[0];

  return (
    <div className="space-y-8">
      {/* Banner de diagnóstico caso o banco Prisma Postgres aguarde credenciais */}
      {!overview.dbConnected && (
        <div className="p-4 rounded-lg bg-semantic-warning-bg border border-semantic-warning/30 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <Database className="w-5 h-5 text-semantic-warning shrink-0 mt-0.5" />
            <div>
              <h2 className="font-display text-xs font-semibold text-foreground">
                Conexão com Prisma Postgres aguardando credenciais (.env.local)
              </h2>
              <p className="text-xs text-muted mt-0.5 leading-relaxed">
                O schema Prisma (34 modelos), as migrations SQL e o motor de
                correção estão prontos. Configure{" "}
                <code className="px-1 py-0.5 rounded bg-surface font-mono text-foreground">
                  DATABASE_URL_POOLED
                </code>{" "}
                e{" "}
                <code className="px-1 py-0.5 rounded bg-surface font-mono text-foreground">
                  DIRECT_URL
                </code>{" "}
                e execute{" "}
                <code className="px-1 py-0.5 rounded bg-surface font-mono text-foreground">
                  npm run db:migrate:deploy &amp;&amp; npm run db:seed
                </code>{" "}
                para persistir suas sessões.
              </p>
            </div>
          </div>
          <Link
            href="/configuracoes"
            className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-surface border border-border text-xs font-medium text-foreground hover:border-petrol transition-colors"
          >
            <span>Ver diagnóstico</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      )}

      {/* Cabeçalho Editorial */}
      <section className="bg-surface border border-border rounded-lg p-6 sm:p-7 shadow-card flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
        <div className="space-y-2 max-w-2xl">
          <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-md bg-surface-subtle text-navy text-xs font-medium">
            <span>Trilha Ativa: {activeTrackInfo?.code}</span>
            <span>•</span>
            <span>{activeTrackInfo?.targetRole}</span>
          </div>
          <h2 className="font-display text-2xl sm:text-3xl font-semibold text-foreground tracking-tight">
            Seu próximo avanço começa aqui.
          </h2>
          <p className="text-sm text-muted leading-relaxed">
            {activeTrackInfo?.description ||
              "Resolva questões oficiais verificadas, acompanhe sua taxa de acerto na primeira tentativa e revise seus pontos críticos com fundamentação jurídica."}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 shrink-0">
          <Link
            href={`/questoes?track=${activeTrackCode}`}
            className="inline-flex items-center gap-2 h-10 px-5 rounded-md bg-navy hover:bg-navy-light text-white text-xs font-medium transition-colors shadow-subtle"
          >
            <span>Continuar estudando</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
          <Link
            href={`/simulados?track=${activeTrackCode}`}
            className="inline-flex items-center gap-2 h-10 px-4 rounded-md bg-surface border border-border hover:border-petrol text-foreground text-xs font-medium transition-colors"
          >
            <Timer className="w-4 h-4 text-petrol" />
            <span>Novo simulado</span>
          </Link>
        </div>
      </section>

      {/* Seletor Rápido das 4 Carreiras Prioritárias */}
      <section aria-label="Seleção rápida de carreira">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-display text-xs font-semibold uppercase tracking-wider text-muted">
            Carreiras Prioritárias
          </h3>
          <span className="text-xs text-muted">
            Estatísticas filtradas por área selecionada
          </span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
          {overview.tracks.map((track) => {
            const isSelected = track.code === activeTrackCode;
            return (
              <Link
                key={track.code}
                href={`/dashboard?track=${track.code}`}
                className={cn(
                  "p-4 rounded-lg border transition-all flex flex-col justify-between",
                  isSelected
                    ? "bg-surface border-navy ring-1 ring-navy shadow-card"
                    : "bg-surface border-border hover:border-petrol/60"
                )}
              >
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-display text-sm font-semibold text-foreground">
                      {track.code}
                    </span>
                    {isSelected && (
                      <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-navy text-white">
                        Selecionado
                      </span>
                    )}
                  </div>
                  <p className="text-xs font-medium text-foreground mt-1">
                    {track.name}
                  </p>
                </div>
                <p className="text-[11px] text-muted mt-2.5 pt-2.5 border-t border-border truncate">
                  {track.targetRole}
                </p>
              </Link>
            );
          })}
        </div>
      </section>

      {/* Indicadores Essenciais (Dados Reais, sem números fictícios) */}
      <section
        aria-label="Indicadores de desempenho"
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4"
      >
        <div className="bg-surface border border-border rounded-lg p-5 shadow-subtle">
          <div className="flex items-center justify-between text-muted mb-3">
            <span className="text-xs font-medium">Questões Resolvidas</span>
            <BookOpenCheck className="w-4 h-4 text-navy" />
          </div>
          <div className="font-display text-2xl font-semibold text-foreground">
            {overview.metrics.uniqueQuestionsAttempted}
          </div>
          <p className="text-[11px] text-muted mt-1.5">
            {overview.metrics.totalAttempts} tentativas totais •{" "}
            {overview.unresolvedQuestionsCount} inéditas no acervo
          </p>
        </div>

        <div className="bg-surface border border-border rounded-lg p-5 shadow-subtle">
          <div className="flex items-center justify-between text-muted mb-3">
            <span className="text-xs font-medium">Taxa de Acertos (1ª Tentativa)</span>
            <CheckCircle2 className="w-4 h-4 text-semantic-success" />
          </div>
          <div className="font-display text-2xl font-semibold text-foreground">
            {overview.metrics.firstTryAccuracyRate.toFixed(1)}%
          </div>
          <p className="text-[11px] text-muted mt-1.5">
            Acurácia geral: {overview.metrics.overallAttemptAccuracy.toFixed(1)}% •{" "}
            Recuperação: {overview.metrics.errorRecoveryRate.toFixed(1)}%
          </p>
        </div>

        <div className="bg-surface border border-border rounded-lg p-5 shadow-subtle">
          <div className="flex items-center justify-between text-muted mb-3">
            <span className="text-xs font-medium">Tempo Acumulado</span>
            <Clock className="w-4 h-4 text-petrol" />
          </div>
          <div className="font-display text-2xl font-semibold text-foreground">
            {formatStudyDuration(overview.metrics.totalTimeSpentSeconds)}
          </div>
          <p className="text-[11px] text-muted mt-1.5">
            Média de {overview.metrics.averageTimePerAttemptSeconds}s por questão
          </p>
        </div>

        <div className="bg-surface border border-border rounded-lg p-5 shadow-subtle">
          <div className="flex items-center justify-between text-muted mb-3">
            <span className="text-xs font-medium">Revisões Pendentes</span>
            <RotateCcw className="w-4 h-4 text-semantic-warning" />
          </div>
          <div className="font-display text-2xl font-semibold text-foreground">
            {overview.pendingReviewsCount}
          </div>
          <p className="text-[11px] text-muted mt-1.5">
            <Link
              href={`/revisoes?track=${activeTrackCode}`}
              className="text-petrol hover:underline font-medium"
            >
              Abrir fila de repetição espaçada →
            </Link>
          </p>
        </div>
      </section>

      {/* Área Analítica: Desempenho por Disciplina & Último Simulado / Histórico */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Desempenho por Disciplina */}
        <section className="lg:col-span-2 bg-surface border border-border rounded-lg p-6 shadow-subtle flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-4 mb-5 border-b border-border">
              <div>
                <h3 className="font-display text-sm font-semibold text-foreground">
                  Desempenho por Disciplina ({activeTrackCode})
                </h3>
                <p className="text-xs text-muted mt-0.5">
                  Disciplinas com melhor e menor taxa de aproveitamento real
                </p>
              </div>
              <Link
                href={`/estatisticas?track=${activeTrackCode}`}
                className="text-xs font-medium text-petrol hover:underline"
              >
                Análise completa
              </Link>
            </div>

            {overview.subjectBreakdown.length === 0 ? (
              <div className="py-10 text-center space-y-3">
                <div className="w-10 h-10 rounded-full bg-surface-subtle text-muted inline-flex items-center justify-center">
                  <Scale className="w-5 h-5" />
                </div>
                <div className="max-w-md mx-auto">
                  <p className="text-xs font-medium text-foreground">
                    Nenhuma questão respondida ainda para {activeTrackCode}
                  </p>
                  <p className="text-xs text-muted mt-1 leading-relaxed">
                    A plataforma não exibe gráficos fictícios. Assim que você
                    importar um caderno oficial e registrar suas primeiras
                    respostas, o diagnóstico por disciplina aparecerá aqui.
                  </p>
                </div>
                <div className="pt-2 flex items-center justify-center gap-3">
                  <Link
                    href="/admin/importacoes"
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-md bg-navy text-white text-xs font-medium"
                  >
                    <FileUp className="w-3.5 h-3.5" />
                    <span>Importar prova oficial</span>
                  </Link>
                  <Link
                    href={`/questoes?track=${activeTrackCode}`}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-md border border-border text-xs font-medium text-foreground hover:border-petrol"
                  >
                    <span>Explorar banco de questões</span>
                  </Link>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {overview.subjectBreakdown.map((subj) => (
                  <div key={subj.subjectId} className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium text-foreground">
                        {subj.subjectName}
                      </span>
                      <span className="text-muted">
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
                    <div className="h-2 w-full rounded-full bg-surface-subtle overflow-hidden">
                      <div
                        className={cn(
                          "h-full rounded-full transition-all",
                          subj.accuracy >= 70
                            ? "bg-semantic-success"
                            : subj.accuracy >= 50
                              ? "bg-semantic-warning"
                              : "bg-semantic-error"
                        )}
                        style={{ width: `${Math.min(100, subj.accuracy)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* Último Simulado & Ações de Revisão */}
        <section className="space-y-4">
          <div className="bg-surface border border-border rounded-lg p-6 shadow-subtle">
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-border">
              <h3 className="font-display text-sm font-semibold text-foreground">
                Último Simulado
              </h3>
              <Timer className="w-4 h-4 text-muted" />
            </div>

            {overview.latestSimulation ? (
              <div className="space-y-3">
                <p className="text-xs font-semibold text-foreground">
                  {overview.latestSimulation.title}
                </p>
                <div className="flex items-baseline justify-between">
                  <span className="text-xs text-muted">Pontuação líquida:</span>
                  <span className="font-display text-lg font-semibold text-foreground">
                    {overview.latestSimulation.netScore} /{" "}
                    {overview.latestSimulation.maxScore} (
                    {overview.latestSimulation.percentageScore}%)
                  </span>
                </div>
                <Link
                  href={`/simulados/${overview.latestSimulation.simulationId}/resultado?attemptId=${overview.latestSimulation.id}`}
                  className="w-full h-9 inline-flex items-center justify-center gap-1.5 rounded-md bg-surface-subtle hover:bg-navy hover:text-white text-xs font-medium text-foreground transition-colors"
                >
                  <span>Ver relatório detalhado</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-xs text-muted leading-relaxed">
                  Nenhum simulado cronometrado realizado ainda. Configure uma
                  prova anterior oficial (TJSP, PCSP, PRF 2021 ou OAB) ou um
                  treino focado em dificuldades.
                </p>
                <Link
                  href={`/simulados?track=${activeTrackCode}`}
                  className="w-full h-9 inline-flex items-center justify-center gap-1.5 rounded-md bg-navy text-white text-xs font-medium hover:bg-navy-light transition-colors"
                >
                  <span>Configurar simulado</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            )}
          </div>

          <div className="bg-surface border border-border rounded-lg p-6 shadow-subtle">
            <div className="flex items-center justify-between pb-3 mb-3 border-b border-border">
              <h3 className="font-display text-sm font-semibold text-foreground">
                Caderno Automático de Erros
              </h3>
              <AlertTriangle className="w-4 h-4 text-semantic-error" />
            </div>
            <p className="text-xs text-muted leading-relaxed mb-4">
              Todas as questões respondidas incorretamente são adicionadas
              automaticamente ao seu caderno de erros e agendadas na fila de
              repetição espaçada.
            </p>
            <Link
              href={`/cadernos?track=${activeTrackCode}`}
              className="w-full h-9 inline-flex items-center justify-center gap-1.5 rounded-md border border-border hover:border-petrol text-xs font-medium text-foreground transition-colors"
            >
              <span>Acessar cadernos de revisão</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}
