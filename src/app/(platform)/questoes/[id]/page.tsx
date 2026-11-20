import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, FileText, History, ShieldCheck } from "lucide-react";
import { requireServerAuth } from "@/lib/auth/session";
import { isDatabaseConfigured, prisma } from "@/lib/db/prisma";
import { QuestionWorkspaceCard } from "@/components/questions/question-workspace";
import type { QuestionBankListItem } from "@/features/question-bank/service";

export default async function SingleQuestionPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ returnTo?: string }>;
}) {
  const user = await requireServerAuth();
  const { id } = await params;
  const resolvedSearch = await searchParams;
  const backHref =
    resolvedSearch.returnTo && resolvedSearch.returnTo.startsWith("/questoes")
      ? resolvedSearch.returnTo
      : "/questoes";

  if (!isDatabaseConfigured()) {
    return (
      <div className="bg-surface border border-border rounded-lg p-8 text-center space-y-3">
        <p className="text-sm font-medium text-foreground">
          Conecte o Prisma Postgres (.env.local) para carregar a questão #{id}.
        </p>
        <Link
          href="/questoes"
          className="inline-flex items-center gap-1.5 text-xs text-petrol hover:underline"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Voltar ao Banco de Questões
        </Link>
      </div>
    );
  }

  const q = await prisma.question.findUnique({
    where: { id },
    include: {
      options: { orderBy: { displayOrder: "asc" } },
      assets: { orderBy: { position: "asc" } },
      subjects: { include: { subject: true } },
      sources: { include: { sourceDocument: true } },
      explanations: {
        where: { status: "VERIFIED" },
        select: { id: true },
      },
      bookmarks: {
        where: { userId: user.id },
      },
      attempts: {
        where: { userId: user.id },
        orderBy: { answeredAt: "desc" },
        take: 10,
      },
      examInstances: {
        include: {
          answerKeys: { orderBy: { revisionNumber: "desc" } },
          examForm: {
            include: {
              examEdition: {
                include: {
                  examBoard: true,
                  position: {
                    include: {
                      studyTrack: true,
                      institution: true,
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  });

  if (!q || !q.examInstances[0]) {
    notFound();
  }

  const primaryInstance = q.examInstances[0];
  const edition = primaryInstance.examForm.examEdition;
  const firstSource = q.sources[0];

  const item: QuestionBankListItem = {
    id: q.id,
    examQuestionInstanceId: primaryInstance.id,
    originalNumber: primaryInstance.originalNumber,
    questionType: q.questionType,
    statement: q.statement,
    supportText: q.supportText,
    instruction: q.instruction,
    difficulty: q.difficulty,
    isAnnulled: primaryInstance.isAnnulled,
    isOutdated: q.isOutdated,
    outdatedNotes: q.outdatedNotes,
    trackCode: edition.position.studyTrack.code,
    institutionAcronym: edition.position.institution.acronym,
    boardAcronym: edition.examBoard.acronym,
    positionName: edition.position.name,
    examTitle: edition.title,
    examYear: edition.year,
    versionLabel: primaryInstance.examForm.versionLabel,
    officialNoticeUrl: edition.officialNoticeUrl,
    sourceDocumentUrl: firstSource?.sourceDocument.officialUrl ?? null,
    sourcePageNumber: firstSource?.pageNumber ?? null,
    subjects: q.subjects.map((s) => ({
      id: s.subject.id,
      name: s.subject.name,
      slug: s.subject.slug,
    })),
    options: q.options.map((o) => ({
      id: o.id,
      label: o.label,
      content: o.content,
    })),
    assets: q.assets.map((a) => ({
      id: a.id,
      url: a.objectUrl || a.storagePath,
      caption: a.caption,
    })),
    hasVerifiedExplanation: q.explanations.length > 0,
    userHistory: {
      attemptCount: q.attempts.length,
      lastIsCorrect: q.attempts[0]?.isCorrect ?? null,
      isBookmarked: q.bookmarks.length > 0,
    },
  };

  return (
    <div className="space-y-5">
      <div>
        <Link
          href={backHref}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-muted hover:text-foreground"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Voltar ao Banco de Questões</span>
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <QuestionWorkspaceCard question={item} />
        </div>

        {/* Painel lateral discreto: Rastreabilidade Documental e Histórico de Tentativas */}
        <aside className="space-y-4">
          <div className="bg-surface border border-border rounded-lg p-5 shadow-subtle space-y-3">
            <div className="flex items-center gap-2 pb-2.5 border-b border-border">
              <ShieldCheck className="w-4 h-4 text-petrol" />
              <h3 className="font-display text-xs font-semibold text-foreground">
                Rastreabilidade Documental
              </h3>
            </div>
            <dl className="space-y-2 text-xs">
              <div className="flex justify-between">
                <dt className="text-muted">Hash Canônico:</dt>
                <dd className="font-mono text-foreground">
                  {q.canonicalHash.slice(0, 12)}...
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted">Caderno Oficial:</dt>
                <dd className="text-foreground font-medium">
                  {primaryInstance.examForm.versionLabel}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted">Revisões de Gabarito:</dt>
                <dd className="text-foreground font-medium">
                  {primaryInstance.answerKeys.length} versão(ões)
                </dd>
              </div>
              {firstSource && (
                <div className="pt-2 border-t border-border">
                  <span className="text-muted block mb-1 flex items-center gap-1">
                    <FileText className="w-3 h-3" />
                    Documento PDF de Origem:
                  </span>
                  <span className="text-foreground font-medium block">
                    {firstSource.sourceDocument.title}
                  </span>
                  <span className="font-mono text-[10px] text-muted block mt-0.5">
                    SHA-256: {firstSource.sourceDocument.sha256.slice(0, 16)}...
                  </span>
                </div>
              )}
            </dl>
          </div>

          <div className="bg-surface border border-border rounded-lg p-5 shadow-subtle space-y-3">
            <div className="flex items-center gap-2 pb-2.5 border-b border-border">
              <History className="w-4 h-4 text-navy" />
              <h3 className="font-display text-xs font-semibold text-foreground">
                Histórico de Tentativas ({q.attempts.length})
              </h3>
            </div>
            {q.attempts.length === 0 ? (
              <p className="text-xs text-muted">
                Nenhuma tentativa registrada anteriormente para esta questão.
              </p>
            ) : (
              <ul className="space-y-2 text-xs">
                {q.attempts.map((att) => (
                  <li
                    key={att.id}
                    className="p-2.5 rounded bg-background border border-border flex items-center justify-between"
                  >
                    <div>
                      <span className="font-semibold text-foreground">
                        #{att.attemptNumber} • Opção {att.selectedAnswer ?? "—"}
                      </span>
                      <span className="block text-[11px] text-muted">
                        {att.answeredAt.toLocaleDateString("pt-BR")} ({att.timeSpentSeconds}s)
                      </span>
                    </div>
                    <span
                      className={
                        att.isCorrect
                          ? "px-2 py-0.5 rounded bg-semantic-success-bg text-semantic-success font-medium"
                          : "px-2 py-0.5 rounded bg-semantic-error-bg text-semantic-error font-medium"
                      }
                    >
                      {att.isCorrect ? "Acerto" : "Erro"}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
