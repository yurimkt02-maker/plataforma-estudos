"use client";

import { useState } from "react";
import Link from "next/link";
import {
  CheckCircle2,
  XCircle,
  ExternalLink,
  Sparkles,
  Scale,
  AlertTriangle,
  Bookmark,
  FileText,
  Clock,
  ShieldCheck,
} from "lucide-react";
import type { QuestionBankListItem } from "@/features/question-bank/service";
import type { StructuredExplanationResult, AssistantCommandType } from "@/lib/ai/explainer";
import { cn } from "@/lib/utils/cn";

const ASSISTANT_COMMANDS: Array<{
  command: AssistantCommandType;
  label: string;
}> = [
  { command: "FULL_EXPLANATION", label: "Gabarito comentado completo" },
  { command: "SIMPLIFY", label: "Explique de forma mais simples" },
  { command: "WHY_MY_OPTION_IS_WRONG", label: "Por que minha alternativa está errada?" },
  { command: "LEGAL_FOUNDATION", label: "Mostre o fundamento legal" },
  { command: "HISTORICAL_VS_CURRENT", label: "Entendimento na época vs. atual" },
  { command: "REVISION_SUMMARY", label: "Crie um resumo para revisão" },
  { command: "GENERATE_DIDACTIC_DRILL", label: "Gere questão didática de treino (IA)" },
];

