import { FileUp, Terminal, CheckCircle2, ShieldAlert } from "lucide-react";
import { requireAdminAuth } from "@/lib/auth/session";
import { isDatabaseConfigured, prisma } from "@/lib/db/prisma";

const PIPELINE_STEPS = [
  "1. Seleção de Concurso, Prova, Versão do Caderno e Gabarito Definitivo",
  "2. Cálculo de Hash SHA-256 e verificação de idempotência (evita duplicação)",
  "3. Extração estruturada com Python + PyMuPDF (scripts/imports/extract_pdf_exam.py)",
  "4. Separação de número original, texto-base, enunciado, alternativas e figuras",
  "5. Associação estrita ao gabarito da mesma versão de caderno (ExamForm)",
  "6. Validação lado a lado (rejeita enunciados truncados ou opções faltantes)",
  "7. Aprovação e Publicação Transacional no Prisma Postgres",
] as const;

export default async function AdminImportsPage() {
  await requireAdminAuth();
  const dbConnected = isDatabaseConfigured();

  const jobs = dbConnected
    ? await prisma.importJob.findMany({
        include: {
          examEdition: true,
          examForm: true,
          examPdfDocument: true,
          items: { orderBy: { originalNumber: "asc" }, take: 20 },
        },
        orderBy: { createdAt: "desc" },
        take: 15,
      })
    : [];

  return (
    <div className="space-y-8">
      {/* Guia do Pipeline de Extração Local + Validação no Servidor */}
      <section className="bg-surface border border-border rounded-lg p-6 shadow-card space-y-5">
        <div className="flex items-center justify-between pb-3 border-b border-border">
          <div className="flex items-center gap-2">
            <FileUp className="w-4 h-4 text-navy" />
            <h2 className="font-display text-sm font-semibold text-foreground">
              Pipeline de Importação de Provas Reais (PyMuPDF → Prisma Postgres)
            </h2>
          </div>
          <span className="text-xs text-muted">
            Estados: PENDING → EXTRACTING → STRUCTURED → AWAITING_REVIEW → APPROVED → PUBLISHED
          </span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="space-y-2.5">
            <h3 className="font-display text-xs font-semibold uppercase tracking-wider text-muted">
              Etapas Obrigatórias de Qualidade (Seção 7.2 e 9.5)
            </h3>
            <ul className="space-y-1.5 text-xs text-foreground">
              {PIPELINE_STEPS.map((step) => (
                <li
                  key={step}
                  className="p-2.5 rounded bg-background border border-border flex items-center gap-2"
                >
                  <CheckCircle2 className="w-3.5 h-3.5 text-petrol shrink-0" />
                  <span>{step}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="space-y-3">
            <h3 className="font-display text-xs font-semibold uppercase tracking-wider text-muted flex items-center gap-1.5">
              <Terminal className="w-3.5 h-3.5 text-navy" />
              <span>Extrator Administrativo Local (PyMuPDF)</span>
            </h3>
            <p className="text-xs text-muted leading-relaxed">
              Para processar PDFs oficiais complexos sem sobrecarregar o tempo
              de requisição HTTP das Vercel Functions, execute o extrator Python
              auditável e envie o pacote JSON validado para{" "}
              <code className="font-mono text-foreground">
                POST /api/admin/imports
              </code>
              :
            </p>
            <pre className="p-3.5 rounded-md bg-navy-dark text-white font-mono text-[11px] overflow-x-auto leading-relaxed">
{`python scripts/imports/extract_pdf_exam.py \\
  --exam-pdf ./acervo/tjsp_2024_v1.pdf \\
  --answer-key-pdf ./acervo/tjsp_2024_gabarito_definitivo.pdf \\
  --edition-code TJSP-2024-ESCREVENTE \\
  --version-label "Versão 1" \\
  --question-type MULTIPLE_CHOICE \\
  --exam-url "https://www.vunesp.com.br/TJSP2401" \\
  --answer-key-url "https://www.vunesp.com.br/TJSP2401" \\
  --output import_tjsp2024.json`}
            </pre>
            <div className="p-3 rounded-md bg-semantic-warning-bg border border-semantic-warning/30 flex items-start gap-2 text-xs text-foreground">
              <ShieldAlert className="w-4 h-4 text-semantic-warning shrink-0 mt-0.5" />
              <span>
                Garantia ativa: o validador recusa automaticamente qualquer
                questão com enunciado incompleto, alternativas faltantes, versão
                de prova indefinida ou sem hash SHA-256 do documento de origem.
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* Jobs de Importação Registrados */}
      <section className="bg-surface border border-border rounded-lg p-6 shadow-subtle space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-border">
          <h3 className="font-display text-sm font-semibold text-foreground">
            Jobs de Importação e Curadoria ({jobs.length})
          </h3>
        </div>

        {jobs.length === 0 ? (
          <p className="text-xs text-muted py-6 text-center">
            Nenhum job de importação registrado no banco ainda. Utilize o
            extrator acima ou envie o payload para{" "}
            <code className="font-mono text-foreground">
              POST /api/admin/imports
            </code>
            .
          </p>
        ) : (
          <div className="space-y-4">
            {jobs.map((job) => (
              <div
                key={job.id}
                className="p-4 rounded-lg bg-background border border-border space-y-3"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <span className="font-display text-xs font-semibold text-foreground">
                      {job.examEdition.title} — {job.examForm.versionLabel}
                    </span>
                    <span className="block text-[11px] text-muted">
                      Documento: {job.examPdfDocument.title} (SHA-256:{" "}
                      {job.examPdfDocument.sha256.slice(0, 16)}...)
                    </span>
                  </div>
                  <span className="px-2.5 py-0.5 rounded bg-navy text-white text-[11px] font-semibold">
                    {job.status} ({job.totalValidated}/{job.totalDetected} válidos •{" "}
                    {job.totalPublished} publicados)
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
