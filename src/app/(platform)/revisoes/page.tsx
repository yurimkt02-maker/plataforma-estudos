import Link from "next/link";
import { RotateCcw, Clock, CheckCircle2, ArrowRight } from "lucide-react";
import { requireServerAuth } from "@/lib/auth/session";
import { isDatabaseConfigured, prisma } from "@/lib/db/prisma";
import { getDashboardOverview } from "@/features/question-bank/service";

export default async function ReviewsPage({
  searchParams,
}: {
  searchParams: Promise<{ track?: string }>;
}) {
  const user = await requireServerAuth();
  const resolved = await searchParams;
  const activeTrackCode =
    resolved.track?.toUpperCase() || user.activeTrackCode || "TJSP";

  const dbConnected = isDatabaseConfigured();
  const [overview, queueItems] = await Promise.all([
    getDashboardOverview({ userId: user.id, trackCode: activeTrackCode }),
    dbConnected
      ? prisma.reviewQueue.findMany({
          where: { userId: user.id },
          include: {
            question: {
              include: {
                subjects: { include: { subject: true } },
              },
            },
            examQuestionInstance: {
              include: {
                examForm: {
                  include: { examEdition: true },
                },
              },
            },
          },
          orderBy: [{ priority: "asc" }, { nextReviewAt: "asc" }],
          take: 30,
        })
      : Promise.resolve([]),
  ]);

  return (
    <div className="space-y-8">
      {/* Resumo da Fila de Revisão Espaçada */}
      <section className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-surface border border-border rounded-lg p-5 shadow-subtle">
          <div className="flex items-center justify-between text-muted mb-2">
            <span className="text-xs font-medium">Pendentes Hoje</span>
            <RotateCcw className="w-4 h-4 text-semantic-warning" />
          </div>
          <div className="font-display text-2xl font-semibold text-foreground">
            {overview.pendingReviewsCount}
          </div>
          <p className="text-[11px] text-muted mt-1">
            Intervalos baseados em acertos consecutivos (1, 3, 7, 14, 30 dias)
          </p>
        </div>

        <div className="bg-surface border border-border rounded-lg p-5 shadow-subtle">
          <div className="flex items-center justify-between text-muted mb-2">
            <span className="text-xs font-medium">Questões Erradas</span>
            <Clock className="w-4 h-4 text-semantic-error" />
          </div>
          <div className="font-display text-2xl font-semibold text-foreground">
            {overview.metrics.uniqueQuestionsInitiallyWrong}
          </div>
          <p className="text-[11px] text-muted mt-1">
            Questões únicas que apresentaram ao menos um erro
          </p>
        </div>

        <div className="bg-surface border border-border rounded-lg p-5 shadow-subtle">
          <div className="flex items-center justify-between text-muted mb-2">
            <span className="text-xs font-medium">Taxa de Recuperação Real</span>
            <CheckCircle2 className="w-4 h-4 text-semantic-success" />
          </div>
          <div className="font-display text-2xl font-semibold text-foreground">
            {overview.metrics.errorRecoveryRate.toFixed(1)}%
          </div>
          <p className="text-[11px] text-muted mt-1">
            {overview.metrics.uniqueQuestionsRecovered} questões anteriormente
            erradas já recuperadas
          </p>
        </div>
      </section>

      {/* Fila de Repetição Espaçada */}
      <section className="bg-surface border border-border rounded-lg p-6 shadow-card space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-border">
          <div>
            <h3 className="font-display text-sm font-semibold text-foreground">
              Fila de Revisão Espaçada ({queueItems.length})
            </h3>
            <p className="text-xs text-muted mt-0.5">
              Ordenada por prioridade crítica e data programada de revisão
            </p>
          </div>
          <Link
            href={`/questoes?accuracyFilter=WRONG&track=${activeTrackCode}`}
            className="h-9 px-4 rounded-md bg-navy text-white text-xs font-medium inline-flex items-center gap-1.5"
          >
            <span>Iniciar sessão de revisão</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {queueItems.length === 0 ? (
          <p className="text-xs text-muted py-6 text-center">
            Nenhum item pendente na fila de repetição espaçada no momento. O
            sistema agenda automaticamente novas revisões com base nas suas
            respostas reais.
          </p>
        ) : (
          <div className="divide-y divide-border">
            {queueItems.map((item) => {
              const subj =
                item.question.subjects.find((s) => s.isPrimary)?.subject ??
                item.question.subjects[0]?.subject;
              const isDue = item.nextReviewAt.getTime() <= Date.now();
              return (
                <div
                  key={item.id}
                  className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div className="space-y-1 max-w-2xl">
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <span className="px-2 py-0.5 rounded bg-navy text-white font-semibold">
                        Prioridade P{item.priority}
                      </span>
                      <span className="font-medium text-foreground">
                        {subj?.name ?? "Disciplina Geral"}
                      </span>
                      <span className="text-muted">•</span>
                      <span className="text-muted">
                        {item.examQuestionInstance.examForm.examEdition.title}
                      </span>
                    </div>
                    <p className="text-xs text-muted line-clamp-2">
                      {item.question.statement}
                    </p>
                  </div>

                  <div className="flex items-center gap-3 shrink-0 text-xs">
                    <div className="text-right">
                      <span className="block font-medium text-foreground">
                        Intervalo: {item.intervalDays}d • Acertos seg.:{" "}
                        {item.consecutiveCorrect}
                      </span>
                      <span className="block text-[11px] text-muted">
                        Próxima:{" "}
                        {item.nextReviewAt.toLocaleDateString("pt-BR")}{" "}
                        {isDue ? "(Vencida)" : ""}
                      </span>
                    </div>
                    <Link
                      href={`/questoes/${item.questionId}`}
                      className="px-3 py-1.5 rounded-md bg-petrol text-white font-medium hover:bg-petrol-dark"
                    >
                      Revisar
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