export function QuestionWorkspaceCard({
  question,
  indexLabel,
}: {
  question: QuestionBankListItem;
  indexLabel?: string;
}) {
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submissionError, setSubmissionError] = useState<string | null>(null);
  const [evaluationResult, setEvaluationResult] = useState<{
    isCorrect: boolean;
    isAnnulled: boolean;
    resolvedOfficialAnswer: string;
    awardedPoints: number;
    officialKeyStatus: string;
    officialKeyRevisionNumber: number;
    nextReviewDays?: number;
  } | null>(null);

  const [explanation, setExplanation] =
    useState<StructuredExplanationResult | null>(null);
  const [loadingExplanation, setLoadingExplanation] = useState(false);
  const [bookmarked, setBookmarked] = useState(question.userHistory.isBookmarked);
  const [startedAt] = useState<number>(() => Date.now());

  async function handleConfirmAnswer() {
    if (!selectedOption) return;
    setIsSubmitting(true);
    setSubmissionError(null);

    const timeSpentSeconds = Math.max(
      1,
      Math.round((Date.now() - startedAt) / 1000)
    );

    try {
      const response = await fetch("/api/answers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          questionId: question.id,
          examQuestionInstanceId: question.examQuestionInstanceId,
          selectedAnswer: selectedOption,
          timeSpentSeconds,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        setSubmissionError(
          data.message || "Não foi possível corrigir a resposta no servidor."
        );
        return;
      }

      setEvaluationResult({
        isCorrect: data.evaluation.isCorrect,
        isAnnulled: data.evaluation.isAnnulled,
        resolvedOfficialAnswer: data.evaluation.resolvedOfficialAnswer,
        awardedPoints: data.evaluation.awardedPoints,
        officialKeyStatus: data.evaluation.officialKeyStatus,
        officialKeyRevisionNumber: data.evaluation.officialKeyRevisionNumber,
        nextReviewDays: data.nextReview?.intervalDays,
      });
    } catch {
      setSubmissionError("Falha de conexão ao registrar resposta.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleRequestExplanation(command: AssistantCommandType) {
    setLoadingExplanation(true);
    try {
      const response = await fetch("/api/explanations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          questionId: question.id,
          examQuestionInstanceId: question.examQuestionInstanceId,
          command,
          userSelectedAnswer: selectedOption ?? undefined,
        }),
      });
      const data = await response.json();
      if (response.ok && data.generated) {
        setExplanation(data.generated as StructuredExplanationResult);
      }
    } finally {
      setLoadingExplanation(false);
    }
  }

  return (
    <article className="bg-surface border border-border rounded-lg shadow-card overflow-hidden">
      {/* Cabeçalho com metadados oficiais da questão */}
      <div className="px-6 py-4 bg-surface-subtle/50 border-b border-border flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="px-2.5 py-0.5 rounded bg-navy text-white font-display font-semibold">
            {indexLabel || `Questão #${question.originalNumber}`}
          </span>
          <span className="font-semibold text-foreground">
            {question.trackCode} • {question.boardAcronym} ({question.examYear})
          </span>
          <span className="text-muted">•</span>
          <span className="text-muted">{question.positionName}</span>
          <span className="text-muted">•</span>
          <span className="px-2 py-0.5 rounded bg-surface border border-border text-[11px] text-foreground">
            {question.versionLabel}
          </span>
          {question.subjects.map((subj) => (
            <span
              key={subj.id}
              className="px-2 py-0.5 rounded bg-petrol-light text-petrol-dark font-medium text-[11px]"
            >
              {subj.name}
            </span>
          ))}
        </div>

        <div className="flex items-center gap-2">
          {question.isAnnulled && (
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded bg-semantic-warning-bg text-semantic-warning border border-semantic-warning/30 text-[11px] font-semibold">
              <AlertTriangle className="w-3 h-3" />
              Questão Anulada Oficialmente
            </span>
          )}
          {question.isOutdated && (
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded bg-semantic-error-bg text-semantic-error border border-semantic-error/30 text-[11px] font-semibold">
              <AlertTriangle className="w-3 h-3" />
              Possivelmente Desatualizada
            </span>
          )}
          <button
            type="button"
            onClick={() => setBookmarked(!bookmarked)}
            className={cn(
              "p-1.5 rounded-md border text-xs transition-colors",
              bookmarked
                ? "border-petrol bg-petrol-light text-petrol-dark"
                : "border-border bg-surface text-muted hover:text-foreground"
            )}
            title="Favoritar questão"
          >
            <Bookmark className="w-3.5 h-3.5" />
          </button>
          <Link
            href={`/questoes/${question.id}`}
            className="px-2.5 py-1 rounded-md border border-border bg-surface text-[11px] font-medium text-foreground hover:border-petrol"
          >
            Foco Individual
          </Link>
        </div>
      </div>

      {/* Corpo da Questão */}
      <div className="p-6 space-y-5">
        {question.supportText && (
          <div className="p-4 rounded-md bg-surface-subtle/60 border border-border text-xs text-foreground leading-relaxed whitespace-pre-line">
            <div className="font-semibold text-muted uppercase tracking-wider text-[10px] mb-1.5">
              Texto de Apoio
            </div>
            {question.supportText}
          </div>
        )}

        <div className="text-sm sm:text-[15px] text-foreground leading-relaxed whitespace-pre-line font-normal">
          {question.statement}
        </div>

        {question.assets && question.assets.length > 0 && (
          <div className="space-y-3 pt-1">
            {question.assets.map((asset) => (
              <figure
                key={asset.id}
                className="p-3 rounded-lg bg-white border border-border inline-block max-w-full"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={asset.url}
                  alt={asset.caption || `Figura oficial da questão #${question.originalNumber}`}
                  className="max-w-full h-auto rounded"
                />
                {asset.caption && (
                  <figcaption className="text-[11px] text-muted mt-1.5">
                    {asset.caption}
                  </figcaption>
                )}
              </figure>
            ))}
          </div>
        )}

        {/* Alternativas ou Certo/Errado */}
        <div
          role="radiogroup"
          aria-label={`Alternativas da questão ${question.originalNumber}`}
          className="space-y-2.5 pt-2"
        >
          {question.options.map((opt) => {
            const isSelected = selectedOption === opt.label;
            const isEvaluated = evaluationResult !== null;
            const isOfficialRight =
              isEvaluated &&
              evaluationResult.resolvedOfficialAnswer === opt.label;
            const isSelectedWrong =
              isEvaluated && isSelected && !evaluationResult.isCorrect;

            return (
              <button
                key={opt.id}
                type="button"
                role="radio"
                aria-checked={isSelected}
                onClick={() => setSelectedOption(opt.label)}
                className={cn(
                  "w-full text-left p-3.5 rounded-lg border transition-all flex items-start gap-3.5",
                  isOfficialRight
                    ? "bg-semantic-success-bg border-semantic-success text-foreground"
                    : isSelectedWrong
                      ? "bg-semantic-error-bg border-semantic-error text-foreground"
                      : isSelected
                        ? "bg-surface border-navy ring-1 ring-navy"
                        : "bg-background hover:bg-surface border-border"
                )}
              >
                <span
                  className={cn(
                    "w-7 h-7 rounded-md shrink-0 inline-flex items-center justify-center font-display text-xs font-semibold border",
                    isOfficialRight
                      ? "bg-semantic-success text-white border-semantic-success"
                      : isSelectedWrong
                        ? "bg-semantic-error text-white border-semantic-error"
                        : isSelected
                          ? "bg-navy text-white border-navy"
                          : "bg-surface text-foreground border-border"
                  )}
                >
                  {opt.label}
                </span>
                <span className="text-sm leading-relaxed pt-0.5 flex-1">
                  {opt.content}
                </span>
              </button>
            );
          })}
        </div>

        {submissionError && (
          <div className="p-3 rounded-md bg-semantic-error-bg border border-semantic-error/30 text-xs text-semantic-error">
            {submissionError}
          </div>
        )}

        {/* Barra de ações e rastreabilidade documental */}
        <div className="pt-3 border-t border-border flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3 text-xs text-muted">
            <span>Prova: {question.examTitle}</span>
            {question.sourcePageNumber && (
              <span>• Pág. {question.sourcePageNumber} do PDF oficial</span>
            )}
            {(question.sourceDocumentUrl || question.officialNoticeUrl) && (
              <a
                href={
                  question.sourceDocumentUrl ||
                  question.officialNoticeUrl ||
                  "#"
                }
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-petrol hover:underline font-medium"
              >
                <FileText className="w-3.5 h-3.5" />
                <span>Fonte Oficial da Prova</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            )}
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              disabled={!selectedOption || isSubmitting}
              onClick={handleConfirmAnswer}
              className="h-9 px-5 rounded-md bg-navy hover:bg-navy-light text-white text-xs font-medium transition-colors disabled:opacity-50"
            >
              {isSubmitting ? "Corrigindo no servidor..." : "Responder questão"}
            </button>
          </div>
        </div>

        {/* Gabarito Oficial & Comentário Auditado */}
        {evaluationResult && (
          <div className="mt-6 pt-6 border-t border-border space-y-5">
            {/* Resultado oficial */}
            <div
              className={cn(
                "p-4 rounded-lg border flex flex-col sm:flex-row sm:items-center justify-between gap-4",
                evaluationResult.isCorrect
                  ? "bg-semantic-success-bg border-semantic-success/30"
                  : "bg-semantic-error-bg border-semantic-error/30"
              )}
            >
              <div className="flex items-start gap-3">
                {evaluationResult.isCorrect ? (
                  <CheckCircle2 className="w-5 h-5 text-semantic-success shrink-0 mt-0.5" />
                ) : (
                  <XCircle className="w-5 h-5 text-semantic-error shrink-0 mt-0.5" />
                )}
                <div>
                  <div className="font-display text-sm font-semibold text-foreground">
                    {evaluationResult.isCorrect
                      ? "Resposta Correta!"
                      : "Resposta Incorreta — Adicionada ao Caderno Automático de Erros"}
                  </div>
                  <p className="text-xs text-muted mt-0.5">
                    Alternativa selecionada:{" "}
                    <strong className="text-foreground">{selectedOption}</strong>{" "}
                    • Gabarito Oficial Definitivo da Banca:{" "}
                    <strong className="text-foreground">
                      {evaluationResult.resolvedOfficialAnswer}
                    </strong>{" "}
                    (Revisão #{evaluationResult.officialKeyRevisionNumber} —{" "}
                    {evaluationResult.officialKeyStatus})
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0 text-xs">
                <span className="px-2.5 py-1 rounded bg-surface border border-border font-medium">
                  Pontos: {evaluationResult.awardedPoints >= 0 ? "+" : ""}
                  {evaluationResult.awardedPoints}
                </span>
                {evaluationResult.nextReviewDays && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-surface border border-border text-muted">
                    <Clock className="w-3 h-3" />
                    Revisão em {evaluationResult.nextReviewDays}d
                  </span>
                )}
              </div>
            </div>

            {/* Assistente de Aprendizagem — Comandos Rápidos */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-display text-xs font-semibold uppercase tracking-wider text-muted flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-petrol" />
                  Gabarito Comentado &amp; Assistente Jurídico
                </span>
                <span className="text-[11px] text-muted">
                  A IA explica com fontes auditadas, mas jamais altera o gabarito oficial
                </span>
              </div>

              <div className="flex flex-wrap gap-2">
                {ASSISTANT_COMMANDS.map((cmd) => (
                  <button
                    key={cmd.command}
                    type="button"
                    disabled={loadingExplanation}
                    onClick={() => handleRequestExplanation(cmd.command)}
                    className="px-3 py-1.5 rounded-md bg-surface-subtle hover:bg-navy hover:text-white border border-border text-xs font-medium text-foreground transition-colors disabled:opacity-50"
                  >
                    {cmd.label}
                  </button>
                ))}
              </div>
            </div>

            {loadingExplanation && (
              <div className="p-4 rounded-lg bg-surface-subtle border border-border text-xs text-muted animate-pulse">
                Consultando fontes jurídicas verificadas no catálogo e validando citações...
              </div>
            )}

            {explanation && (
              <div className="p-5 rounded-lg bg-surface border border-border space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-border">
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-[11px] font-semibold bg-surface-subtle text-foreground">
                    <ShieldCheck className="w-3.5 h-3.5 text-petrol" />
                    <span>{explanation.disclaimerLabel}</span>
                  </div>
                  <span className="text-[11px] text-muted">
                    Status de auditoria:{" "}
                    <strong className="text-foreground">
                      {explanation.validation.status}
                    </strong>
                  </span>
                </div>

                {explanation.assistantCommandResponse && (
                  <div className="p-3.5 rounded-md bg-petrol-light/60 border border-petrol/30 text-xs text-foreground whitespace-pre-line leading-relaxed">
                    {explanation.assistantCommandResponse}
                  </div>
                )}

                <div className="space-y-3 text-xs leading-relaxed">
                  <div>
                    <h4 className="font-display font-semibold text-foreground mb-1">
                      Explicação da Alternativa Correta ({explanation.officialAnswerValue})
                    </h4>
                    <p className="text-foreground">
                      {explanation.correctOptionAnalysis}
                    </p>
                  </div>

                  {Object.keys(explanation.wrongOptionsAnalysis).length > 0 && (
                    <div>
                      <h4 className="font-display font-semibold text-foreground mb-1">
                        Por que as demais estão incorretas?
                      </h4>
                      <ul className="space-y-1 text-muted">
                        {Object.entries(explanation.wrongOptionsAnalysis).map(
                          ([label, reason]) => (
                            <li key={label}>
                              <strong className="text-foreground">
                                ({label})
                              </strong>{" "}
                              {reason}
                            </li>
                          )
                        )}
                      </ul>
                    </div>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
                    <div className="p-3 rounded-md bg-surface-subtle border border-border">
                      <div className="font-display font-semibold text-foreground mb-1">
                        Entendimento na Data da Prova
                      </div>
                      <p className="text-muted">
                        {explanation.historicalUnderstanding}
                      </p>
                    </div>
                    <div className="p-3 rounded-md bg-surface-subtle border border-border">
                      <div className="font-display font-semibold text-foreground mb-1">
                        Entendimento Atual Verificado
                      </div>
                      <p className="text-muted">
                        {explanation.currentUnderstanding}
                      </p>
                    </div>
                  </div>

                  {/* Fontes e Referências Consultadas */}
                  <div className="pt-2">
                    <h4 className="font-display font-semibold text-foreground mb-1.5 flex items-center gap-1.5">
                      <Scale className="w-3.5 h-3.5 text-navy" />
                      <span>Referências Jurídicas Consultadas</span>
                    </h4>
                    {explanation.citations.length === 0 ? (
                      <p className="text-muted italic">
                        Nenhuma fonte normativa vinculada. Comentário marcado como{" "}
                        {explanation.validation.status}.
                      </p>
                    ) : (
                      <ul className="space-y-1.5">
                        {explanation.citations.map((cit, idx) => (
                          <li
                            key={`${cit.legalSourceId}-${idx}`}
                            className="p-2.5 rounded bg-background border border-border flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                          >
                            <div>
                              <span className="font-semibold text-foreground">
                                {cit.claimReference}
                              </span>{" "}
                              <span className="text-muted">
                                — {cit.title} ({cit.authority})
                              </span>
                            </div>
                            <a
                              href={cit.officialUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-petrol hover:underline font-medium shrink-0"
                            >
                              <span>Fonte Oficial</span>
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </article>
  );
}
