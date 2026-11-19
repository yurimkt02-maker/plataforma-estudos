import Link from "next/link";
import { Timer, CheckCircle2, ArrowRight, FileCheck } from "lucide-react";
import { requireServerAuth } from "@/lib/auth/session";
import { isDatabaseConfigured, prisma } from "@/lib/db/prisma";
import { SimulationBuilderForm } from "@/components/simulations/simulation-builder";
import { INITIAL_EXAM_EDITIONS } from "@/features/question-bank/catalog-data";

export default async function SimulationsPage({
  searchParams,
}: {
  searchParams: Promise<{ track?: string }>;
}) {
  const user = await requireServerAuth();
  const resolved = await searchParams;
  const activeTrackCode =
    resolved.track?.toUpperCase() || user.activeTrackCode || "TJSP";

  const dbConnected = isDatabaseConfigured();
  const pastSimulations = dbConnected
    ? await prisma.simulation.findMany({
        where: { userId: user.id },
        include: {
          attempts: {
            orderBy: { startedAt: "desc" },
            take: 1,
          },
        },
        orderBy: { createdAt: "desc" },
        take: 15,
      })
    : [];

  return (
    <div className="space-y-8">
      {/* Construtor de Simulado */}
      <SimulationBuilderForm defaultTrackCode={activeTrackCode} />

      {/* Provas Anteriores Catalogadas por Edição e Regra Histórica */}
      <section className="bg-surface border border-border rounded-lg p-6 shadow-subtle space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-border">
          <div>
            <h3 className="font-display text-sm font-semibold text-foreground">
              Catálogo de Edições Históricas e Regras de Edital
            </h3>
            <p className="text-xs text-muted mt-0.5">
              Cada prova preserva sua regra específica de correção (Vunesp, Cebraspe PRF 2021 ou FGV OAB)
            </p>
          </div>
          <FileCheck className="w-4 h-4 text-petrol" />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
          {INITIAL_EXAM_EDITIONS.map((ed) => (
            <div
              key={ed.editionCode}
              className="p-4 rounded-lg bg-background border border-border flex flex-col justify-between gap-3"
            >
              <div>
                <div className="flex items-center justify-between gap-2">
                  <span className="px-2 py-0.5 rounded bg-navy text-white text-[10px] font-semibold">
                    {ed.boardAcronym} • {ed.year}
                  </span>
                  <span className="text-[11px] font-mono text-muted">
                    {ed.editionCode}
                  </span>
                </div>
                <h4 className="font-display text-xs font-semibold text-foreground mt-2">
                  {ed.title}
                </h4>
                <p className="text-[11px] text-muted mt-1">
                  {ed.phase} • Versões:{" "}
                  {ed.forms.map((f) => f.versionLabel).join(", ")}
                </p>
              </div>
              <div className="pt-2.5 border-t border-border flex items-center justify-between text-[11px]">
                <span className="text-muted">
                  Regra: <strong className="text-foreground">{ed.rulesetCode}</strong>
                </span>
                <a
                  href={ed.officialNoticeUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-petrol hover:underline font-medium"
                >
                  Página Oficial da Banca →
                </a>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Histórico de Simulados do Usuário */}
      <section className="bg-surface border border-border rounded-lg p-6 shadow-subtle space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-border">
          <h3 className="font-display text-sm font-semibold text-foreground">
            Meus Simulados Realizados ({pastSimulations.length})
          </h3>
          <Timer className="w-4 h-4 text-muted" />
        </div>

        {pastSimulations.length === 0 ? (
          <p className="text-xs text-muted py-4">
            Nenhum simulado iniciado ainda. Após importar questões oficiais,
            configure e inicie um simulado no formulário acima.
          </p>
        ) : (
          <div className="divide-y divide-border">
            {pastSimulations.map((sim) => {
              const latestAttempt = sim.attempts[0];
              return (
                <div
                  key={sim.id}
                  className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-display text-xs font-semibold text-foreground">
                        {sim.title}
                      </span>
                      <span className="px-2 py-0.5 rounded bg-surface-subtle text-[10px] font-medium text-muted">
                        {sim.mode} • {sim.totalQuestions} questões •{" "}
                        {sim.durationMinutes} min
                      </span>
                    </div>
                    {latestAttempt && (
                      <p className="text-xs text-muted mt-1">
                        Status: {latestAttempt.status} • Pontuação líquida:{" "}
                        <strong className="text-foreground">
                          {Number(latestAttempt.netScore)} /{" "}
                          {Number(latestAttempt.maxScore)} (
                          {Number(latestAttempt.percentageScore)}%)
                        </strong>
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    {latestAttempt?.status === "COMPLETED" ? (
                      <Link
                        href={`/simulados/${sim.id}/resultado?attemptId=${latestAttempt.id}`}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-semantic-success-bg text-semantic-success text-xs font-medium"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Ver resultado</span>
                      </Link>
                    ) : (
                      <Link
                        href={`/simulados/${sim.id}${latestAttempt ? `?attemptId=${latestAttempt.id}` : ""}`}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-navy text-white text-xs font-medium"
                      >
                        <span>Continuar prova</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </Link>
                    )}
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
