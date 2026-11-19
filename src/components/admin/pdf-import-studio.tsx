"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  FileUp,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Eye,
  Rocket,
  Loader2,
  FileCheck2,
} from "lucide-react";

export type AdminEditionOption = {
  id: string;
  editionCode: string;
  title: string;
  trackCode: string;
  boardAcronym: string;
  examDate: string | null;
  officialNoticeUrl: string | null;
  forms: Array<{ id: string; versionLabel: string; isDefault: boolean }>;
};

export type ImportJobItemPreview = {
  id: string;
  originalNumber: number;
  detectedAnswerKey: string | null;
  validationStatus: string;
  validationErrorsJson: unknown;
  structuredPayloadJson: {
    statement?: string;
    options?: Array<{ label: string; content: string }>;
    isAnnulled?: boolean;
    subjectSlug?: string;
    pageNumber?: number;
  };
};

export type ImportJobSummary = {
  id: string;
  status: string;
  totalDetected: number;
  totalValidated: number;
  totalPublished: number;
  createdAt: string;
  editionCode: string;
  editionTitle: string;
  versionLabel: string;
  examDocTitle: string;
  examDocSha256: string;
  items: ImportJobItemPreview[];
};

export function PdfImportStudio({
  editions,
  initialJobs,
}: {
  editions: AdminEditionOption[];
  initialJobs: ImportJobSummary[];
}) {
  const router = useRouter();
  const [selectedEditionId, setSelectedEditionId] = useState<string>(
    editions[0]?.id ?? ""
  );
  const selectedEdition = useMemo(
    () => editions.find((e) => e.id === selectedEditionId) ?? editions[0],
    [editions, selectedEditionId]
  );

  const [selectedFormId, setSelectedFormId] = useState<string>(
    editions[0]?.forms.find((f) => f.isDefault)?.id ??
      editions[0]?.forms[0]?.id ??
      ""
  );
  const [questionType, setQuestionType] = useState<"MULTIPLE_CHOICE" | "TRUE_FALSE">(
    selectedEdition?.trackCode === "PRF" ? "TRUE_FALSE" : "MULTIPLE_CHOICE"
  );
  const [officialUrl, setOfficialUrl] = useState<string>(
    editions[0]?.officialNoticeUrl ?? ""
  );
  const [examFile, setExamFile] = useState<File | null>(null);
  const [keyFile, setKeyFile] = useState<File | null>(null);

  const [uploading, setUploading] = useState(false);
  const [publishingJobId, setPublishingJobId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  const [previewJob, setPreviewJob] = useState<ImportJobSummary | null>(null);
  const [expandedJobId, setExpandedJobId] = useState<string | null>(null);

  function handleEditionChange(editionId: string) {
    setSelectedEditionId(editionId);
    const ed = editions.find((e) => e.id === editionId);
    if (ed) {
      const defForm = ed.forms.find((f) => f.isDefault) ?? ed.forms[0];
      setSelectedFormId(defForm?.id ?? "");
      setQuestionType(ed.trackCode === "PRF" ? "TRUE_FALSE" : "MULTIPLE_CHOICE");
      setOfficialUrl(ed.officialNoticeUrl ?? "");
    }
  }

  async function handleUploadAndExtract(e: React.FormEvent) {
    e.preventDefault();
    if (!examFile || !keyFile || !selectedEditionId || !selectedFormId) {
      setFeedback({
        type: "error",
        message: "Selecione a prova, a versão do caderno e ambos os arquivos PDF.",
      });
      return;
    }

    setUploading(true);
    setFeedback(null);

    try {
      const fd = new FormData();
      fd.append("examEditionId", selectedEditionId);
      fd.append("examFormId", selectedFormId);
      fd.append("questionType", questionType);
      if (officialUrl.trim()) {
        fd.append("examPdfOfficialUrl", officialUrl.trim());
        fd.append("answerKeyOfficialUrl", officialUrl.trim());
      }
      fd.append("examPdf", examFile);
      fd.append("answerKeyPdf", keyFile);

      const res = await fetch("/api/admin/imports/upload", {
        method: "POST",
        body: fd,
      });
      const data = await res.json();

      if (!res.ok) {
        setFeedback({
          type: "error",
          message: data.message || "Falha ao extrair os arquivos PDF.",
        });
        return;
      }

      const j = data.job;
      const mapped: ImportJobSummary = {
        id: j.id,
        status: j.status,
        totalDetected: j.totalDetected,
        totalValidated: j.totalValidated,
        totalPublished: j.totalPublished,
        createdAt: j.createdAt,
        editionCode: j.examEdition.editionCode,
        editionTitle: j.examEdition.title,
        versionLabel: j.examForm.versionLabel,
        examDocTitle: j.examPdfDocument.title,
        examDocSha256: j.examPdfDocument.sha256,
        items: (j.items ?? []).map((it: ImportJobItemPreview) => ({
          id: it.id,
          originalNumber: it.originalNumber,
          detectedAnswerKey: it.detectedAnswerKey,
          validationStatus: it.validationStatus,
          validationErrorsJson: it.validationErrorsJson,
          structuredPayloadJson: it.structuredPayloadJson ?? {},
        })),
      };

      setPreviewJob(mapped);
      setFeedback({
        type: "success",
        message: data.idempotentReplay
          ? `Lote já extraído anteriormente (idempotência SHA-256). ${mapped.totalValidated}/${mapped.totalDetected} questões prontas para conferência.`
          : `Extração concluída: ${mapped.totalDetected} questões detectadas (${mapped.totalValidated} válidas). Confira a prévia abaixo antes de publicar.`,
      });
      router.refresh();
    } catch {
      setFeedback({
        type: "error",
        message: "Erro de conexão ao enviar os arquivos PDF.",
      });
    } finally {
      setUploading(false);
    }
  }

  async function handleApproveAndPublish(jobId: string) {
    setPublishingJobId(jobId);
    setFeedback(null);

    try {
      const res = await fetch(`/api/admin/imports/${jobId}/approve`, {
        method: "POST",
      });
      const data = await res.json();

      if (!res.ok) {
        setFeedback({
          type: "error",
          message: data.message || "Não foi possível publicar o lote.",
        });
        return;
      }

      setFeedback({
        type: "success",
        message: `Publicação concluída no Prisma Postgres: ${data.job?.totalPublished ?? 0} questões oficiais publicadas no acervo!`,
      });
      if (previewJob?.id === jobId) {
        setPreviewJob({
          ...previewJob,
          status: "PUBLISHED",
          totalPublished: data.job?.totalPublished ?? previewJob.totalValidated,
        });
      }
      router.refresh();
    } catch {
      setFeedback({
        type: "error",
        message: "Erro de conexão ao aprovar publicação.",
      });
    } finally {
      setPublishingJobId(null);
    }
  }

  return (
    <div className="space-y-8">
      {/* Formulário de Upload Direto de PDFs Oficiais */}
      <section className="bg-surface border border-border rounded-lg p-6 shadow-card space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-border">
          <div className="flex items-center gap-2">
            <FileUp className="w-4 h-4 text-navy" />
            <h2 className="font-display text-sm font-semibold text-foreground">
              Importar Prova Oficial e Gabarito Definitivo (Upload Direto de PDF)
            </h2>
          </div>
          <span className="text-[11px] text-muted">
            Sem terminal · SHA-256 automático · Prévia obrigatória antes de publicar
          </span>
        </div>

        <form onSubmit={handleUploadAndExtract} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <label
                htmlFor="examEditionId"
                className="text-xs font-medium text-foreground block"
              >
                Concurso / Edição Oficial
              </label>
              <select
                id="examEditionId"
                value={selectedEditionId}
                onChange={(e) => handleEditionChange(e.target.value)}
                className="w-full h-9 px-3 rounded-md border border-border bg-background text-xs text-foreground"
              >
                {editions.map((ed) => (
                  <option key={ed.id} value={ed.id}>
                    [{ed.trackCode}] {ed.editionCode} — {ed.examDate ?? "S/D"}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="examFormId"
                className="text-xs font-medium text-foreground block"
              >
                Versão do Caderno
              </label>
              <select
                id="examFormId"
                value={selectedFormId}
                onChange={(e) => setSelectedFormId(e.target.value)}
                className="w-full h-9 px-3 rounded-md border border-border bg-background text-xs text-foreground"
              >
                {(selectedEdition?.forms ?? []).map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.versionLabel} {f.isDefault ? "(Padrão)" : ""}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="questionType"
                className="text-xs font-medium text-foreground block"
              >
                Formato da Prova
              </label>
              <select
                id="questionType"
                value={questionType}
                onChange={(e) =>
                  setQuestionType(
                    e.target.value as "MULTIPLE_CHOICE" | "TRUE_FALSE"
                  )
                }
                className="w-full h-9 px-3 rounded-md border border-border bg-background text-xs text-foreground"
              >
                <option value="MULTIPLE_CHOICE">
                  Múltipla Escolha (Vunesp A–E / FGV A–D)
                </option>
                <option value="TRUE_FALSE">
                  Certo / Errado (Cebraspe PRF)
                </option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 rounded-lg border border-dashed border-border bg-background space-y-2">
              <label
                htmlFor="examPdf"
                className="text-xs font-semibold text-foreground block"
              >
                1. PDF do Caderno de Prova Oficial (.pdf)
              </label>
              <input
                id="examPdf"
                type="file"
                accept="application/pdf,.pdf"
                onChange={(e) => setExamFile(e.target.files?.[0] ?? null)}
                className="w-full text-xs text-muted file:mr-3 file:py-1.5 file:px-3 file:rounded file:border-0 file:text-xs file:font-medium file:bg-navy file:text-white hover:file:bg-navy-light cursor-pointer"
              />
              {examFile && (
                <p className="text-[11px] text-semantic-success font-medium">
                  Selecionado: {examFile.name} ({Math.round(examFile.size / 1024)} KB)
                </p>
              )}
            </div>

            <div className="p-4 rounded-lg border border-dashed border-border bg-background space-y-2">
              <label
                htmlFor="answerKeyPdf"
                className="text-xs font-semibold text-foreground block"
              >
                2. PDF do Gabarito Oficial Definitivo (.pdf)
              </label>
              <input
                id="answerKeyPdf"
                type="file"
                accept="application/pdf,.pdf"
                onChange={(e) => setKeyFile(e.target.files?.[0] ?? null)}
                className="w-full text-xs text-muted file:mr-3 file:py-1.5 file:px-3 file:rounded file:border-0 file:text-xs file:font-medium file:bg-petrol file:text-white hover:file:opacity-90 cursor-pointer"
              />
              {keyFile && (
                <p className="text-[11px] text-semantic-success font-medium">
                  Selecionado: {keyFile.name} ({Math.round(keyFile.size / 1024)} KB)
                </p>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-end justify-between gap-4">
            <div className="flex-1 min-w-[260px] space-y-1.5">
              <label
                htmlFor="officialUrl"
                className="text-xs font-medium text-foreground block"
              >
                URL Oficial da Banca (opcional — referência documental)
              </label>
              <input
                id="officialUrl"
                type="url"
                value={officialUrl}
                onChange={(e) => setOfficialUrl(e.target.value)}
                placeholder="https://www.vunesp.com.br/TJSP2401"
                className="w-full h-9 px-3 rounded-md border border-border bg-background text-xs text-foreground"
              />
            </div>

            <button
              type="submit"
              disabled={uploading || !examFile || !keyFile}
              className="h-9 px-5 rounded-md bg-navy hover:bg-navy-light disabled:opacity-50 text-white text-xs font-semibold inline-flex items-center gap-2 transition-colors"
            >
              {uploading ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Extraindo PDFs e conferindo gabarito...</span>
                </>
              ) : (
                <>
                  <FileCheck2 className="w-3.5 h-3.5" />
                  <span>Enviar PDFs e Gerar Prévia</span>
                </>
              )}
            </button>
          </div>
        </form>

        {feedback && (
          <div
            className={`p-3.5 rounded-md border text-xs flex items-start gap-2 ${
              feedback.type === "success"
                ? "bg-semantic-success-bg border-semantic-success/30 text-foreground"
                : "bg-semantic-error-bg border-semantic-error/30 text-foreground"
            }`}
          >
            {feedback.type === "success" ? (
              <CheckCircle2 className="w-4 h-4 text-semantic-success shrink-0 mt-0.5" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-semantic-error shrink-0 mt-0.5" />
            )}
            <span>{feedback.message}</span>
          </div>
        )}
      </section>

      {/* Prévia Interativa das Questões Extraídas + Botão de Aprovação */}
      {previewJob && (
        <section className="bg-surface border-2 border-navy/30 rounded-lg p-6 shadow-card space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-border">
            <div>
              <h3 className="font-display text-sm font-semibold text-foreground">
                Prévia de Conferência — {previewJob.editionCode} ({previewJob.versionLabel})
              </h3>
              <p className="text-[11px] text-muted mt-0.5">
                SHA-256: <span className="font-mono">{previewJob.examDocSha256.slice(0, 20)}…</span>{" "}
                · {previewJob.totalValidated}/{previewJob.totalDetected} questões válidas · Status:{" "}
                <strong className="text-foreground">{previewJob.status}</strong>
              </p>
            </div>

            {previewJob.status !== "PUBLISHED" && (
              <button
                type="button"
                disabled={publishingJobId === previewJob.id || previewJob.totalValidated === 0}
                onClick={() => handleApproveAndPublish(previewJob.id)}
                className="h-9 px-5 rounded-md bg-semantic-success hover:opacity-90 disabled:opacity-50 text-white text-xs font-semibold inline-flex items-center gap-2"
              >
                {publishingJobId === previewJob.id ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Publicando no Prisma Postgres...</span>
                  </>
                ) : (
                  <>
                    <Rocket className="w-3.5 h-3.5" />
                    <span>
                      Aprovar e Publicar ({previewJob.totalValidated} questões)
                    </span>
                  </>
                )}
              </button>
            )}
          </div>

          <div className="max-h-[460px] overflow-y-auto space-y-3 pr-1">
            {previewJob.items.map((item) => {
              const payload = item.structuredPayloadJson ?? {};
              const isValid = item.validationStatus === "VERIFIED";
              const errors = Array.isArray(item.validationErrorsJson)
                ? (item.validationErrorsJson as Array<{ message?: string }>)
                : [];

              return (
                <div
                  key={item.id}
                  className={`p-3.5 rounded-lg border text-xs space-y-2 ${
                    isValid
                      ? "bg-background border-border"
                      : "bg-semantic-error-bg/40 border-semantic-error/40"
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded bg-navy text-white font-semibold text-[11px]">
                        #{item.originalNumber}
                      </span>
                      <span className="px-2 py-0.5 rounded bg-surface border border-border font-semibold text-[11px]">
                        Gabarito: {item.detectedAnswerKey || "AUSENTE"}
                      </span>
                      {payload.isAnnulled && (
                        <span className="px-2 py-0.5 rounded bg-semantic-warning-bg text-semantic-warning font-semibold text-[10px]">
                          ANULADA
                        </span>
                      )}
                      {payload.pageNumber && (
                        <span className="text-[11px] text-muted">
                          Pág. {payload.pageNumber}
                        </span>
                      )}
                    </div>

                    {isValid ? (
                      <span className="inline-flex items-center gap-1 text-semantic-success font-semibold text-[11px]">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Válida
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-semantic-error font-semibold text-[11px]">
                        <XCircle className="w-3.5 h-3.5" />
                        Rejeitada
                      </span>
                    )}
                  </div>

                  <p className="text-foreground leading-relaxed">
                    {payload.statement?.slice(0, 320)}
                    {(payload.statement?.length ?? 0) > 320 ? "…" : ""}
                  </p>

                  {payload.options && payload.options.length > 0 && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 pt-1">
                      {payload.options.map((opt) => (
                        <div
                          key={opt.label}
                          className={`px-2.5 py-1 rounded border text-[11px] ${
                            item.detectedAnswerKey === opt.label
                              ? "bg-semantic-success-bg border-semantic-success/40 font-semibold text-foreground"
                              : "bg-surface border-border text-muted"
                          }`}
                        >
                          <strong>({opt.label})</strong> {opt.content.slice(0, 120)}
                          {opt.content.length > 120 ? "…" : ""}
                        </div>
                      ))}
                    </div>
                  )}

                  {errors.length > 0 && (
                    <div className="text-[11px] text-semantic-error pt-1">
                      {errors.map((err, i) => (
                        <div key={i}>• {err.message}</div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Lista de Jobs Registrados com Ação de Prévia e Aprovação */}
      <section className="bg-surface border border-border rounded-lg p-6 shadow-subtle space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-border">
          <h3 className="font-display text-sm font-semibold text-foreground">
            Jobs de Importação e Curadoria ({initialJobs.length})
          </h3>
        </div>

        {initialJobs.length === 0 ? (
          <p className="text-xs text-muted py-6 text-center">
            Nenhum job de importação registrado no banco ainda.
          </p>
        ) : (
          <div className="space-y-3">
            {initialJobs.map((job) => {
              const isExpanded = expandedJobId === job.id;
              return (
                <div
                  key={job.id}
                  className="p-4 rounded-lg bg-background border border-border space-y-3"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <span className="font-display text-xs font-semibold text-foreground">
                        {job.editionTitle} — {job.versionLabel}
                      </span>
                      <span className="block text-[11px] text-muted">
                        Documento: {job.examDocTitle} (SHA-256:{" "}
                        {job.examDocSha256.slice(0, 16)}…)
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <span className="px-2.5 py-0.5 rounded bg-navy text-white text-[11px] font-semibold">
                        {job.status} ({job.totalValidated}/{job.totalDetected} válidas •{" "}
                        {job.totalPublished} publicadas)
                      </span>

                      <button
                        type="button"
                        onClick={() =>
                          setExpandedJobId(isExpanded ? null : job.id)
                        }
                        className="h-7 px-2.5 rounded border border-border bg-surface text-[11px] font-medium text-foreground inline-flex items-center gap-1 hover:border-navy"
                      >
                        <Eye className="w-3 h-3" />
                        <span>{isExpanded ? "Ocultar prévia" : "Ver prévia"}</span>
                      </button>

                      {job.status !== "PUBLISHED" && job.totalValidated > 0 && (
                        <button
                          type="button"
                          disabled={publishingJobId === job.id}
                          onClick={() => handleApproveAndPublish(job.id)}
                          className="h-7 px-3 rounded bg-semantic-success text-white text-[11px] font-semibold inline-flex items-center gap-1 hover:opacity-90 disabled:opacity-50"
                        >
                          <Rocket className="w-3 h-3" />
                          <span>Aprovar e Publicar</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {isExpanded && job.items.length > 0 && (
                    <div className="pt-2 border-t border-border space-y-2 max-h-64 overflow-y-auto">
                      {job.items.slice(0, 15).map((it) => (
                        <div
                          key={it.id}
                          className="text-[11px] flex items-center justify-between gap-2 py-1 border-b border-border/50 last:border-0"
                        >
                          <span className="truncate text-foreground">
                            <strong>#{it.originalNumber}</strong>{" "}
                            {it.structuredPayloadJson?.statement?.slice(0, 110) ?? ""}
                          </span>
                          <span className="shrink-0 font-semibold text-muted">
                            Gab: {it.detectedAnswerKey ?? "-"} ({it.validationStatus})
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
