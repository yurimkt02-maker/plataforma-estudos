import Link from "next/link";
import {
  Database,
  CheckCircle2,
  Clock,
  XCircle,
  BookOpenCheck,
  FileCheck2,
  AlertTriangle,
  History,
  FileText,
  Scale,
  Layers,
} from "lucide-react";
import { requireAdminAuth } from "@/lib/auth/session";
import { getAdminInventoryMetrics } from "@/features/imports/admin-metrics";

export default async function AdminInventoryDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ track?: string; year?: string; status?: string }>;
}) {
  await requireAdminAuth();
  const params = await searchParams;
  const metrics = await getAdminInventoryMetrics();

  const filterTrack = (params.track ?? "").toUpperCase();
  const filterYear = params.year ?? "";
  const filterStatus = (params.status ?? "").toUpperCase();

  // Progresso real da meta OAB 2023–2026 (11 edições / 880 itens)
  const oab2326Exams = metrics.byExam.filter(
    (e) =>
      e.trackCode === "OAB" &&
      e.examDate !== null &&
      Number(e.examDate.slice(0, 4)) >= 2023 &&
      Number(e.examDate.slice(0, 4)) <= 2026
  );
  const oabPublished = oab2326Exams.reduce((acc, e) => acc + e.publishedQuestions, 0);
  const oabPending = oab2326Exams.reduce((acc, e) => acc + e.awaitingReviewQuestions, 0);
  const oabCompleteEditions = oab2326Exams.filter(
    (e) => e.completenessStatus === "COMPLETE"
  ).length;
  const oabGoalTotal = 880;
  const oabGoalEditions = 11;
  const oabPercent = Math.min(100, Number(((oabPublished / oabGoalTotal) * 100).toFixed(1)));

  const filteredExams = metrics.byExam.filter((ex) => {
    if (filterTrack && ex.trackCode !== filterTrack) return false;
    if (filterYear && !(ex.examDate ?? "").startsWith(filterYear)) return false;
    if (filterStatus && ex.completenessStatus !== filterStatus) return false;
    return true;
  });

  return (
    <div className="space-y-8">
      {/* Cabeçalho e KPIs reais do Prisma Postgres */}
      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-lg font-semibold text-foreground">
              Painel Administrativo de Qualidade do Acervo
            </h2>
            <p className="text-xs text-muted mt-0.5">
              Indicadores em tempo real consultados diretamente no Prisma Postgres (plataforma-estudos-db)
            </p>
          </div>
          <Link
            href="/admin/importacoes"
            className="h-9 px-4 rounded-md bg-navy hover:bg-navy-light text-white text-xs font-medium inline-flex items-center gap-1.5"
          >
            <span>Nova Importação (PDF)</span>
          </Link>
        </div>

        {/* Linha 1 de KPIs */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-surface border border-border rounded-lg p-5 shadow-subtle">
            <div className="flex items-center justify-between text-muted mb-2">
              <span className="text-xs font-medium">Questões Publicadas</span>
              <BookOpenCheck className="w-4 h-4 text-navy" />
            </div>
            <div className="font-display text-2xl font-semibold text-foreground">
              {metrics.totals.publishedQuestions}
            </div>
            <p className="text-[11px] text-muted mt-1">
              {metrics.totals.completeExamsCount} prova(s) completa(s) ·{" "}
              {metrics.totals.partialExamsCount} parcial(is)
            </p>
          </div>

          <div className="bg-surface border border-border rounded-lg p-5 shadow-subtle">
            <div className="flex items-center justify-between text-muted mb-2">
              <span className="text-xs font-medium">Gabaritos Validados</span>
              <FileCheck2 className="w-4 h-4 text-semantic-success" />
            </div>
            <div className="font-display text-2xl font-semibold text-foreground">
              {metrics.totals.validatedAnswerKeysCount}
            </div>
            <p className="text-[11px] text-muted mt-1">
              {metrics.totals.annulledQuestionsCount} anulada(s) ·{" "}
              {metrics.totals.divergentAnswerKeysCount} divergência(s) auditada(s)
            </p>
          </div>

          <div className="bg-surface border border-border rounded-lg p-5 shadow-subtle">
            <div className="flex items-center justify-between text-muted mb-2">
              <span className="text-xs font-medium">Aguardando Validação</span>
              <Clock className="w-4 h-4 text-semantic-warning" />
            </div>
            <div className="font-display text-2xl font-semibold text-foreground">
              {metrics.totals.awaitingReviewQuestions}
            </div>
            <p className="text-[11px] text-muted mt-1">
              Sem disciplina: {metrics.totals.questionsWithoutDisciplineCount} ·
              Rejeitadas: {metrics.totals.rejectedImportItems}
            </p>
          </div>

          <div className="bg-surface border border-border rounded-lg p-5 shadow-subtle">
            <div className="flex items-center justify-between text-muted mb-2">
              <span className="text-xs font-medium">Verificação Jurídica</span>
              <Scale className="w-4 h-4 text-navy" />
            </div>
            <div className="font-display text-2xl font-semibold text-foreground">
              {metrics.totals.verifiedExplanationsCount} /{" "}
              {metrics.totals.verifiedExplanationsCount +
                metrics.totals.pendingExplanationsCount}
            </div>
            <p className="text-[11px] text-muted mt-1">
              Fontes jurídicas ativas: {metrics.totals.verifiedLegalSourcesCount} ·
              Pendentes: {metrics.totals.pendingExplanationsCount}
            </p>
          </div>
        </div>
      </section>

      {/* Progresso da Expansão — Meta OAB 2023–2026 (880 itens / 11 edições) */}
      <section className="bg-surface border border-border rounded-lg p-6 shadow-card space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-border">
          <div>
            <h3 className="font-display text-sm font-semibold text-foreground">
              Progresso da Expansão — OAB 1ª Fase (2023–2026)
            </h3>
            <p className="text-[11px] text-muted">
              Acompanhamento em tempo real no Prisma Postgres (37º ao 47º Exames · Meta: {oabGoalTotal} itens)
            </p>
          </div>
          <span className="px-2.5 py-1 rounded bg-navy text-white text-xs font-semibold">
            {oabPublished} / {oabGoalTotal} ({oabPercent}%)
          </span>
        </div>

        <div className="w-full h-2.5 rounded-full bg-border overflow-hidden">
          <div
            className="h-full bg-semantic-success transition-all"
            style={{ width: `${oabPercent}%` }}
          />
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-xs">
          <div className="p-3 rounded bg-background border border-border">
            <span className="text-muted block text-[11px]">Meta 2023–2026</span>
            <strong className="font-display text-base text-foreground">{oabGoalTotal} itens</strong>
          </div>
          <div className="p-3 rounded bg-background border border-border">
            <span className="text-muted block text-[11px]">Publicados</span>
            <strong className="font-display text-base text-semantic-success">{oabPublished}</strong>
          </div>
          <div className="p-3 rounded bg-background border border-border">
            <span className="text-muted block text-[11px]">Em Revisão</span>
            <strong className="font-display text-base text-semantic-warning">{oabPending}</strong>
          </div>
          <div className="p-3 rounded bg-background border border-border">
            <span className="text-muted block text-[11px]">Edições Completas</span>
            <strong className="font-display text-base text-foreground">
              {oabCompleteEditions} / {oabGoalEditions}
            </strong>
          </div>
          <div className="p-3 rounded bg-background border border-border">
            <span className="text-muted block text-[11px]">Edições Restantes</span>
            <strong className="font-display text-base text-foreground">
              {Math.max(0, oabGoalEditions - oabCompleteEditions)}
            </strong>
          </div>
        </div>
      </section>

      {/* Provas Completas vs Parciais e Percentual de Extração com Filtros */}
      <section className="bg-surface border border-border rounded-lg p-6 shadow-card space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-border">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-navy" />
            <h3 className="font-display text-sm font-semibold text-foreground">
              Completude por Prova Oficial ({filteredExams.length} exibidas)
            </h3>
          </div>
          <form method="GET" className="flex flex-wrap items-center gap-2 text-xs">
            <select
              name="track"
              defaultValue={filterTrack}
              className="h-8 px-2 rounded border border-border bg-background text-xs"
            >
              <option value="">Todas Carreiras</option>
              <option value="OAB">OAB</option>
              <option value="PRF">PRF</option>
              <option value="TJSP">TJSP</option>
              <option value="PCSP">PCSP</option>
            </select>
            <select
              name="year"
              defaultValue={filterYear}
              className="h-8 px-2 rounded border border-border bg-background text-xs"
            >
              <option value="">Todos Anos</option>
              <option value="2026">2026</option>
              <option value="2025">2025</option>
              <option value="2024">2024</option>
              <option value="2023">2023</option>
              <option value="2021">2021</option>
              <option value="2019">2019</option>
            </select>
            <select
              name="status"
              defaultValue={filterStatus}
              className="h-8 px-2 rounded border border-border bg-background text-xs"
            >
              <option value="">Todos Status</option>
              <option value="COMPLETE">Completas</option>
              <option value="PARTIAL">Parciais</option>
              <option value="EMPTY">Aguardando PDF</option>
            </select>
            <button
              type="submit"
              className="h-8 px-3 rounded bg-navy text-white text-xs font-medium"
            >
              Filtrar
            </button>
          </form>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-border text-muted">
                <th className="py-2 pr-3 font-medium">Edição / Data</th>
                <th className="py-2 px-3 font-medium">Status</th>
                <th className="py-2 px-3 font-medium">Extração</th>
                <th className="py-2 px-3 font-medium">Publicadas</th>
                <th className="py-2 px-3 font-medium">Em Revisão</th>
                <th className="py-2 px-3 font-medium">Anuladas</th>
                <th className="py-2 pl-3 font-medium">PDFs Oficiais</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filteredExams.map((ex) => (
                <tr key={ex.editionId}>
                  <td className="py-2.5 pr-3">
                    <span className="font-semibold text-foreground block">
                      {ex.editionCode}
                    </span>
                    <span className="text-[11px] text-muted block truncate max-w-md">
                      {ex.title} {ex.examDate ? `(${ex.examDate})` : ""}
                    </span>
                  </td>
                  <td className="py-2.5 px-3">
                    {ex.completenessStatus === "COMPLETE" ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-semantic-success-bg text-semantic-success font-semibold text-[10px]">
                        <CheckCircle2 className="w-3 h-3" />
                        COMPLETA
                      </span>
                    ) : ex.completenessStatus === "PARTIAL" ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-semantic-warning-bg text-semantic-warning font-semibold text-[10px]">
                        <Clock className="w-3 h-3" />
                        PARCIAL
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-background border border-border text-muted font-semibold text-[10px]">
                        AGUARDANDO PDF
                      </span>
                    )}
                  </td>
                  <td className="py-2.5 px-3">
                    <div className="flex items-center gap-2">
                      <div className="w-20 h-1.5 rounded-full bg-border overflow-hidden">
                        <div
                          className={`h-full ${
                            ex.extractionPercent >= 100
                              ? "bg-semantic-success"
                              : "bg-navy"
                          }`}
                          style={{ width: `${ex.extractionPercent}%` }}
                        />
                      </div>
                      <span className="font-semibold text-foreground">
                        {ex.importedQuestions}/{ex.expectedQuestions} ({ex.extractionPercent}%)
                      </span>
                    </div>
                  </td>
                  <td className="py-2.5 px-3 font-semibold text-foreground">
                    {ex.publishedQuestions}
                  </td>
                  <td className="py-2.5 px-3 text-semantic-warning font-medium">
                    {ex.awaitingReviewQuestions}
                  </td>
                  <td className="py-2.5 px-3 text-muted">{ex.annulledCount}</td>
                  <td className="py-2.5 pl-3 text-[11px]">
                    {ex.verifiedSourceDocsCount > 0 ? (
                      <span className="text-semantic-success font-medium">
                        {ex.verifiedSourceDocsCount} verificado(s)
                      </span>
                    ) : ex.pendingSourceDocsCount > 0 ? (
                      <span className="text-semantic-warning font-medium">
                        {ex.pendingSourceDocsCount} pendente(s)
                      </span>
                    ) : (
                      <span className="text-muted">Nenhum PDF</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Distribuição por Concurso / Carreira */}
      <section className="bg-surface border border-border rounded-lg p-6 shadow-subtle space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-border">
          <div className="flex items-center gap-2">
            <Database className="w-4 h-4 text-navy" />
            <h3 className="font-display text-sm font-semibold text-foreground">
              Questões por Concurso / Carreira
            </h3>
          </div>
          <span className="text-xs text-muted">
            Sem duplicação entre versões de caderno
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {metrics.byTrack.map((t) => (
            <div
              key={t.trackCode}
              className="p-4 rounded-lg bg-background border border-border space-y-1.5"
            >
              <div className="flex items-center justify-between">
                <span className="px-2 py-0.5 rounded bg-navy text-white text-[10px] font-semibold">
                  {t.trackCode}
                </span>
                <span className="text-[11px] text-muted">
                  {t.examEditionsWithQuestions} prova(s)
                </span>
              </div>
              <div className="font-display text-xl font-semibold text-foreground pt-1">
                {t.publishedQuestions} publicadas
              </div>
              <p className="text-[11px] text-muted">
                {t.awaitingReviewQuestions} aguardando revisão · {t.trackName}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Documentos de Origem (Proveniência SHA-256) */}
      <section className="bg-surface border border-border rounded-lg p-6 shadow-subtle space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-border">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-navy" />
            <h3 className="font-display text-sm font-semibold text-foreground">
              Documentos de Origem e Integridade SHA-256 ({metrics.sourceDocuments.length})
            </h3>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-border text-muted">
                <th className="py-2 pr-3 font-medium">Documento</th>
                <th className="py-2 px-3 font-medium">Edição</th>
                <th className="py-2 px-3 font-medium">Verificação</th>
                <th className="py-2 px-3 font-medium">SHA-256</th>
                <th className="py-2 pl-3 font-medium text-right">Vínculos</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {metrics.sourceDocuments.map((doc) => (
                <tr key={doc.id}>
                  <td className="py-2.5 pr-3">
                    <span className="font-medium text-foreground block">
                      {doc.title}
                    </span>
                    <span className="text-[11px] text-muted block truncate max-w-md">
                      {doc.officialUrl}
                    </span>
                  </td>
                  <td className="py-2.5 px-3 text-muted">{doc.editionCode}</td>
                  <td className="py-2.5 px-3">
                    {doc.verificationStatus === "VERIFIED" ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-semantic-success-bg text-semantic-success font-semibold text-[10px]">
                        <CheckCircle2 className="w-3 h-3" />
                        VERIFIED
                      </span>
                    ) : doc.verificationStatus === "REJECTED" ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-semantic-error-bg text-semantic-error font-semibold text-[10px]">
                        <XCircle className="w-3 h-3" />
                        REJECTED
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-semantic-warning-bg text-semantic-warning font-semibold text-[10px]">
                        <Clock className="w-3 h-3" />
                        {doc.verificationStatus}
                      </span>
                    )}
                  </td>
                  <td className="py-2.5 px-3 font-mono text-[11px] text-muted">
                    {doc.sha256Prefix}…
                  </td>
                  <td className="py-2.5 pl-3 text-right text-muted">
                    {doc.linkedQuestions} q. / {doc.linkedAnswerKeys} gab.
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Distribuição por Disciplina / Assunto */}
      <section className="bg-surface border border-border rounded-lg p-6 shadow-subtle space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-border">
          <h3 className="font-display text-sm font-semibold text-foreground">
            Quantidade de Questões Publicadas por Disciplina e Assunto ({metrics.bySubject.length})
          </h3>
        </div>

        {metrics.bySubject.length === 0 ? (
          <p className="text-xs text-muted py-4">
            Nenhuma questão publicada associada a disciplinas ainda.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-border text-muted">
                  <th className="py-2 pr-4 font-medium">Disciplina / Assunto</th>
                  <th className="py-2 px-3 font-medium">Área Pai</th>
                  <th className="py-2 pl-3 font-medium text-right">Questões Publicadas</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {metrics.bySubject.map((subj) => (
                  <tr key={subj.subjectId}>
                    <td className="py-2.5 pr-4 font-medium text-foreground">
                      {subj.subjectName}
                    </td>
                    <td className="py-2.5 px-3 text-muted">
                      {subj.parentName ?? "Disciplina Principal"}
                    </td>
                    <td className="py-2.5 pl-3 text-right font-semibold text-foreground">
                      {subj.questionCount}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Histórico de Importações e Erros */}
      <section className="bg-surface border border-border rounded-lg p-6 shadow-subtle space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-border">
          <div className="flex items-center gap-2">
            <History className="w-4 h-4 text-navy" />
            <h3 className="font-display text-sm font-semibold text-foreground">
              Histórico de Importações e Logs de Erro ({metrics.importHistory.length})
            </h3>
          </div>
        </div>

        {metrics.importHistory.length === 0 ? (
          <p className="text-xs text-muted py-4">
            Nenhum job de importação executado ainda.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-border text-muted">
                  <th className="py-2 pr-3 font-medium">Edição / Caderno</th>
                  <th className="py-2 px-3 font-medium">Status</th>
                  <th className="py-2 px-3 font-medium">Extraídas</th>
                  <th className="py-2 px-3 font-medium">Validadas</th>
                  <th className="py-2 px-3 font-medium">Rejeitadas</th>
                  <th className="py-2 px-3 font-medium">Publicadas</th>
                  <th className="py-2 pl-3 font-medium">Erros / Observações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {metrics.importHistory.map((job) => (
                  <tr key={job.id}>
                    <td className="py-2.5 pr-3">
                      <span className="font-semibold text-foreground block">
                        {job.editionCode} ({job.versionLabel})
                      </span>
                      <span className="text-[11px] text-muted">
                        {new Date(job.createdAt).toLocaleString("pt-BR")}
                      </span>
                    </td>
                    <td className="py-2.5 px-3">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded font-semibold text-[10px] ${
                          job.status === "PUBLISHED"
                            ? "bg-semantic-success-bg text-semantic-success"
                            : "bg-semantic-warning-bg text-semantic-warning"
                        }`}
                      >
                        {job.status === "PUBLISHED" ? (
                          <CheckCircle2 className="w-3 h-3" />
                        ) : (
                          <Clock className="w-3 h-3" />
                        )}
                        {job.status}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-foreground">{job.totalDetected}</td>
                    <td className="py-2.5 px-3 text-semantic-success font-medium">
                      {job.totalValidated}
                    </td>
                    <td className="py-2.5 px-3 text-semantic-error font-medium">
                      {job.rejectedCount}
                    </td>
                    <td className="py-2.5 px-3 font-semibold text-foreground">
                      {job.totalPublished}
                    </td>
                    <td className="py-2.5 pl-3 text-muted">
                      {job.errorMessage ? (
                        <span className="inline-flex items-center gap-1 text-semantic-error">
                          <AlertTriangle className="w-3 h-3" />
                          {job.errorMessage}
                        </span>
                      ) : (
                        "Sem erros"
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
