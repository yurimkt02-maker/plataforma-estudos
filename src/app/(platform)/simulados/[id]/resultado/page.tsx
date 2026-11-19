import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CheckCircle2, XCircle, Award } from "lucide-react";
import { requireServerAuth } from "@/lib/auth/session";
import { isDatabaseConfigured, prisma } from "@/lib/db/prisma";
import type { SubjectPerformanceBreakdown } from "@/features/scoring/engine";

export default async function SimulationResultPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ attemptId?: string }>;
}) {
  const user = await requireServerAuth();
  const { id } = await params;
  const { attemptId } = await searchParams;

  if (!isDatabaseConfigured()) {
    return (
      <div className="bg-surface border border-border rounded-lg p-8 text-center space-y-3">
        <p className="text-sm font-medium text-foreground">
          Conecte o Prisma Postgres para consultar resultados de simulados.
        </p>
        <Link
          href="/simulados"
          className="inline-flex items-center gap-1.5 text-xs text-petrol hover:underline"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Voltar para Simulados
        </Link>
      </div>
    );
  }

  const simulation = await prisma.simulation.findUnique({
    where: { id },
    include: {
      attempts: {
        where: { userId: user.id },
        orderBy: { startedAt: "desc" },
      },
    },
  });

  if (!simulation || simulation.userId !== user.id) {
    notFound();
  }

  const attempt = attemptId
    ? simulation.attempts.find((a) => a.id === attemptId)
    : simulation.attempts[0];

  if (!attempt) {
    notFound();
  }

  const breakdown = (attempt.breakdownJson ?? {}) as {
    bySubject?: SubjectPerformanceBreakdown[];
    passed?: boolean;
  };
  const bySubject = breakdown.bySubject ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Link
          href="/simulados"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-muted hover:text-foreground"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Voltar para Simulados</span>
        </Link>
      </div>

      {/* Resumo Oficial da Nota */}
      <section className="bg-surface border border-border rounded-lg p-6 shadow-card flex flex-col sm:flex-row sm:items-center justify-between gap-6">
        <div className="space-y-1.5">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded bg-surface-subtle text-xs font-medium text-navy">
            <Award className="w-3.5 h-3.5" />
            <span>Resultado Auditado pelo Motor de Correção</span>
          </div>
          <h2 className="font-display text-xl font-semibold text-foreground">
            {simulation.title}
          </h2>
          <p className="text-xs text-muted">
            Acertos: <strong className="text-semantic-success">{attempt.correctCount}</strong> •
            Erros: <strong className="text-semantic-error">{attempt.wrongCount}</strong> •
            Em branco: <strong className="text-foreground">{attempt.blankCount}</strong> •
            Anuladas: <strong className="text-foreground">{attempt.annulledCount}</strong>
          </p>
        </div>

        <div className="text-left sm:text-right">
          <div className="text-xs text-muted">Pontuação Líquida Oficial</div>
          <div className="font-display text-3xl font-bold text-foreground">
            {Number(attempt.netScore)} / {Number(attempt.maxScore)}
          </div>
          <div className="inline-flex items-center gap-1 text-xs font-semibold mt-1">
            {breakdown.passed ? (
              <span className="text-semantic-success inline-flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" />
                {Number(attempt.percentageScore)}% — Critério Mínimo Atingido
              </span>
            ) : (
              <span className="text-semantic-error inline-flex items-center gap-1">
                <XCircle className="w-3.5 h-3.5" />
                {Number(attempt.percentageScore)}% — Abaixo do Corte Mínimo
              </span>
            )}
          </div>
        </div>
      </section>

      {/* Detalhamento por Disciplina */}
      <section className="bg-surface border border-border rounded-lg p-6 shadow-subtle space-y-4">
        <h3 className="font-display text-sm font-semibold text-foreground pb-3 border-b border-border">
          Desempenho Detalhado por Disciplina
        </h3>

        {bySubject.length === 0 ? (
          <p className="text-xs text-muted">
            Nenhum detalhamento por disciplina registrado nesta tentativa.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-border text-muted">
                  <th className="py-2.5 pr-4 font-medium">Disciplina</th>
                  <th className="py-2.5 px-3 font-medium">Itens</th>
                  <th className="py-2.5 px-3 font-medium">Acertos</th>
                  <th className="py-2.5 px-3 font-medium">Erros</th>
                  <th className="py-2.5 px-3 font-medium">Em Branco</th>
                  <th className="py-2.5 px-3 font-medium">Pontos Líquidos</th>
                  <th className="py-2.5 pl-3 font-medium">Aproveitamento</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {bySubject.map((subj) => (
                  <tr key={subj.subjectId}>
                    <td className="py-3 pr-4 font-medium text-foreground">
                      {subj.subjectName}
                    </td>
                    <td className="py-3 px-3 text-muted">{subj.totalItems}</td>
                    <td className="py-3 px-3 text-semantic-success font-medium">
                      {subj.correctCount}
                    </td>
                    <td className="py-3 px-3 text-semantic-error font-medium">
                      {subj.wrongCount}
                    </td>
                    <td className="py-3 px-3 text-muted">{subj.blankCount}</td>
                    <td className="py-3 px-3 font-semibold text-foreground">
                      {subj.netPoints} / {subj.maxPoints}
                    </td>
                    <td className="py-3 pl-3 font-semibold text-foreground">
                      {subj.percentageScore}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
