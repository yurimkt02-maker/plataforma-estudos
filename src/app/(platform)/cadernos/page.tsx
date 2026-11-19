import Link from "next/link";
import {
  FolderKanban,
  AlertTriangle,
  BookOpen,
  ArrowRight,
} from "lucide-react";
import { requireServerAuth } from "@/lib/auth/session";
import { isDatabaseConfigured, prisma } from "@/lib/db/prisma";

const SUGGESTED_NOTEBOOK_TEMPLATES = [
  {
    name: "Questões de Direito Penal",
    track: "PCSP / TJSP",
    description:
      "Crimes contra a Administração Pública, Fé Pública e Teoria do Crime.",
  },
  {
    name: "Erros da PRF",
    track: "PRF",
    description:
      "Itens Certo/Errado do Cebraspe em Legislação de Trânsito (CTB) e Constitucional.",
  },
  {
    name: "Português — TJSP",
    track: "TJSP",
    description:
      "Concordância, regência, crase e interpretação textual da banca Vunesp.",
  },
  {
    name: "Ética — OAB",
    track: "OAB",
    description:
      "Estatuto da Advocacia (Lei nº 8.906/1994), prerrogativas e disciplina na 1ª Fase.",
  },
  {
    name: "Revisão da Semana",
    track: "Geral",
    description:
      "Seleção transversal das questões prioritárias para consolidação semanal.",
  },
] as const;

export default async function NotebooksPage() {
  const user = await requireServerAuth();
  const dbConnected = isDatabaseConfigured();

  const notebooks = dbConnected
    ? await prisma.notebook.findMany({
        where: { userId: user.id },
        include: {
          _count: { select: { questions: true } },
        },
        orderBy: [{ isSystemAutoErrors: "desc" }, { updatedAt: "desc" }],
      })
    : [];

  return (
    <div className="space-y-8">
      {/* Destaque: Caderno Automático de Erros */}
      <section className="bg-surface border border-border rounded-lg p-6 shadow-card flex flex-col sm:flex-row sm:items-center justify-between gap-5">
        <div className="flex items-start gap-3.5">
          <div className="w-10 h-10 rounded-lg bg-semantic-error-bg text-semantic-error flex items-center justify-center shrink-0">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div>
            <span className="px-2 py-0.5 rounded bg-semantic-error-bg text-semantic-error text-[10px] font-semibold">
              Alimentação Automática pelo Motor de Correção
            </span>
            <h2 className="font-display text-base font-semibold text-foreground mt-1">
              Caderno Automático de Erros
            </h2>
            <p className="text-xs text-muted mt-0.5 leading-relaxed max-w-2xl">
              Toda questão oficial respondida incorretamente é registrada
              automaticamente neste caderno, preservando a referência ao caderno
              original e ao gabarito oficial utilizado na tentativa.
            </p>
          </div>
        </div>

        <Link
          href="/questoes?accuracyFilter=WRONG"
          className="shrink-0 h-9 px-4 rounded-md bg-navy hover:bg-navy-light text-white text-xs font-medium inline-flex items-center gap-1.5"
        >
          <span>Resolver questões erradas</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </section>

      {/* Cadernos Persistidos no Prisma Postgres */}
      <section className="bg-surface border border-border rounded-lg p-6 shadow-subtle space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-border">
          <div className="flex items-center gap-2">
            <FolderKanban className="w-4 h-4 text-navy" />
            <h3 className="font-display text-sm font-semibold text-foreground">
              Meus Cadernos ({notebooks.length})
            </h3>
          </div>
          <span className="text-xs text-muted">
            Questões vinculadas sem duplicar registros originais
          </span>
        </div>

        {notebooks.length === 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pt-2">
            {SUGGESTED_NOTEBOOK_TEMPLATES.map((tpl) => (
              <div
                key={tpl.name}
                className="p-4 rounded-lg bg-background border border-border flex flex-col justify-between gap-3"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="font-display text-xs font-semibold text-foreground">
                      {tpl.name}
                    </span>
                    <span className="px-2 py-0.5 rounded bg-surface border border-border text-[10px] font-medium text-muted">
                      {tpl.track}
                    </span>
                  </div>
                  <p className="text-xs text-muted mt-1.5 leading-relaxed">
                    {tpl.description}
                  </p>
                </div>
                <Link
                  href="/questoes"
                  className="text-xs font-medium text-petrol hover:underline inline-flex items-center gap-1"
                >
                  <BookOpen className="w-3.5 h-3.5" />
                  <span>Selecionar questões no banco →</span>
                </Link>
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {notebooks.map((nb) => (
              <div
                key={nb.id}
                className="p-4 rounded-lg bg-background border border-border flex flex-col justify-between gap-3"
              >
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <h4 className="font-display text-xs font-semibold text-foreground">
                      {nb.name}
                    </h4>
                    <span className="px-2 py-0.5 rounded bg-surface border border-border text-[11px] font-medium">
                      {nb._count.questions} questões
                    </span>
                  </div>
                  <p className="text-xs text-muted mt-1.5">
                    {nb.description || "Caderno personalizado de estudo."}
                  </p>
                </div>
                <Link
                  href="/questoes"
                  className="text-xs font-medium text-petrol hover:underline"
                >
                  Estudar caderno →
                </Link>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
