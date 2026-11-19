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
  FileText,
  Pencil,
  ShieldCheck,
  ChevronLeft,
  ChevronRight,
  Lock,
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

export type AdminSubjectOption = {
  slug: string;
  name: string;
  parentName: string | null;
};

export type ImportJobItemPreview = {
  id: string;
  originalNumber: number;
  detectedAnswerKey: string | null;
  validationStatus: string;
  reviewedAt: string | null;
  validationErrorsJson: unknown;
  structuredPayloadJson: {
    statement?: string;
    supportText?: string;
    options?: Array<{ label: string; content: string }>;
    officialAnswer?: string;
    isAnnulled?: boolean;
    subjectSlug?: string;
    classificationStatus?: "CLASSIFIED" | "CLASSIFICATION_PENDING";
    hasMissingVisualOrTable?: boolean;
    visualWarning?: string | null;
    answerKeyVerified?: boolean;
    reviewState?: "STRUCTURALLY_VALID" | "AWAITING_REVIEW" | "VERIFIED" | "REJECTED";
    reviewedByName?: string;
    pageNumber?: number;
  };
};

export type ImportJobSummary = {
  id: string;
  status: string;
  totalDetected: number;
  totalStructured: number;
  totalValidated: number;
  totalPublished: number;
  createdAt: string;
  editionCode: string;
  editionTitle: string;
  examDate: string | null;
  versionLabel: string;
  examDocId: string;
  examDocTitle: string;
  examDocSha256: string;
  examDocVerificationStatus: string;
  examDocHasStoredFile: boolean;
  answerKeyDocId: string | null;
  answerKeyDocVerificationStatus: string;
  answerKeyDocHasStoredFile: boolean;
  items: ImportJobItemPreview[];
};

function mapRawJob(j: Record<string, unknown>): ImportJobSummary {
  const ed = j.examEdition as Record<string, unknown>;
  const form = j.examForm as Record<string, unknown>;
  const examDoc = j.examPdfDocument as Record<string, unknown>;
  const keyDoc = (j.answerKeyDocument as Record<string, unknown> | null) ?? null;
  const rawItems = (j.items as Array<Record<string, unknown>>) ?? [];

  return {
    id: String(j.id),
    status: String(j.status),
    totalDetected: Number(j.totalDetected ?? 0),
    totalStructured: Number(j.totalStructured ?? 0),
    totalValidated: Number(j.totalValidated ?? 0),
    totalPublished: Number(j.totalPublished ?? 0),
    createdAt: String(j.createdAt),
    editionCode: String(ed.editionCode),
    editionTitle: String(ed.title),
    examDate: ed.examDate ? String(ed.examDate).slice(0, 10) : null,
    versionLabel: String(form.versionLabel),
    examDocId: String(examDoc.id),
    examDocTitle: String(examDoc.title),
    examDocSha256: String(examDoc.sha256),
    examDocVerificationStatus: String(examDoc.verificationStatus ?? "PENDING"),
    examDocHasStoredFile: Boolean(examDoc.storageKey),
    answerKeyDocId: keyDoc ? String(keyDoc.id) : null,
    answerKeyDocVerificationStatus: keyDoc
      ? String(keyDoc.verificationStatus ?? "PENDING")
      : "PENDING",
    answerKeyDocHasStoredFile: Boolean(keyDoc?.storageKey),
    items: rawItems.map((it) => ({
      id: String(it.id),
      originalNumber: Number(it.originalNumber),
      detectedAnswerKey: it.detectedAnswerKey ? String(it.detectedAnswerKey) : null,
      validationStatus: String(it.validationStatus),
      reviewedAt: it.reviewedAt ? String(it.reviewedAt) : null,
      validationErrorsJson: it.validationErrorsJson,
      structuredPayloadJson:
        (it.structuredPayloadJson as ImportJobItemPreview["structuredPayloadJson"]) ??
        {},
    })),
  };
}

