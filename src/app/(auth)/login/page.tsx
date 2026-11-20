"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  ArrowRight,
  AlertCircle,
  Eye,
  EyeOff,
  Moon,
  Sun,
  Check,
} from "lucide-react";
import { BrandMark, Button, Card, Input, useTheme } from "@/components/ui";
import { loginSchema } from "@/lib/validations/schemas";
import type { z } from "zod";

type LoginFormValues = z.infer<typeof loginSchema>;

const TRACK_HIGHLIGHTS = [
  "TJSP • Escrevente Técnico Judiciário",
  "PCSP • Investigador e Escrivão",
  "PRF • Policial Rodoviário Federal",
  "OAB • Exame de Ordem Unificado",
] as const;

function LoginFormContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") || "/dashboard";
  const [serverError, setServerError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const { resolvedTheme, mounted, toggleTheme } = useTheme();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  async function onSubmit(values: LoginFormValues) {
    setServerError(null);
    setIsSubmitting(true);
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });

      const data = (await response.json()) as {
        authenticated?: boolean;
        message?: string;
      };

      if (!response.ok || !data.authenticated) {
        setServerError(
          data.message || "E-mail ou senha inválidos. Verifique e tente novamente."
        );
        return;
      }

      router.push(callbackUrl);
      router.refresh();
    } catch {
      setServerError("Não foi possível conectar ao servidor. Tente novamente.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-background text-foreground grid grid-cols-1 lg:grid-cols-12">
      {/* Coluna Editorial Esquerda (Desktop) */}
      <aside className="hidden lg:flex lg:col-span-5 bg-brand-gradient text-white p-10 xl:p-14 flex-col justify-between relative overflow-hidden">
        <div className="flex items-center gap-3">
          <BrandMark
            size="md"
            className="ring-1 ring-white/25 shadow-none"
          />
          <div>
            <span className="font-display text-sm font-semibold tracking-tight block leading-none">
              Estudo Jurídico
            </span>
            <span className="text-[11px] text-white/70 block mt-0.5">
              Plataforma Pessoal de Alta Precisão
            </span>
          </div>
        </div>

        <div className="space-y-6 max-w-md">
          <h2 className="font-reading text-3xl xl:text-[34px] font-medium leading-[1.22] tracking-tight text-white">
            Estudo focado, provas oficiais e revisão orientada por dados reais.
          </h2>
          <p className="text-sm text-white/80 leading-relaxed">
            Um ambiente silencioso, sem distrações, desenhado para longas
            sessões de resolução de questões, simulados cronometrados e
            consolidação de erros.
          </p>

          <ul className="space-y-2.5 pt-2">
            {TRACK_HIGHLIGHTS.map((item) => (
              <li
                key={item}
                className="flex items-center gap-2.5 text-xs text-white/90"
              >
                <span className="w-4 h-4 rounded-full bg-white/15 inline-flex items-center justify-center shrink-0">
                  <Check className="w-2.5 h-2.5 text-white" />
                </span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>

        <p className="text-[11px] text-white/60">
          Ambiente privado de preparação • Uso individual
        </p>
      </aside>

      {/* Coluna de Autenticação Direita */}
      <main className="lg:col-span-7 flex flex-col justify-between px-4 sm:px-8 py-6 sm:py-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5 lg:hidden">
            <BrandMark size="sm" />
            <span className="font-display text-sm font-semibold text-foreground">
              Estudo Jurídico
            </span>
          </div>
          <div className="hidden lg:block" />

          <button
            type="button"
            onClick={toggleTheme}
            aria-label={
              mounted && resolvedTheme === "dark"
                ? "Ativar tema claro"
                : "Ativar tema escuro"
            }
            className="h-9 w-9 inline-flex items-center justify-center rounded-md border border-border bg-surface text-muted hover:text-foreground hover:border-border-strong transition-colors"
          >
            {mounted && resolvedTheme === "dark" ? (
              <Sun className="w-4 h-4" />
            ) : (
              <Moon className="w-4 h-4" />
            )}
          </button>
        </div>

        <div className="w-full max-w-[400px] mx-auto my-auto py-8">
          <div className="mb-7 space-y-2">
            <div className="hidden sm:flex lg:hidden mb-4">
              <BrandMark size="lg" />
            </div>
            <h1 className="font-display text-2xl font-semibold text-foreground tracking-tight">
              Entrar na sua mesa de estudos
            </h1>
            <p className="text-sm text-muted leading-relaxed">
              Informe suas credenciais para continuar de onde parou.
            </p>
          </div>

          <Card className="p-6 sm:p-7">
            <form
              onSubmit={handleSubmit(onSubmit)}
              className="space-y-4"
              noValidate
            >
              {serverError && (
                <div
                  role="alert"
                  className="p-3 rounded-md bg-semantic-error-bg border border-semantic-error/25 flex items-start gap-2.5 text-xs text-semantic-error"
                >
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{serverError}</span>
                </div>
              )}

              <Input
                id="email"
                type="email"
                label="E-mail"
                autoComplete="email"
                placeholder="nome@exemplo.com"
                error={errors.email?.message}
                {...register("email")}
              />

              <div className="space-y-1.5">
                <label
                  htmlFor="password"
                  className="block text-xs font-medium text-foreground"
                >
                  Senha
                </label>
                <div className="relative">
                  <input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    placeholder="••••••••••••"
                    aria-invalid={errors.password ? "true" : undefined}
                    className="w-full h-10 pl-3 pr-10 rounded-md bg-surface border border-border text-sm text-foreground placeholder:text-subtle hover:border-border-strong focus:outline-none focus:border-brand focus:ring-2 focus:ring-[color:var(--focus-ring)] transition-colors"
                    {...register("password")}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    aria-label={
                      showPassword ? "Ocultar senha" : "Mostrar senha"
                    }
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded text-muted hover:text-foreground transition-colors"
                  >
                    {showPassword ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
                {errors.password && (
                  <p role="alert" className="text-xs text-semantic-error">
                    {errors.password.message}
                  </p>
                )}
              </div>

              <div className="pt-2">
                <Button
                  type="submit"
                  variant="primary"
                  size="lg"
                  isLoading={isSubmitting}
                  className="w-full"
                >
                  <span>{isSubmitting ? "Entrando..." : "Entrar"}</span>
                  {!isSubmitting && <ArrowRight className="w-4 h-4" />}
                </Button>
              </div>
            </form>
          </Card>

          <p className="mt-6 text-center text-xs text-muted">
            Ambiente privado de estudos • TJSP · PCSP · PRF · OAB
          </p>
        </div>

        <div className="h-4" />
      </main>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-background flex items-center justify-center text-sm text-muted">
          Carregando...
        </div>
      }
    >
      <LoginFormContent />
    </Suspense>
  );
}
