"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Timer,
  Flag,
  CheckCircle2,
  ArrowLeft,
  ArrowRight,
  Save,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";

export type RunnerItem = {
  simulationItemId: string;
  position: number;
  questionId: string;
  originalNumber: number;
  subjectName: string;
  statement: string;
  supportText: string | null;
  options: Array<{ label: string; content: string }>;
  initialSelectedAnswer: string | null;
  initialMarkedForReview: boolean;
};

export function SimulationRunnerClient({
  simulationId,
  attemptId,
  title,
  durationMinutes,
  items,
}: {
  simulationId: string;
  attemptId: string;
  title: string;
  durationMinutes: number;
  items: RunnerItem[];
}) {
  const router = useRouter();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string | null>>(() =>
    Object.fromEntries(
      items.map((item) => [item.simulationItemId, item.initialSelectedAnswer])
    )
  );
  const [reviewFlags, setReviewFlags] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(
      items.map((item) => [item.simulationItemId, item.initialMarkedForReview])
    )
  );
  const [remainingSeconds, setRemainingSeconds] = useState(
    durationMinutes * 60
  );
  const [isSaving, setIsSaving] = useState(false);
  const [isFinishing, setIsFinishing] = useState(false);
  const [confirmFinishOpen, setConfirmFinishOpen] = useState(false);

  const currentItem = items[currentIndex];

  useEffect(() => {
    const interval = setInterval(() => {
      setRemainingSeconds((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  function formatCountdown(totalSecs: number): string {
    const h = Math.floor(totalSecs / 3600);
    const m = Math.floor((totalSecs % 3600) / 60);
    const s = totalSecs % 60;
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }

  async function saveCurrentProgress() {
    setIsSaving(true);
    try {
      await fetch(`/api/attempts/${attemptId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          elapsedSeconds: durationMinutes * 60 - remainingSeconds,
          responses: items.map((item) => ({
            simulationItemId: item.simulationItemId,
            selectedAnswer: answers[item.simulationItemId] ?? null,
            markedForReview: Boolean(reviewFlags[item.simulationItemId]),
            timeSpentSeconds: 0,
          })),
        }),
      });
    } finally {
      setIsSaving(false);
    }
  }

  async function handleFinishSimulation() {
    setIsFinishing(true);
    try {
      await saveCurrentProgress();
      const res = await fetch(`/api/attempts/${attemptId}/finish`, {
        method: "POST",
      });
      if (res.ok) {
        router.push(
          `/simulados/${simulationId}/resultado?attemptId=${attemptId}`
        );
        router.refresh();
      }
    } finally {
      setIsFinishing(false);
    }
  }

  if (!currentItem) {
    return null;
  }

  const answeredCount = Object.values(answers).filter(
    (v) => v !== null && v !== undefined
  ).length;

  return (
    <div className="space-y-6">
      {/* Barra superior fixa de execução sem distrações */}
      <div className="bg-surface border border-border rounded-lg p-4 shadow-card flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="font-display text-sm font-semibold text-foreground">
            {title}
          </h2>
          <p className="text-xs text-muted">
            Progresso: {answeredCount} de {items.length} respondidas •{" "}
            {items.length - answeredCount} em branco
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-surface-subtle border border-border font-mono text-xs font-semibold text-foreground">
            <Timer className="w-4 h-4 text-petrol" />
            <span>{formatCountdown(remainingSeconds)}</span>
          </div>

          <button
            type="button"
            onClick={saveCurrentProgress}
            disabled={isSaving}
            className="h-9 px-3 rounded-md border border-border bg-surface text-xs font-medium text-foreground hover:border-petrol inline-flex items-center gap-1.5"
          >
            <Save className="w-3.5 h-3.5" />
            <span>{isSaving ? "Salvando..." : "Salvar"}</span>
          </button>

          <button
            type="button"
            onClick={() => setConfirmFinishOpen(true)}
            className="h-9 px-4 rounded-md bg-navy hover:bg-navy-light text-white text-xs font-medium inline-flex items-center gap-1.5"
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Encerrar Prova</span>
          </button>
        </div>
      </div>

      {/* Confirmação antes de encerrar */}
      {confirmFinishOpen && (
        <div className="p-5 rounded-lg bg-semantic-warning-bg border border-semantic-warning/40 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="text-xs space-y-1">
            <p className="font-display font-semibold text-foreground">
              Confirmar encerramento definitivo do simulado?
            </p>
            <p className="text-muted">
              Você respondeu {answeredCount} de {items.length} questões (
              {items.length - answeredCount} em branco). Após encerrar, o
              motor de correção calculará sua nota oficial no servidor e a
              tentativa será bloqueada para alterações.
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setConfirmFinishOpen(false)}
              className="h-9 px-3 rounded-md bg-surface border border-border text-xs font-medium"
            >
              Continuar revisando
            </button>
            <button
              type="button"
              disabled={isFinishing}
              onClick={handleFinishSimulation}
              className="h-9 px-4 rounded-md bg-navy text-white text-xs font-medium"
            >
              {isFinishing ? "Corrigindo prova..." : "Confirmar e corrigir"}
            </button>
          </div>
        </div>
      )}

      {/* Área de Resolução + Grade de Navegação */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-3 bg-surface border border-border rounded-lg p-6 shadow-card space-y-5">
          <div className="flex items-center justify-between pb-3 border-b border-border">
            <div className="flex items-center gap-2 text-xs">
              <span className="px-2.5 py-0.5 rounded bg-navy text-white font-display font-semibold">
                Item {currentItem.position} / {items.length}
              </span>
              <span className="text-muted">
                (Nº Original #{currentItem.originalNumber})
              </span>
              <span className="px-2 py-0.5 rounded bg-petrol-light text-petrol-dark font-medium">
                {currentItem.subjectName}
              </span>
            </div>

            <button
              type="button"
              onClick={() =>
                setReviewFlags((prev) => ({
                  ...prev,
                  [currentItem.simulationItemId]:
                    !prev[currentItem.simulationItemId],
                }))
              }
              className={cn(
                "inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium border",
                reviewFlags[currentItem.simulationItemId]
                  ? "bg-semantic-warning-bg text-semantic-warning border-semantic-warning/40"
                  : "bg-surface text-muted border-border"
              )}
            >
              <Flag className="w-3.5 h-3.5" />
              <span>Marcar para revisão</span>
            </button>
          </div>

          {currentItem.supportText && (
            <div className="p-4 rounded-md bg-surface-subtle border border-border text-xs leading-relaxed whitespace-pre-line">
              {currentItem.supportText}
            </div>
          )}

          <div className="text-sm sm:text-[15px] text-foreground leading-relaxed whitespace-pre-line">
            {currentItem.statement}
          </div>

          <div className="space-y-2.5 pt-2">
            {currentItem.options.map((opt) => {
              const selected =
                answers[currentItem.simulationItemId] === opt.label;
              return (
                <button
                  key={opt.label}
                  type="button"
                  onClick={() =>
                    setAnswers((prev) => ({
                      ...prev,
                      [currentItem.simulationItemId]: selected
                        ? null
                        : opt.label,
                    }))
                  }
                  className={cn(
                    "w-full text-left p-3.5 rounded-lg border transition-all flex items-start gap-3.5",
                    selected
                      ? "bg-surface border-navy ring-1 ring-navy"
                      : "bg-background hover:bg-surface border-border"
                  )}
                >
                  <span
                    className={cn(
                      "w-7 h-7 rounded-md shrink-0 inline-flex items-center justify-center font-display text-xs font-semibold border",
                      selected
                        ? "bg-navy text-white border-navy"
                        : "bg-surface text-foreground border-border"
                    )}
                  >
                    {opt.label}
                  </span>
                  <span className="text-sm leading-relaxed pt-0.5">
                    {opt.content}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="pt-4 border-t border-border flex items-center justify-between">
            <button
              type="button"
              disabled={currentIndex === 0}
              onClick={() => setCurrentIndex((i) => Math.max(0, i - 1))}
              className="h-9 px-3.5 rounded-md border border-border text-xs font-medium inline-flex items-center gap-1.5 disabled:opacity-40"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Questão anterior</span>
            </button>

            <button
              type="button"
              onClick={() =>
                setAnswers((prev) => ({
                  ...prev,
                  [currentItem.simulationItemId]: null,
                }))
              }
              className="text-xs text-muted hover:text-foreground underline"
            >
              Deixar resposta em branco
            </button>

            <button
              type="button"
              disabled={currentIndex >= items.length - 1}
              onClick={() =>
                setCurrentIndex((i) => Math.min(items.length - 1, i + 1))
              }
              className="h-9 px-3.5 rounded-md bg-navy text-white text-xs font-medium inline-flex items-center gap-1.5 disabled:opacity-40"
            >
              <span>Próxima questão</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Cartão de Respostas / Mapa da Prova */}
        <aside className="bg-surface border border-border rounded-lg p-5 shadow-subtle space-y-4">
          <h3 className="font-display text-xs font-semibold uppercase tracking-wider text-muted">
            Cartão de Respostas
          </h3>
          <div className="grid grid-cols-5 gap-2">
            {items.map((item, idx) => {
              const hasAnswer = Boolean(answers[item.simulationItemId]);
              const isFlagged = Boolean(reviewFlags[item.simulationItemId]);
              const isCurrent = idx === currentIndex;
              return (
                <button
                  key={item.simulationItemId}
                  type="button"
                  onClick={() => setCurrentIndex(idx)}
                  className={cn(
                    "h-8 rounded text-xs font-display font-medium border transition-colors",
                    isCurrent
                      ? "ring-2 ring-navy border-navy"
                      : isFlagged
                        ? "bg-semantic-warning-bg text-semantic-warning border-semantic-warning/40"
                        : hasAnswer
                          ? "bg-navy text-white border-navy"
                          : "bg-background text-muted border-border"
                  )}
                >
                  {item.position}
                </button>
              );
            })}
          </div>
        </aside>
      </div>
    </div>
  );
}
