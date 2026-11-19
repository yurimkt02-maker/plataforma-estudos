import { Scale, ExternalLink, ShieldCheck } from "lucide-react";
import { requireAdminAuth } from "@/lib/auth/session";
import { getAcademicCatalogMetadata } from "@/features/question-bank/service";

export default async function AdminLegalSourcesPage() {
  await requireAdminAuth();
  const catalog = await getAcademicCatalogMetadata();

  return (
    <div className="space-y-6">
      <section className="bg-surface border border-border rounded-lg p-6 shadow-card space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-border">
          <div className="flex items-center gap-2">
            <Scale className="w-4 h-4 text-navy" />
            <h2 className="font-display text-sm font-semibold text-foreground">
              Gestão de Fontes Jurídicas &amp; Passagens Normativas (LegalSource &amp; LegalPassage)
            </h2>
          </div>
          <span className="text-xs text-muted inline-flex items-center gap-1">
            <ShieldCheck className="w-3.5 h-3.5 text-petrol" />
            Invalidação automática de comentários por hash de snapshot
          </span>
        </div>

        <div className="space-y-4">
          {catalog.legalSources.map((src) => (
            <div
              key={src.title}
              className="p-4 rounded-lg bg-background border border-border space-y-3"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <span className="px-2 py-0.5 rounded bg-navy text-white text-[10px] font-semibold mr-2">
                    {src.sourceType}
                  </span>
                  <span className="font-display text-xs font-semibold text-foreground">
                    {src.title} ({src.documentNumber})
                  </span>
                </div>
                <a
                  href={src.officialUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs font-medium text-petrol hover:underline"
                >
                  <span>Conferir no Portal Oficial</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>

              <div className="space-y-2">
                {src.passages.map((p) => (
                  <div
                    key={p.referenceLabel}
                    className="p-3 rounded bg-surface border border-border text-xs space-y-1"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-foreground">
                        {p.referenceLabel}
                      </span>
                      <span className="px-2 py-0.5 rounded bg-semantic-success-bg text-semantic-success text-[10px] font-semibold">
                        {p.isCurrentlyInForce
                          ? "Em vigor (Verificado)"
                          : "Revogado / Alterado"}
                      </span>
                    </div>
                    <p className="text-muted leading-relaxed">{p.content}</p>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
