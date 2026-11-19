import { ShieldAlert } from "lucide-react";
import { requireAdminAuth } from "@/lib/auth/session";
import { isDatabaseConfigured, prisma } from "@/lib/db/prisma";
import {
  PdfImportStudio,
  type AdminEditionOption,
  type ImportJobSummary,
} from "@/components/admin/pdf-import-studio";

export default async function AdminImportsPage() {
  await requireAdminAuth();
  const dbConnected = isDatabaseConfigured();

  const [editionsRaw, jobsRaw] = dbConnected
    ? await Promise.all([
        prisma.examEdition.findMany({
          include: {
            position: { include: { studyTrack: true } },
            examBoard: true,
            examForms: { orderBy: { isDefault: "desc" } },
          },
          orderBy: [{ year: "desc" }, { editionCode: "asc" }],
        }),
        prisma.importJob.findMany({
          include: {
            examEdition: true,
            examForm: true,
            examPdfDocument: true,
            items: { orderBy: { originalNumber: "asc" }, take: 30 },
          },
          orderBy: { createdAt: "desc" },
          take: 20,
        }),
      ])
    : [[], []];

  const editions: AdminEditionOption[] = editionsRaw.map((ed) => ({
    id: ed.id,
    editionCode: ed.editionCode,
    title: ed.title,
    trackCode: ed.position.studyTrack.code,
    boardAcronym: ed.examBoard.acronym,
    examDate: ed.examDate?.toISOString().slice(0, 10) ?? null,
    officialNoticeUrl: ed.officialNoticeUrl,
    forms: ed.examForms.map((f) => ({
      id: f.id,
      versionLabel: f.versionLabel,
      isDefault: f.isDefault,
    })),
  }));

  const jobs: ImportJobSummary[] = jobsRaw.map((job) => ({
    id: job.id,
    status: job.status,
    totalDetected: job.totalDetected,
    totalValidated: job.totalValidated,
    totalPublished: job.totalPublished,
    createdAt: job.createdAt.toISOString(),
    editionCode: job.examEdition.editionCode,
    editionTitle: job.examEdition.title,
    versionLabel: job.examForm.versionLabel,
    examDocTitle: job.examPdfDocument.title,
    examDocSha256: job.examPdfDocument.sha256,
    items: job.items.map((it) => ({
      id: it.id,
      originalNumber: it.originalNumber,
      detectedAnswerKey: it.detectedAnswerKey,
      validationStatus: it.validationStatus,
      validationErrorsJson: it.validationErrorsJson,
      structuredPayloadJson:
        (it.structuredPayloadJson as ImportJobSummary["items"][number]["structuredPayloadJson"]) ??
        {},
    })),
  }));

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h2 className="font-display text-lg font-semibold text-foreground">
          Pipeline de Importação de Provas Reais
        </h2>
        <p className="text-xs text-muted">
          Envie os PDFs oficiais (Prova + Gabarito Definitivo) diretamente pelo navegador, confira a prévia estruturada e aprove a publicação no Prisma Postgres.
        </p>
      </div>

      <PdfImportStudio editions={editions} initialJobs={jobs} />

      <div className="p-3.5 rounded-md bg-semantic-warning-bg border border-semantic-warning/30 flex items-start gap-2 text-xs text-foreground">
        <ShieldAlert className="w-4 h-4 text-semantic-warning shrink-0 mt-0.5" />
        <span>
          Garantia ativa de integridade: nenhuma questão é publicada sem hash SHA-256 dos PDFs oficiais, versão de caderno definida, alternativas completas e vínculo com o gabarito definitivo da mesma aplicação.
        </span>
      </div>
    </div>
  );
}
