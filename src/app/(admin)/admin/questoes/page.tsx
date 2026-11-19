import { CheckSquare, ShieldCheck } from "lucide-react";
import { requireAdminAuth } from "@/lib/auth/session";
import { isDatabaseConfigured, prisma } from "@/lib/db/prisma";

export default async function AdminQuestionsCurationPage() {
  await requireAdminAuth();
  const dbConnected = isDatabaseConfigured();

  const questions = dbConnected
    ? await prisma.question.findMany({
        include: {
          examInstances: {
            include: {
              answerKeys: { orderBy: { revisionNumber: "desc" } },
              examForm: { include: { examEdition: true } },
            },
          },
          sources: { include: { sourceDocument: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 25,
      })
    : [];

  return (
    <div className="space-y-6">
      <section className="bg-surface border border-border rounded-lg p-6 shadow-card space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-border">
          <div className="flex items-center gap-2">
            <CheckSquare className="w-4 h-4 text-navy" />
            <h2 className="font-display text-sm font-semibold text-foreground">
              Curadoria de Questões &amp; Histórico de Gabaritos Oficiais ({questions.length})
            </h2>
          </div>
          <span className="text-xs text-muted inline-flex items-center gap-1">
            <ShieldCheck className="w-3.5 h-3.5 text-petrol" />
            Gabaritos versionados sem sobrescrita (OfficialAnswerKey)
          </span>
        </div>

        {questions.length === 0 ? (
          <p className="text-xs text-muted py-6 text-center">
            Nenhuma questão cadastrada na fila de curadoria no momento. As
            questões importadas via{" "}
            <code className="font-mono text-foreground">
              /admin/importacoes
            </code>{" "}
            aparecerão aqui com todas as revisões de gabarito (PRELIMINARY,
            DEFINITIVE, RECTIFIED, ANNULLED).
          </p>
        ) : (
          <div className="space-y-3">
            {questions.map((q) => {
              const inst = q.examInstances[0];
              const latestKey = inst?.answerKeys[0];
              return (
                <div
                  key={q.id}
                  className="p-4 rounded-lg bg-background border border-border flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div className="space-y-1 max-w-2xl">
                    <div className="flex items-center gap-2 text-xs">
                      <span className="px-2 py-0.5 rounded bg-navy text-white font-semibold">
                        {q.status}
                      </span>
                      <span className="font-medium text-foreground">
                        {inst?.examForm.examEdition.title ?? "Prova"} • Questão #
                        {inst?.originalNumber ?? "—"}
                      </span>
                    </div>
                    <p className="text-xs text-muted line-clamp-2">
                      {q.statement}
                    </p>
                  </div>

                  <div className="text-xs text-right shrink-0">
                    <span className="block font-semibold text-foreground">
                      Gabarito: {latestKey?.answerValue ?? "Pendente"} (Rev. #
                      {latestKey?.revisionNumber ?? 1})
                    </span>
                    <span className="block text-[11px] text-muted">
                      Status: {latestKey?.status ?? "PENDING_VERIFICATION"}
                    </span>
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