export function PdfImportStudio({
  editions,
  subjects,
  initialJobs,
}: {
  editions: AdminEditionOption[];
  subjects: AdminSubjectOption[];
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
  const [verifyingDocs, setVerifyingDocs] = useState(false);
  const [savingItemId, setSavingItemId] = useState<string | null>(null);

  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  const [activeJob, setActiveJob] = useState<ImportJobSummary | null>(
    initialJobs.find((j) => j.status === "AWAITING_REVIEW") ?? null
  );

  // Estado do visualizador de PDF comparativo
  const [pdfTab, setPdfTab] = useState<"EXAM" | "KEY">("EXAM");
  const [pdfPage, setPdfPage] = useState<number>(1);

  // Checklist independente de verificação dos documentos e gabarito
  const [chkEditionDate, setChkEditionDate] = useState(false);
  const [chkVersion, setChkVersion] = useState(false);
  const [chkAnswerMap, setChkAnswerMap] = useState(false);

  // Editor inline de item individual
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<{
    originalNumber: number;
    statement: string;
    supportText: string;
    options: Array<{ label: string; content: string }>;
    officialAnswer: string;
    isAnnulled: boolean;
    subjectSlug: string;
    hasMissingVisualOrTable: boolean;
    answerKeyVerified: boolean;
    pageNumber: number;
  } | null>(null);

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

  function startEditingItem(item: ImportJobItemPreview) {
    const p = item.structuredPayloadJson ?? {};
    setEditingItemId(item.id);
    setEditDraft({
      originalNumber: item.originalNumber,
      statement: p.statement ?? "",
      supportText: p.supportText ?? "",
      options: (p.options ?? []).map((o) => ({ ...o })),
      officialAnswer: p.officialAnswer ?? item.detectedAnswerKey ?? "",
      isAnnulled: Boolean(p.isAnnulled),
      subjectSlug: p.subjectSlug ?? "CLASSIFICATION_PENDING",
      hasMissingVisualOrTable: Boolean(p.hasMissingVisualOrTable),
      answerKeyVerified: Boolean(p.answerKeyVerified),
      pageNumber: p.pageNumber ?? 1,
    });
    if (p.pageNumber) {
      setPdfTab("EXAM");
      setPdfPage(p.pageNumber);
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

      const mapped = mapRawJob(data.job);
      setActiveJob(mapped);
      setPdfTab("EXAM");
      setPdfPage(mapped.items[0]?.structuredPayloadJson?.pageNumber ?? 1);
      setChkEditionDate(false);
      setChkVersion(false);
      setChkAnswerMap(false);
      setFeedback({
        type: "success",
        message: data.idempotentReplay
          ? `Lote já extraído (SHA-256 idêntico). Conferência humana pendente: ${mapped.totalValidated}/${mapped.totalDetected} itens aprovados.`
          : `PDFs armazenados de forma privada e ${mapped.totalDetected} questões extraídas (${mapped.totalStructured} estruturalmente válidas). Nenhuma questão foi aprovada automaticamente — confira os documentos e cada item lado a lado com o PDF.`,
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

  async function handleVerifyDocuments() {
    if (!activeJob) return;
    setVerifyingDocs(true);
    setFeedback(null);

    try {
      const res = await fetch(
        `/api/admin/imports/${activeJob.id}/verify-documents`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            confirmedEditionAndDate: chkEditionDate,
            confirmedBookletVersion: chkVersion,
            confirmedAnswerKeyMap: chkAnswerMap,
          }),
        }
      );
      const data = await res.json();
      if (!res.ok) {
        setFeedback({
          type: "error",
          message: data.message || "Não foi possível confirmar os documentos.",
        });
        return;
      }

      setActiveJob({
        ...activeJob,
        examDocVerificationStatus: "VERIFIED",
        answerKeyDocVerificationStatus: "VERIFIED",
      });
      setFeedback({
        type: "success",
        message: `Documentos e gabarito oficial confirmados por ${data.verifiedBy} em ${new Date(data.verifiedAt).toLocaleString("pt-BR")}.`,
      });
      router.refresh();
    } finally {
      setVerifyingDocs(false);
    }
  }

  async function handleItemAction(
    itemId: string,
    action: "EDIT" | "APPROVE" | "REJECT",
    overrideDraft?: typeof editDraft
  ) {
    if (!activeJob) return;
    setSavingItemId(itemId);
    setFeedback(null);

    const payloadBody =
      overrideDraft ?? (editingItemId === itemId ? editDraft : null);

    try {
      const res = await fetch(
        `/api/admin/imports/${activeJob.id}/items/${itemId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action,
            ...(payloadBody ?? {}),
          }),
        }
      );
      const data = await res.json();
      if (!res.ok) {
        setFeedback({
          type: "error",
          message: data.message || `Falha ao executar ${action} no item.`,
        });
        return;
      }

      const updatedItem = data.item as ImportJobItemPreview;
      const nextItems = activeJob.items.map((it) =>
        it.id === itemId
          ? {
              ...it,
              originalNumber: updatedItem.originalNumber,
              detectedAnswerKey: updatedItem.detectedAnswerKey,
              validationStatus: updatedItem.validationStatus,
              reviewedAt: updatedItem.reviewedAt,
              validationErrorsJson: updatedItem.validationErrorsJson,
              structuredPayloadJson: updatedItem.structuredPayloadJson ?? {},
            }
          : it
      );
      const verifiedCount = nextItems.filter(
        (it) =>
          it.validationStatus === "VERIFIED" &&
          it.structuredPayloadJson?.reviewState === "VERIFIED"
      ).length;

      setActiveJob({
        ...activeJob,
        totalValidated: verifiedCount,
        items: nextItems,
      });

      if (action === "APPROVE" || action === "REJECT") {
        setEditingItemId(null);
        setEditDraft(null);
      }

      setFeedback({
        type: "success",
        message:
          action === "APPROVE"
            ? `Questão #${updatedItem.originalNumber} verificada e aprovada para publicação.`
            : action === "REJECT"
              ? `Questão #${updatedItem.originalNumber} rejeitada e bloqueada da publicação.`
              : `Correções salvas na questão #${updatedItem.originalNumber}. Clique em "Aprovar Item" após conferir o gabarito.`,
      });
      router.refresh();
    } finally {
      setSavingItemId(null);
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
          message: data.message || "Publicação bloqueada por pendências de revisão.",
        });
        return;
      }

      setFeedback({
        type: "success",
        message: `Publicação concluída: ${data.publishedCount ?? 0} questão(ões) verificadas publicadas no Prisma Postgres (${data.blockedCount ?? 0} mantidas fora por pendência).`,
      });
      if (activeJob?.id === jobId) {
        setActiveJob({
          ...activeJob,
          status: data.job?.status ?? "PUBLISHED",
          totalPublished: data.publishedCount ?? activeJob.totalPublished,
        });
      }
      router.refresh();
    } catch {
      setFeedback({
        type: "error",
        message: "Erro de conexão ao publicar itens verificados.",
      });
    } finally {
      setPublishingJobId(null);
    }
  }

  const docsVerified =
    activeJob?.examDocVerificationStatus === "VERIFIED" &&
    activeJob?.answerKeyDocVerificationStatus === "VERIFIED";

  const verifiedItemsCount =
    activeJob?.items.filter(
      (i) =>
        i.validationStatus === "VERIFIED" &&
        i.structuredPayloadJson?.reviewState === "VERIFIED"
    ).length ?? 0;

  const activePdfUrl = useMemo(() => {
    if (!activeJob) return null;
    if (pdfTab === "EXAM" && activeJob.examDocHasStoredFile) {
      return `/api/admin/documents/${activeJob.examDocId}/file#page=${pdfPage}`;
    }
    if (pdfTab === "KEY" && activeJob.answerKeyDocId && activeJob.answerKeyDocHasStoredFile) {
      return `/api/admin/documents/${activeJob.answerKeyDocId}/file#page=1`;
    }
    return null;
  }, [activeJob, pdfTab, pdfPage]);

  return (
    <div className="space-y-8">
      {/* 1. Formulário de Upload Privado */}
      <section className="bg-surface border border-border rounded-lg p-6 shadow-card space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-border">
          <div className="flex items-center gap-2">
            <FileUp className="w-4 h-4 text-navy" />
            <h2 className="font-display text-sm font-semibold text-foreground">
              1. Enviar PDFs Oficiais (Armazenamento Privado + Extração para Revisão)
            </h2>
          </div>
          <span className="inline-flex items-center gap-1 text-[11px] text-muted">
            <Lock className="w-3 h-3 text-petrol" />
            PDFs salvos de forma privada no Prisma Postgres (acesso exclusivo admin)
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
                <option value="TRUE_FALSE">Certo / Errado (Cebraspe PRF)</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 rounded-lg border border-dashed border-border bg-background space-y-2">
              <label
                htmlFor="examPdf"
                className="text-xs font-semibold text-foreground block"
              >
                PDF do Caderno de Prova Oficial (.pdf)
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
                PDF do Gabarito Oficial Definitivo (.pdf)
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
                URL Oficial de Referência da Banca (opcional)
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
                  <span>Armazenando PDFs e extraindo para revisão...</span>
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

      {/* 2. Estúdio Comparativo (Revisão Individual + Visualizador do PDF Original) */}
      {activeJob && (
        <section className="bg-surface border-2 border-navy/30 rounded-lg p-6 shadow-card space-y-5">
          {/* Cabeçalho e Botão de Publicação em Lote (somente VERIFIED) */}
          <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-border">
            <div>
              <h3 className="font-display text-sm font-semibold text-foreground">
                2. Conferência Comparativa — {activeJob.editionCode} ({activeJob.versionLabel})
              </h3>
              <p className="text-[11px] text-muted mt-0.5">
                Data: {activeJob.examDate ?? "N/A"} · SHA-256:{" "}
                <span className="font-mono">{activeJob.examDocSha256.slice(0, 16)}…</span>{" "}
                · Extraídas: <strong>{activeJob.totalDetected}</strong> · Aprovadas (VERIFIED):{" "}
                <strong className="text-semantic-success">{verifiedItemsCount}</strong>
              </p>
            </div>

            <button
              type="button"
              disabled={
                publishingJobId === activeJob.id ||
                !docsVerified ||
                verifiedItemsCount === 0
              }
              onClick={() => handleApproveAndPublish(activeJob.id)}
              className="h-9 px-5 rounded-md bg-semantic-success hover:opacity-90 disabled:opacity-40 text-white text-xs font-semibold inline-flex items-center gap-2"
              title={
                !docsVerified
                  ? "Confirme os documentos e o gabarito definitivo primeiro"
                  : verifiedItemsCount === 0
                    ? "Aprove individualmente ao menos 1 questão como VERIFIED"
                    : "Publicar somente os itens explicitamente verificados"
              }
            >
              {publishingJobId === activeJob.id ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Publicando...</span>
                </>
              ) : (
                <>
                  <Rocket className="w-3.5 h-3.5" />
                  <span>
                    Publicar Itens Verificados ({verifiedItemsCount})
                  </span>
                </>
              )}
            </button>
          </div>

          {/* Conferência Independente dos Documentos e Gabarito Definitivo */}
          <div
            className={`p-4 rounded-lg border text-xs space-y-3 ${
              docsVerified
                ? "bg-semantic-success-bg/50 border-semantic-success/40"
                : "bg-semantic-warning-bg/60 border-semantic-warning/40"
            }`}
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2 font-semibold text-foreground">
                <ShieldCheck className="w-4 h-4 text-navy" />
                <span>
                  Conferência Independente dos Documentos Oficiais e Gabarito Definitivo
                </span>
              </div>
              <span
                className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                  docsVerified
                    ? "bg-semantic-success text-white"
                    : "bg-semantic-warning text-white"
                }`}
              >
                {docsVerified ? "DOCUMENTOS VERIFICADOS" : "CONFERÊNCIA PENDENTE"}
              </span>
            </div>

            {!docsVerified && (
              <div className="space-y-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={chkEditionDate}
                    onChange={(e) => setChkEditionDate(e.target.checked)}
                  />
                  <span>
                    Confirmo que o PDF corresponde exatamente à edição{" "}
                    <strong>{activeJob.editionCode}</strong> (data{" "}
                    <strong>{activeJob.examDate ?? "conferida"}</strong>).
                  </span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={chkVersion}
                    onChange={(e) => setChkVersion(e.target.checked)}
                  />
                  <span>
                    Confirmo que a versão do caderno é{" "}
                    <strong>{activeJob.versionLabel}</strong> (sem mistura de versões).
                  </span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={chkAnswerMap}
                    onChange={(e) => setChkAnswerMap(e.target.checked)}
                  />
                  <span>
                    Confirmo a integridade do gabarito oficial definitivo (inclusive eventuais anulações/retificações).
                  </span>
                </label>
                <button
                  type="button"
                  disabled={
                    verifyingDocs ||
                    !chkEditionDate ||
                    !chkVersion ||
                    !chkAnswerMap
                  }
                  onClick={handleVerifyDocuments}
                  className="h-8 px-4 rounded bg-navy text-white text-xs font-semibold disabled:opacity-40"
                >
                  {verifyingDocs
                    ? "Registrando conferência..."
                    : "Confirmar Documentos e Gabarito"}
                </button>
              </div>
            )}
          </div>

          {/* Layout Lado a Lado: Itens Extraídos (Esquerda) x PDF Original (Direita) */}
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
            {/* Coluna Esquerda: Curadoria Individual */}
            <div className="xl:col-span-7 space-y-3 max-h-[680px] overflow-y-auto pr-1">
              {activeJob.items.map((item) => {
                const p = item.structuredPayloadJson ?? {};
                const reviewState =
                  p.reviewState ??
                  (item.validationStatus === "VERIFIED"
                    ? "VERIFIED"
                    : item.validationStatus === "REJECTED"
                      ? "REJECTED"
                      : "AWAITING_REVIEW");
                const isEditing = editingItemId === item.id && editDraft !== null;
                const isPendingClass =
                  p.classificationStatus === "CLASSIFICATION_PENDING" ||
                  !p.subjectSlug ||
                  p.subjectSlug === "CLASSIFICATION_PENDING";

                return (
                  <div
                    key={item.id}
                    className={`p-4 rounded-lg border text-xs space-y-2.5 ${
                      reviewState === "VERIFIED"
                        ? "bg-semantic-success-bg/25 border-semantic-success/40"
                        : reviewState === "REJECTED"
                          ? "bg-semantic-error-bg/25 border-semantic-error/40"
                          : "bg-background border-border"
                    }`}
                  >
                    {/* Badges de Estado Separados */}
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="px-2 py-0.5 rounded bg-navy text-white font-semibold text-[11px]">
                          #{item.originalNumber}
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded font-semibold text-[10px] ${
                            reviewState === "VERIFIED"
                              ? "bg-semantic-success text-white"
                              : reviewState === "REJECTED"
                                ? "bg-semantic-error text-white"
                                : reviewState === "STRUCTURALLY_VALID"
                                  ? "bg-petrol text-white"
                                  : "bg-semantic-warning text-white"
                          }`}
                        >
                          {reviewState}
                        </span>
                        <span className="px-2 py-0.5 rounded bg-surface border border-border font-semibold text-[11px]">
                          Gab: {item.detectedAnswerKey || "AUSENTE"}
                          {p.answerKeyVerified ? " ✓" : " (não conferido)"}
                        </span>
                        {isPendingClass && (
                          <span className="px-2 py-0.5 rounded bg-semantic-warning-bg text-semantic-warning border border-semantic-warning/30 font-semibold text-[10px]">
                            CLASSIFICATION_PENDING
                          </span>
                        )}
                        {p.hasMissingVisualOrTable && (
                          <span className="px-2 py-0.5 rounded bg-semantic-error-bg text-semantic-error border border-semantic-error/30 font-semibold text-[10px]">
                            FIGURA/TABELA PENDENTE
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-1.5">
                        {p.pageNumber && (
                          <button
                            type="button"
                            onClick={() => {
                              setPdfTab("EXAM");
                              setPdfPage(p.pageNumber ?? 1);
                            }}
                            className="h-7 px-2 rounded border border-border bg-surface text-[11px] hover:border-navy inline-flex items-center gap-1"
                          >
                            <FileText className="w-3 h-3" />
                            <span>Pág. {p.pageNumber}</span>
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() =>
                            isEditing
                              ? (setEditingItemId(null), setEditDraft(null))
                              : startEditingItem(item)
                          }
                          className="h-7 px-2.5 rounded border border-border bg-surface text-[11px] font-medium hover:border-navy inline-flex items-center gap-1"
                        >
                          <Pencil className="w-3 h-3" />
                          <span>{isEditing ? "Fechar" : "Revisar / Corrigir"}</span>
                        </button>
                      </div>
                    </div>

                    {!isEditing ? (
                      <>
                        {p.supportText && (
                          <div className="p-2 rounded bg-surface border border-border text-[11px] text-muted">
                            <strong>Texto de apoio:</strong>{" "}
                            {p.supportText.slice(0, 180)}
                            {p.supportText.length > 180 ? "…" : ""}
                          </div>
                        )}
                        <p className="text-foreground leading-relaxed">
                          {p.statement?.slice(0, 280)}
                          {(p.statement?.length ?? 0) > 280 ? "…" : ""}
                        </p>
                        {p.visualWarning && (
                          <p className="text-[11px] text-semantic-warning font-medium">
                            ⚠ {p.visualWarning}
                          </p>
                        )}
                        <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                          <span className="text-[11px] text-muted">
                            Disciplina:{" "}
                            <strong className="text-foreground">
                              {p.subjectSlug || "CLASSIFICATION_PENDING"}
                            </strong>
                            {p.reviewedByName && (
                              <> · Revisado por {p.reviewedByName}</>
                            )}
                          </span>
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              disabled={savingItemId === item.id}
                              onClick={() => handleItemAction(item.id, "APPROVE")}
                              className="h-7 px-2.5 rounded bg-semantic-success text-white text-[11px] font-semibold disabled:opacity-40 inline-flex items-center gap-1"
                            >
                              <CheckCircle2 className="w-3 h-3" />
                              <span>Aprovar</span>
                            </button>
                            <button
                              type="button"
                              disabled={savingItemId === item.id}
                              onClick={() => handleItemAction(item.id, "REJECT")}
                              className="h-7 px-2.5 rounded bg-semantic-error text-white text-[11px] font-semibold disabled:opacity-40 inline-flex items-center gap-1"
                            >
                              <XCircle className="w-3 h-3" />
                              <span>Rejeitar</span>
                            </button>
                          </div>
                        </div>
                      </>
                    ) : (
                      /* Editor Completo do Item */
                      <div className="space-y-3 pt-2 border-t border-border">
                        <div className="grid grid-cols-3 gap-2">
                          <div>
                            <label className="text-[11px] font-medium block mb-1">
                              Nº Questão
                            </label>
                            <input
                              type="number"
                              value={editDraft.originalNumber}
                              onChange={(e) =>
                                setEditDraft({
                                  ...editDraft,
                                  originalNumber: Number(e.target.value),
                                })
                              }
                              className="w-full h-8 px-2 rounded border border-border bg-surface text-xs"
                            />
                          </div>
                          <div>
                            <label className="text-[11px] font-medium block mb-1">
                              Gabarito Oficial
                            </label>
                            <input
                              type="text"
                              value={editDraft.officialAnswer}
                              onChange={(e) =>
                                setEditDraft({
                                  ...editDraft,
                                  officialAnswer: e.target.value.toUpperCase(),
                                  isAnnulled:
                                    e.target.value.toUpperCase() === "ANULADA",
                                })
                              }
                              className="w-full h-8 px-2 rounded border border-border bg-surface text-xs uppercase"
                            />
                          </div>
                          <div>
                            <label className="text-[11px] font-medium block mb-1">
                              Página PDF
                            </label>
                            <input
                              type="number"
                              min={1}
                              value={editDraft.pageNumber}
                              onChange={(e) =>
                                setEditDraft({
                                  ...editDraft,
                                  pageNumber: Number(e.target.value),
                                })
                              }
                              className="w-full h-8 px-2 rounded border border-border bg-surface text-xs"
                            />
                          </div>
                        </div>

                        <div>
                          <label className="text-[11px] font-medium block mb-1">
                            Disciplina / Assunto (obrigatória para aprovar)
                          </label>
                          <select
                            value={editDraft.subjectSlug}
                            onChange={(e) =>
                              setEditDraft({
                                ...editDraft,
                                subjectSlug: e.target.value,
                              })
                            }
                            className="w-full h-8 px-2 rounded border border-border bg-surface text-xs"
                          >
                            <option value="CLASSIFICATION_PENDING">
                              CLASSIFICATION_PENDING — Selecione manualmente...
                            </option>
                            {subjects.map((s) => (
                              <option key={s.slug} value={s.slug}>
                                {s.parentName ? `${s.parentName} › ` : ""}
                                {s.name}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="text-[11px] font-medium block mb-1">
                            Texto de Apoio (opcional)
                          </label>
                          <textarea
                            rows={2}
                            value={editDraft.supportText}
                            onChange={(e) =>
                              setEditDraft({
                                ...editDraft,
                                supportText: e.target.value,
                              })
                            }
                            className="w-full p-2 rounded border border-border bg-surface text-xs"
                          />
                        </div>

                        <div>
                          <label className="text-[11px] font-medium block mb-1">
                            Enunciado
                          </label>
                          <textarea
                            rows={3}
                            value={editDraft.statement}
                            onChange={(e) =>
                              setEditDraft({
                                ...editDraft,
                                statement: e.target.value,
                              })
                            }
                            className="w-full p-2 rounded border border-border bg-surface text-xs"
                          />
                        </div>

                        <div className="space-y-1.5">
                          <label className="text-[11px] font-medium block">
                            Alternativas
                          </label>
                          {editDraft.options.map((opt, idx) => (
                            <div key={opt.label} className="flex items-center gap-2">
                              <span className="w-6 text-center font-semibold">
                                ({opt.label})
                              </span>
                              <input
                                type="text"
                                value={opt.content}
                                onChange={(e) => {
                                  const copy = [...editDraft.options];
                                  copy[idx] = {
                                    ...opt,
                                    content: e.target.value,
                                  };
                                  setEditDraft({ ...editDraft, options: copy });
                                }}
                                className="flex-1 h-8 px-2 rounded border border-border bg-surface text-xs"
                              />
                            </div>
                          ))}
                        </div>

                        <div className="space-y-1.5 pt-1">
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={editDraft.answerKeyVerified}
                              onChange={(e) =>
                                setEditDraft({
                                  ...editDraft,
                                  answerKeyVerified: e.target.checked,
                                })
                              }
                            />
                            <span className="font-medium text-foreground">
                              Conferi o gabarito oficial definitivo da banca para esta questão
                            </span>
                          </label>
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={editDraft.hasMissingVisualOrTable}
                              onChange={(e) =>
                                setEditDraft({
                                  ...editDraft,
                                  hasMissingVisualOrTable: e.target.checked,
                                })
                              }
                            />
                            <span className="text-muted">
                              Manter sinalizada como figura/tabela pendente (bloqueia publicação)
                            </span>
                          </label>
                        </div>

                        <div className="flex flex-wrap items-center gap-2 pt-2">
                          <button
                            type="button"
                            disabled={savingItemId === item.id}
                            onClick={() =>
                              handleItemAction(item.id, "EDIT", editDraft)
                            }
                            className="h-8 px-3 rounded border border-navy text-navy font-semibold text-xs"
                          >
                            Salvar Correção
                          </button>
                          <button
                            type="button"
                            disabled={savingItemId === item.id}
                            onClick={() =>
                              handleItemAction(item.id, "APPROVE", editDraft)
                            }
                            className="h-8 px-3.5 rounded bg-semantic-success text-white font-semibold text-xs"
                          >
                            Salvar e Aprovar (VERIFIED)
                          </button>
                          <button
                            type="button"
                            disabled={savingItemId === item.id}
                            onClick={() =>
                              handleItemAction(item.id, "REJECT", editDraft)
                            }
                            className="h-8 px-3 rounded bg-semantic-error text-white font-semibold text-xs"
                          >
                            Rejeitar Item
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Coluna Direita: Visualizador do PDF Original Privado */}
            <div className="xl:col-span-5 flex flex-col border border-border rounded-lg overflow-hidden bg-background">
              <div className="px-3 py-2 bg-surface border-b border-border flex flex-wrap items-center justify-between gap-2 text-xs">
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setPdfTab("EXAM")}
                    className={`px-2.5 py-1 rounded text-[11px] font-semibold ${
                      pdfTab === "EXAM"
                        ? "bg-navy text-white"
                        : "bg-background text-muted hover:text-foreground"
                    }`}
                  >
                    Caderno de Prova
                  </button>
                  <button
                    type="button"
                    onClick={() => setPdfTab("KEY")}
                    className={`px-2.5 py-1 rounded text-[11px] font-semibold ${
                      pdfTab === "KEY"
                        ? "bg-petrol text-white"
                        : "bg-background text-muted hover:text-foreground"
                    }`}
                  >
                    Gabarito Definitivo
                  </button>
                </div>

                {pdfTab === "EXAM" && (
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setPdfPage((p) => Math.max(1, p - 1))}
                      className="p-1 rounded border border-border hover:bg-surface"
                      title="Página anterior"
                    >
                      <ChevronLeft className="w-3.5 h-3.5" />
                    </button>
                    <span className="px-2 font-mono text-[11px]">
                      Pág. {pdfPage}
                    </span>
                    <button
                      type="button"
                      onClick={() => setPdfPage((p) => p + 1)}
                      className="p-1 rounded border border-border hover:bg-surface"
                      title="Próxima página"
                    >
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>

              {activePdfUrl ? (
                <iframe
                  key={activePdfUrl}
                  src={activePdfUrl}
                  title="Visualização comparativa do PDF oficial"
                  className="w-full h-[630px] bg-white"
                />
              ) : (
                <div className="h-[630px] flex flex-col items-center justify-center p-6 text-center text-xs text-muted space-y-2">
                  <FileText className="w-8 h-8 opacity-40" />
                  <p>
                    Binário PDF não armazenado para este job (importação anterior ao armazenamento privado). Envie os PDFs pelo formulário acima para habilitar a comparação lado a lado.
                  </p>
                </div>
              )}
            </div>
          </div>
        </section>
      )}

      {/* 3. Histórico de Jobs de Importação */}
      <section className="bg-surface border border-border rounded-lg p-6 shadow-subtle space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-border">
          <h3 className="font-display text-sm font-semibold text-foreground">
            Jobs de Importação e Curadoria ({initialJobs.length})
          </h3>
        </div>

        <div className="space-y-3">
          {initialJobs.map((job) => (
            <div
              key={job.id}
              className="p-4 rounded-lg bg-background border border-border flex flex-wrap items-center justify-between gap-2"
            >
              <div>
                <span className="font-display text-xs font-semibold text-foreground">
                  {job.editionTitle} — {job.versionLabel}
                </span>
                <span className="block text-[11px] text-muted">
                  Documento: {job.examDocTitle} (SHA-256:{" "}
                  {job.examDocSha256.slice(0, 16)}… · Doc:{" "}
                  {job.examDocVerificationStatus})
                </span>
              </div>

              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded bg-navy text-white text-[11px] font-semibold">
                  {job.status} ({job.totalValidated}/{job.totalDetected} verificadas •{" "}
                  {job.totalPublished} publicadas)
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setActiveJob(job);
                    setPdfTab("EXAM");
                    setPdfPage(
                      job.items[0]?.structuredPayloadJson?.pageNumber ?? 1
                    );
                  }}
                  className="h-7 px-3 rounded border border-border bg-surface text-[11px] font-medium hover:border-navy inline-flex items-center gap-1"
                >
                  <Eye className="w-3 h-3" />
                  <span>Abrir Curadoria</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
