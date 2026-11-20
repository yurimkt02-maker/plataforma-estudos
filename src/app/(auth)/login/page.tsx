"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Lock, ArrowRight, AlertCircle } from "lucide-react";
import { BrandMark } from "@/components/ui";
import { loginSchema } from "@/lib/validations/schemas";
import type { z } from "zod";

type LoginFormValues = z.infer<typeof loginSchema>;

function LoginFormContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") || "/dashboard";
  const [serverError, setServerError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

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
          data.message || "Não foi possível autenticar suas credenciais."
        );
        return;
      }

      router.push(callbackUrl);
      router.refresh();
    } catch {
      setServerError("Erro de comunicação com o servidor de autenticação.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-background flex flex-col justify-center items-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="mb-4 flex justify-center">
            <BrandMark size="lg" />
          </div>
          <h1 className="font-display text-2xl font-semibold text-foreground tracking-tight">
            Plataforma Pessoal de Estudos
          </h1>
          <p className="mt-1.5 text-sm text-muted">
            Ambiente privado • TJSP • PCSP • PRF • OAB
          </p>
        </div>

        <div className="bg-surface border border-border rounded-lg p-7 shadow-card">
          <div className="flex items-center justify-between pb-5 mb-6 border-b border-border">
            <div>
              <h2 className="font-display text-base font-semibold text-foreground">
                Acesso do Proprietário
              </h2>
              <p className="text-xs text-muted mt-0.5">
                Autenticação obrigatória via sessão assinada HTTP-only
              </p>
            </div>
            <Lock className="w-4 h-4 text-muted" />
          </div>

          {serverError && (
            <div
              role="alert"
              className="mb-5 p-3.5 rounded-md bg-semantic-error-bg border border-semantic-error/30 flex items-start gap-2.5 text-xs text-semantic-error"
            >
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <div className="leading-relaxed">{serverError}</div>
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
            <div>
              <label
                htmlFor="email"
                className="block text-xs font-medium text-foreground mb-1.5"
              >
                E-mail do proprietário
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                placeholder="seu-email@dominio.com"
                {...register("email")}
                className="w-full h-10 px-3.5 rounded-md bg-background border border-border text-sm text-foreground placeholder:text-muted/60 focus:outline-none focus:border-petrol focus:ring-1 focus:ring-petrol"
              />
              {errors.email && (
                <p className="mt-1 text-xs text-semantic-error">
                  {errors.email.message}
                </p>
              )}
            </div>

            <div>
              <label
                htmlFor="password"
                className="block text-xs font-medium text-foreground mb-1.5"
              >
                Senha de acesso
              </label>
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                placeholder="••••••••••••"
                {...register("password")}
                className="w-full h-10 px-3.5 rounded-md bg-background border border-border text-sm text-foreground placeholder:text-muted/60 focus:outline-none focus:border-petrol focus:ring-1 focus:ring-petrol"
              />
              {errors.password && (
                <p className="mt-1 text-xs text-semantic-error">
                  {errors.password.message}
                </p>
              )}
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full h-10 mt-2 inline-flex items-center justify-center gap-2 rounded-md bg-navy hover:bg-navy-light text-white text-sm font-medium transition-colors disabled:opacity-60"
            >
              <span>{isSubmitting ? "Verificando sessão..." : "Entrar na plataforma"}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          <div className="mt-6 pt-5 border-t border-border text-[11px] text-muted leading-relaxed">
            Acesso restrito a usuário único. Não há cadastro público. A conta do
            proprietário é inicializada via variáveis seguras{" "}
            <code className="px-1 py-0.5 rounded bg-background text-foreground font-mono">
              OWNER_EMAIL
            </code>{" "}
            e{" "}
            <code className="px-1 py-0.5 rounded bg-background text-foreground font-mono">
              OWNER_PASSWORD
            </code>{" "}
            no seed do Prisma Postgres.
          </div>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-background flex items-center justify-center text-sm text-muted">
          Carregando autenticação privada...
        </div>
      }
    >
      <LoginFormContent />
    </Suspense>
  );
}
