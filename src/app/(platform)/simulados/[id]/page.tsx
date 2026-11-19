import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireServerAuth } from "@/lib/auth/session";
import { isDatabaseConfigured, prisma } from "@/lib/db/prisma";
import {
  SimulationRunnerClient,
  type RunnerItem,
} from "@/components/simulations/simulation-runner";

export default async function SimulationExecutionPage({
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
          Conecte o Prisma Postgres (.env.local) para executar o simulado #{id}.
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
      items: {
        orderBy: { position: "asc" },
        include: {
          subject: true,
          examQuestionInstance: true,
          question: {
            include: {
              options: { orderBy: { displayOrder: "asc" } },
            },
          },
        },
      },
      attempts: {
        where: { userId: user.id },
        orderBy: { startedAt: "desc" },
        include: { responses: true },
      },
    },
  });

  if (!simulation || simulation.userId !== user.id) {
    notFound();
  }

  const activeAttempt = attemptId
    ? simulation.attempts.find((a) => a.id === attemptId)
    : simulation.attempts[0];

  if (!activeAttempt) {
    redirect("/simulados");
  }

  if (activeAttempt.status === "COMPLETED") {
    redirect(`/simulados/${simulation.id}/resultado?attemptId=${activeAttempt.id}`);
  }

  const respByItemId = new Map(
    activeAttempt.responses.map((r) => [r.simulationItemId, r])
  );

  const runnerItems: RunnerItem[] = simulation.items.map((item) => {
    const resp = respByItemId.get(item.id);
    return {
      simulationItemId: item.id,
      position: item.position,
      questionId: item.questionId,
      originalNumber: item.examQuestionInstance.originalNumber,
      subjectName: item.subject?.name ?? "Disciplina Geral",
      statement: item.question.statement,
      supportText: item.question.supportText,
      options: item.question.options.map((o) => ({
        label: o.label,
        content: o.content,
      })),
      initialSelectedAnswer: resp?.selectedAnswer ?? null,
      initialMarkedForReview: resp?.markedForReview ?? false,
    };
  });

  return (
    <SimulationRunnerClient
      simulationId={simulation.id}
      attemptId={activeAttempt.id}
      title={simulation.title}
      durationMinutes={simulation.durationMinutes}
      items={runnerItems}
    />
  );
}
