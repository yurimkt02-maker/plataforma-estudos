import { BookCopy, ExternalLink } from "lucide-react";
import { requireAdminAuth } from "@/lib/auth/session";
import { INITIAL_EXAM_EDITIONS } from "@/features/question-bank/catalog-data";

export default async function AdminExamsPage() {
  await requireAdminAuth();

  return (
    <div className="space-y-6">
      <section className="bg-surface border border-border rounded-lg p-6 shadow-card space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-border">
          <div className="flex items-center gap-2">
            <BookCopy className="w-4 h-4 text-navy" />
            <h2 className="font-display text-sm font-semibold text-foreground">
              Catálogo de Edições de Prova e Versões de Caderno (ExamEdition &amp; ExamForm)
            </h2>
          </div>
          <span className="text-xs text-muted">
            Preservação obrigatória de versão para associação exata de gabarito
          </span>
        </div>

        <div className="space-y-3">
          {INITIAL_EXAM_EDITIONS.map((ed) => (
            <div
              key={ed.editionCode}
              className="p-4 rounded-lg bg-background border border-border flex flex-col sm:flex-row sm:items-center justify-between gap-4"
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded bg-navy text-white text-[10px] font-semibold">
                    {ed.editionCode}
                  </span>
                  <span className="text-xs font-semibold text-foreground">
                    {ed.title}
                  </span>
                </div>
                <p className="text-xs text-muted">
                  Banca: {ed.boardAcronym} • Regra: {ed.rulesetCode} • Cadernos:{" "}
                  {ed.forms.map((f) => `${f.versionLabel} (${f.colorOrType})`).join(" | ")}
                </p>
              </div>
              <a
                href={ed.officialNoticeUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs font-medium text-petrol hover:underline shrink-0"
              >
                <span>Edital e Cadernos</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
