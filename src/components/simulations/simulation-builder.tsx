"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Timer, Play, AlertCircle, ShieldCheck } from "lucide-react";
import { OFFICIAL_RULESETS } from "@/features/scoring/engine";

export function SimulationBuilderForm({
  defaultTrackCode,
}: {
  defaultTrackCode: string;
}) {
  const router = useRouter();
  const [title, setTitle] = useState(
    `Simulado ${defaultTrackCode} — Prova Objetiva`
  );
  const [mode, setMode] = useState<"CUSTOM" | "PAST_EXAM" | "WEAKNESS_FOCUS">(
    "CUSTOM"
  );
  const [trackCode, setTrackCode] = useState(defaultTrackCode);
  const [totalQuestions, setTotalQuestions] = useState(40);
  const [durationMinutes, setDurationMinutes] = useState(240);
  const [rulesetCode, setRulesetCode] = useState<string>(
    defaultTrackCode === "PRF"
      ? "CEBRASPE_CERTO_ERRADO_PRF2021"
      : defaultTrackCode === "OAB"
        ? "FGV_OAB_1FASE_80"
        : "VUNESP_STANDARD_5"
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  async function handleCreateSimulation(e: React.FormEvent) {
    e.preventDefault();
    setErrorMessage(null);
    setIsCreating(true);

    try {
      const res = await fetch("/api/simulations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          mode,
          trackCode,
          totalQuestions,
          durationMinutes,
          rulesetCode,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setErrorMessage(
          data.message || "Não foi possível criar o simulado com esses parâmetros."
        );
        return;
      }

      const simId = data.simulation.id as string;
      const startRes = await fetch(`/api/simulations/${simId}/start`, {
        method: "POST",
      });
      const startData = await startRes.json();

      if (startRes.ok && startData.attempt) {
        router.push(
          `/simulados/${simId}?attemptId=${startData.attempt.id as string}`
        );
      } else {
        router.push(`/simulados/${simId}`);
      }
    } catch {
      setErrorMessage("Erro de comunicação ao configurar o simulado.");
    } finally {
      setIsCreating(false);
    }
  }

  return (
    <form
      onSubmit={handleCreateSimulation}
      className="bg-surface border border-border rounded-lg p-6 shadow-card space-y-5"
    >
      <div className="flex items-center justify-between pb-4 border-b border-border">
        <div className="flex items-center gap-2.5">
          <Timer className="w-4 h-4 text-navy" />
          <h3 className="font-display text-sm font-semibold text-foreground">
            Configurar Novo Simulado Cronometrado
          </h3>
        </div>
        <span className="text-[11px] text-muted inline-flex items-center gap-1">
          <ShieldCheck className="w-3.5 h-3.5 text-petrol" />
          Regras preservadas como snapshot na tentativa
        </span>
      </div>

      {errorMessage && (
        <div className="p-3.5 rounded-md bg-semantic-error-bg border border-semantic-error/30 flex items-start gap-2.5 text-xs text-semantic-error">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{errorMessage}</span>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <div className="sm:col-span-2">
          <label
            htmlFor="sim-title"
            className="block text-xs font-medium text-foreground mb-1.5"
          >
            Título do Simulado
          </label>
          <input
            id="sim-title"
            type="text"
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full h-9 px-3 rounded-md bg-background border border-border text-xs text-foreground"
          />
        </div>

        <div>
          <label
            htmlFor="sim-mode"
            className="block text-xs font-medium text-foreground mb-1.5"
          >
            Modalidade
          </label>
          <select
            id="sim-mode"
            value={mode}
            onChange={(e) =>
              setMode(
                e.target.value as "CUSTOM" | "PAST_EXAM" | "WEAKNESS_FOCUS"
              )
            }
            className="w-full h-9 px-3 rounded-md bg-background border border-border text-xs text-foreground"
          >
            <option value="CUSTOM">Simulado Personalizado</option>
            <option value="PAST_EXAM">Reprodução de Prova Anterior Oficial</option>
            <option value="WEAKNESS_FOCUS">Simulado de Dificuldades (Erros Recorrentes)</option>
          </select>
        </div>

        <div>
          <label
            htmlFor="sim-track"
            className="block text-xs font-medium text-foreground mb-1.5"
          >
            Carreira
          </label>
          <select
            id="sim-track"
            value={trackCode}
            onChange={(e) => {
              const nextTrack = e.target.value;
              setTrackCode(nextTrack);
              if (nextTrack === "PRF") {
                setRulesetCode("CEBRASPE_CERTO_ERRADO_PRF2021");
              } else if (nextTrack === "OAB") {
                setRulesetCode("FGV_OAB_1FASE_80");
              } else {
                setRulesetCode("VUNESP_STANDARD_5");
              }
            }}
            className="w-full h-9 px-3 rounded-md bg-background border border-border text-xs text-foreground"
          >
            <option value="TJSP">TJSP — Escrevente Técnico Judiciário</option>
            <option value="PCSP">PCSP — Investigador e Escrivão</option>
            <option value="PRF">PRF — Policial Rodoviário Federal</option>
            <option value="OAB">OAB — 1ª Fase Exame de Ordem</option>
          </select>
        </div>

        <div>
          <label
            htmlFor="sim-questions"
            className="block text-xs font-medium text-foreground mb-1.5"
          >
            Quantidade de Questões
          </label>
          <input
            id="sim-questions"
            type="number"
            min={5}
            max={120}
            value={totalQuestions}
            onChange={(e) => setTotalQuestions(Number(e.target.value))}
            className="w-full h-9 px-3 rounded-md bg-background border border-border text-xs text-foreground"
          />
        </div>

        <div>
          <label
            htmlFor="sim-duration"
            className="block text-xs font-medium text-foreground mb-1.5"
          >
            Duração (minutos)
          </label>
          <input
            id="sim-duration"
            type="number"
            min={15}
            max={360}
            value={durationMinutes}
            onChange={(e) => setDurationMinutes(Number(e.target.value))}
            className="w-full h-9 px-3 rounded-md bg-background border border-border text-xs text-foreground"
          />
        </div>

        <div className="sm:col-span-2 lg:col-span-3">
          <label
            htmlFor="sim-ruleset"
            className="block text-xs font-medium text-foreground mb-1.5"
          >
            Regra Oficial de Pontuação (Motor de Correção)
          </label>
          <select
            id="sim-ruleset"
            value={rulesetCode}
            onChange={(e) => setRulesetCode(e.target.value)}
            className="w-full h-9 px-3 rounded-md bg-background border border-border text-xs text-foreground"
          >
            {Object.values(OFFICIAL_RULESETS).map((r) => (
              <option key={r.code} value={r.code}>
                {r.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="pt-3 border-t border-border flex items-center justify-end">
        <button
          type="submit"
          disabled={isCreating}
          className="h-9 px-5 inline-flex items-center gap-2 rounded-md bg-navy hover:bg-navy-light text-white text-xs font-medium transition-colors disabled:opacity-50"
        >
          <Play className="w-3.5 h-3.5" />
          <span>{isCreating ? "Preparando caderno..." : "Iniciar Simulado"}</span>
        </button>
      </div>
    </form>
  );
}
