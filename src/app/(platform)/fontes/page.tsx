import { Scale, ExternalLink, ShieldCheck, FileText } from "lucide-react";
import { requireServerAuth } from "@/lib/auth/session";
import { getAcademicCatalogMetadata } from "@/features/question-bank/service";

const OFFICIAL_PORTALS = [
  {
    category: "Legislação Federal",
    authority: "Portal da Legislação — Planalto",
    url: "https://www4.planalto.gov.br/legislacao",
    description:
      "Fonte primária oficial para Constituição Federal, Códigos (CP, CPP, CPC, CTB) e leis federais compiladas.",
  },
  {
    category: "Legislação Estadual de São Paulo",
    authority: "Assembleia Legislativa do Estado de São Paulo (Alesp)",
    url: "https://www.al.sp.gov.br",
    description:
      "Fonte oficial para Constituição Estadual de SP, Lei nº 10.261/1968 (Estatuto dos Funcionários Públicos) e Lei Orgânica da Polícia Civil.",
  },
  {
    category: "Jurisprudência Constitucional",
    authority: "Supremo Tribunal Federal (STF)",
    url: "https://jurisprudencia.stf.jus.br/",
    description:
      "Súmulas Vinculantes, Repercussão Geral e Informativos do STF.",
  },
  {
    category: "Jurisprudência Infraconstitucional",
    authority: "Superior Tribunal de Justiça (STJ — SCON)",
    url: "https://www.stj.jus.br/SCON/",
    description:
      "Súmulas do STJ, Recursos Repetitivos e Jurisprudência em Teses.",
  },
] as const;

const OFFICIAL_EXAM_SOURCES = [
  {
    track: "TJSP",
    title: "Escrevente Técnico Judiciário (TJSP2401 e TJSP2503)",
    board: "Fundação Vunesp",
    urls: [
      "https://www.vunesp.com.br/TJSP2401",
      "https://www.vunesp.com.br/TJSP2503",
    ],
  },
  {
    track: "PCSP",
    title: "Investigador (PCSP2304) e Escrivão de Polícia (PCSP2305)",
    board: "Fundação Vunesp",
    urls: [
      "https://www.vunesp.com.br/PCSP2304",
      "https://www.vunesp.com.br/PCSP2305",
    ],
  },
  {
    track: "PRF",
    title: "Policial Rodoviário Federal (Concurso PRF 2021)",
    board: "Cebraspe",
    urls: ["https://www.cebraspe.org.br/concursos/prf_21"],
  },
  {
    track: "OAB",
    title: "Exame de Ordem Unificado — 1ª Fase",
    board: "FGV Conhecimento",
    urls: ["https://conhecimento.fgv.br/exames"],
  },
] as const;

export default async function LegalAndExamSourcesPage() {
  await requireServerAuth();
  const catalog = await getAcademicCatalogMetadata();

  return (
    <div className="space-y-8">
      {/* Portais Jurídicos Prioritários */}
      <section className="bg-surface border border-border rounded-lg p-6 shadow-card space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-border">
          <div className="flex items-center gap-2">
            <Scale className="w-4 h-4 text-navy" />
            <h2 className="font-display text-sm font-semibold text-foreground">
              Portais Jurídicos Oficiais Prioritários
            </h2>
          </div>
          <span className="text-xs text-muted">
            Base obrigatória para auditoria de comentários
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {OFFICIAL_PORTALS.map((portal) => (
            <div
              key={portal.url}
              className="p-4 rounded-lg bg-background border border-border flex flex-col justify-between gap-3"
            >
              <div>
                <span className="px-2 py-0.5 rounded bg-surface border border-border text-[10px] font-semibold text-navy">
                  {portal.category}
                </span>
                <h3 className="font-display text-xs font-semibold text-foreground mt-2">
                  {portal.authority}
                </h3>
                <p className="text-xs text-muted mt-1 leading-relaxed">
                  {portal.description}
                </p>
              </div>
              <a
                href={portal.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs font-medium text-petrol hover:underline"
              >
                <span>{portal.url}</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          ))}
        </div>
      </section>

      {/* Dispositivos e Fontes Verificadas no Catálogo Interno */}
      <section className="bg-surface border border-border rounded-lg p-6 shadow-subtle space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-border">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-petrol" />
            <h3 className="font-display text-sm font-semibold text-foreground">
              Acervo Normativo Auditado para Explicações ({catalog.legalSources.length} diplomas)
            </h3>
          </div>
        </div>

        <div className="space-y-3">
          {catalog.legalSources.map((src) => (
            <div
              key={src.title}
              className="p-4 rounded-lg bg-background border border-border space-y-2.5"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <span className="font-display text-xs font-semibold text-foreground">
                    {src.title}
                  </span>
                  <span className="text-xs text-muted ml-2">
                    ({src.documentNumber} • {src.authority})
                  </span>
                </div>
                <a
                  href={src.officialUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-petrol hover:underline font-medium"
                >
                  <span>Texto Oficial Compilado</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>

              <div className="space-y-1.5 pt-1">
                {src.passages.map((p) => (
                  <div
                    key={p.referenceLabel}
                    className="p-2.5 rounded bg-surface border border-border text-xs"
                  >
                    <span className="font-semibold text-navy block mb-0.5">
                      {p.referenceLabel}
                    </span>
                    <p className="text-muted leading-relaxed">{p.content}</p>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Pontos de Partida Oficiais das Bancas Organizadoras */}
      <section className="bg-surface border border-border rounded-lg p-6 shadow-subtle space-y-4">
        <div className="flex items-center gap-2 pb-3 border-b border-border">
          <FileText className="w-4 h-4 text-navy" />
          <h3 className="font-display text-sm font-semibold text-foreground">
            Endereços Oficiais das Bancas para Obtenção e Conferência de Provas
          </h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {OFFICIAL_EXAM_SOURCES.map((item) => (
            <div
              key={item.track}
              className="p-4 rounded-lg bg-background border border-border space-y-2"
            >
              <div className="flex items-center justify-between">
                <span className="px-2 py-0.5 rounded bg-navy text-white text-[10px] font-semibold">
                  {item.track}
                </span>
                <span className="text-xs text-muted">{item.board}</span>
              </div>
              <h4 className="font-display text-xs font-semibold text-foreground">
                {item.title}
              </h4>
              <ul className="space-y-1 pt-1">
                {item.urls.map((u) => (
                  <li key={u}>
                    <a
                      href={u}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-petrol hover:underline"
                    >
                      <span>{u}</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
