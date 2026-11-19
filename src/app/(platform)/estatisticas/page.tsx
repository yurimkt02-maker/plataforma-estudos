import { BarChart3, CheckCircle2, Clock, RotateCcw } from "lucide-react";
import { requireServerAuth } from "@/lib/auth/session";
import { getDashboardOverview } from "@/features/question-bank/service";
import { SubjectAccuracyBarChart } from "@/components/charts/performance-charts";

export default async function StatisticsPage({
  searchParams,
}: {
  searchParams: Promise<{ track?: string }>;
}) {
  const user = await requireServerAuth();
  const resolved = await searchParams;
  const activeTrackCode =
    resolved.track?.toUpperCase() || user.activeTrackCode || "TJSP";

  const overview = await getDashboardOverview({
    userId: user.id,
    trackCode: activeTrackCode,
  });

  return (
    <div className="space-y-8">
      {/* Indicadores que diferenciam tentativas totais de questões únicas (Seção 2.8 e 8.7) */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-surface border border-border rounded-lg p-5 shadow-subtle">
          <div className="flex items-center justify-between text-muted mb-2">
            <span className="text-xs font-medium">Questões Únicas vs. Tentativas</span>
            <BarChart3 className="w-4 h-4 text-navy" />
          </div>
          <div className="font-display text-2xl font-semibold text-foreground">
            {overview.metrics.uniqueQuestionsAttempted} únicas
          </div>
          <p className="text-[11px] text-muted mt-1">
            {overview.metrics.totalAttempts} tentativas registradas no total
          </p>
        </div>

        <div className="bg-surface border border-border rounded-lg p-5 shadow-subtle">
          <div className="flex items-center justify-between text-muted mb-2">
            <span className="text-xs font-medium">Acerto na 1ª Tentativa</span>
            <CheckCircle2 className="w-4 h-4 text-semantic-success" />
          </div>
          <div className="font-display text-2xl font-semibold text-foreground">
            {overview.metrics.firstTryAccuracyRate.toFixed(1)}%
          </div>
          <p className="text-[11px] text-muted mt-1">
            {overview.metrics.uniqueQuestionsCorrectFirstTry} acertos imediatos
            sem refazer
          </p>
        </div>

        <div className="bg-surface border border-border rounded-lg p-5 shadow-subtle">
          <div className="flex items-center justify-between text-muted mb-2">
            <span className="text-xs font-medium">Recuperação de Erros</span>
            <RotateCcw className="w-4 h-4 text-petrol" />
          </div>
          <div className="font-display text-2xl font-semibold text-foreground">
            {overview.metrics.errorRecoveryRate.toFixed(1)}%
          </div>
          <p className="text-[11px] text-muted mt-1">
            {overview.metrics.uniqueQuestionsRecovered} de{" "}
            {overview.metrics.uniqueQuestionsInitiallyWrong} questões recuperadas
          </p>
        </div>

        <div className="bg-surface border border-border rounded-lg p-5 shadow-subtle">
          <div className="flex items-center justify-between text-muted mb-2">
            <span className="text-xs font-medium">Tempo Médio por Questão</span>
            <Clock className="w-4 h-4 text-semantic-warning" />
          </div>
          <div className="font-display text-2xl font-semibold text-foreground">
            {overview.metrics.averageTimePerAttemptSeconds}s
          </div>
          <p className="text-[11px] text-muted mt-1">
            Tempo total acumulado: {overview.metrics.totalTimeSpentSeconds}s
          </p>
        </div>
      </section>

      {/* Gráfico Recharts de Desempenho por Disciplina */}
      <section className="bg-surface border border-border rounded-lg p-6 shadow-card space-y-4">
        <div className="pb-3 border-b border-border">
          <h3 className="font-display text-sm font-semibold text-foreground">
            Aproveitamento por Disciplina — {activeTrackCode}
          </h3>
          <p className="text-xs text-muted mt-0.5">
            Visualização analítica real calculada pelo servidor a partir das suas
            tentativas no Prisma Postgres
          </p>
        </div>

        <SubjectAccuracyBarChart data={overview.subjectBreakdown} />
      </section>
    </div>
  );
}
