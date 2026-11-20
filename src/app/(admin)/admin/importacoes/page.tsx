import { ShieldAlert } from "lucide-react";
import { requireAdminAuth } from "@/lib/auth/session";
import { isDatabaseConfigured, prisma } from "@/lib/db/prisma";
import { resolveExpectedQuestionCount } from "@/features/imports/pipeline";
import {
  PdfImportStudio,
  type AdminEditionOption,
  type AdminSubjectOption,
  type ImportJobSummary,
} from "@/components/admin/pdf-import-studio";

export default async function AdminImportsPage() {
  await requireAdminAuth();
  const dbConnected = isDatabaseConfigured();

  const [editionsRaw, subjectsRaw, jobsRaw] = dbConnected
    ? await Promise.all([
        prisma.examEdition.findMany({
          include: {
            position: { include: { studyTrack: true } },
            examBoard: true,
            examForms: { orderBy: { isDefault: "desc" } },
          },
          orderBy: [{ year: "desc" }, { editionCode: "asc" }],
        }),
        prisma.subject.findMany({
          include: { parent: { select: { name: true } } },
          orderBy: [{ displayOrder: "asc" }, { name: "asc" }],
        }),
        prisma.importJob.findMany({
          include: {
            examEdition: {
              include: {
                position: { include: { studyTrack: { select: { code: true } } } },
                ruleset: { select: { passingRulesJson: true } },
              },
            },
            examForm: true,
            examPdfDocument: true,
            answerKeyDocument: true,
            items: { orderBy: { originalNumber: "asc" } },
          },
          orderBy: { createdAt: "desc" },
          take: 20,
        }),
      ])
    : [[], [], []];

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

  const subjects: AdminSubjectOption[] = subjectsRaw.map((s) => ({
    slug: s.slug,
    name: s.name,
    parentName: s.parent?.name ?? null,
  }));

  const jobs: ImportJobSummary[] = jobsRaw.map((job) => ({
    id: job.id,
    status: job.status,
    totalDetected: job.totalDetected,
    expectedQuestionCount: resolveExpectedQuestionCount({
      formExpectedCount: job.examForm.expectedQuestionCount,
      editionExpectedCount: job.examEdition.expectedQuestionCount,
      rulesetPassingRules: job.examEdition.ruleset.passingRulesJson,
      trackCode: job.examEdition.position.studyTrack.code,
    }),
    totalStructured: job.totalStructured,
    totalValidated: job.totalValidated,
    totalPublished: job.totalPublished,
    createdAt: job.createdAt.toISOString(),
    editionCode: job.examEdition.editionCode,
    editionTitle: job.examEdition.title,
    examDate: job.examEdition.examDate?.toISOString().slice(0, 10) ?? null,
    versionLabel: job.examForm.versionLabel,
    examDocId: job.examPdfDocument.id,
    examDocTitle: job.examPdfDocument.title,
    examDocSha256: job.examPdfDocument.sha256,
    examDocVerificationStatus: job.examPdfDocument.verificationStatus,
    examDocHasStoredFile: Boolean(job.examPdfDocument.storageKey),
    answerKeyDocId: job.answerKeyDocument?.id ?? null,
    answerKeyDocVerificationStatus:
      job.answerKeyDocument?.verificationStatus ?? "PENDING",
    answerKeyDocHasStoredFile: Boolean(job.answerKeyDocument?.storageKey),
    items: job.items.map((it) => ({
      id: it.id,
      originalNumber: it.originalNumber,
      detectedAnswerKey: it.detectedAnswerKey,
      validationStatus: it.validationStatus,
      reviewedAt: it.reviewedAt?.toISOString() ?? null,
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
          Envie os PDFs oficiais para armazenamento privado, compare página a página com o PDF original, corrija/classifique cada questão, confirme o gabarito definitivo e publique somente itens explicitamente verificados.
        </p>
      </div>

      <PdfImportStudio
        editions={editions}
        subjects={subjects}
        initialJobs={jobs}
      />

      <div className="p-3.5 rounded-md bg-semantic-warning-bg border border-semantic-warning/30 flex items-start gap-2 text-xs text-foreground">
        <ShieldAlert className="w-4 h-4 text-semantic-warning shrink-0 mt-0.5" />
        <span>
          Política estrita de curadoria ativa: a validação estrutural nunca publica questões automaticamente. Itens com classificação pendente (<code className="font-mono">CLASSIFICATION_PENDING</code>), figuras/tabelas pendentes, gabarito não conferido ou sem revisão humana explícita (<code className="font-mono">VERIFIED</code>) são bloqueados na publicação.
        </span>
      </div>
    </div>
  );
}
