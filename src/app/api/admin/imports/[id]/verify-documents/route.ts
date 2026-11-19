import { NextRequest, NextResponse } from "next/server";
import { requireApiAdmin } from "@/lib/auth/api-guard";
import { isDatabaseConfigured, prisma } from "@/lib/db/prisma";

export const runtime = "nodejs";

/**
 * Conferência humana independente dos documentos de origem e do gabarito definitivo:
 * confirma edição, versão do caderno, data de aplicação e integridade do mapa de respostas,
 * registrando quem aprovou e quando.
 */
export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireApiAdmin();
  if (!auth.authorized) return auth.response;

  if (!isDatabaseConfigured()) {
    return NextResponse.json(
      { error: "DATABASE_NOT_CONFIGURED" },
      { status: 503 }
    );
  }

  const { id } = await context.params;
  const body = (await request.json().catch(() => ({}))) as {
    confirmedEditionAndDate?: boolean;
    confirmedBookletVersion?: boolean;
    confirmedAnswerKeyMap?: boolean;
    notes?: string;
  };

  if (
    !body.confirmedEditionAndDate ||
    !body.confirmedBookletVersion ||
    !body.confirmedAnswerKeyMap
  ) {
    return NextResponse.json(
      {
        error: "VERIFICATION_CHECKLIST_INCOMPLETE",
        message:
          "Confirme edição/data de aplicação, versão do caderno e integridade do gabarito definitivo antes de marcar os documentos como verificados.",
      },
      { status: 400 }
    );
  }

  const job = await prisma.importJob.findUnique({
    where: { id },
    include: {
      examEdition: true,
      examForm: true,
      examPdfDocument: true,
      answerKeyDocument: true,
    },
  });

  if (!job) {
    return NextResponse.json(
      { error: "NOT_FOUND", message: "Job de importação não encontrado." },
      { status: 404 }
    );
  }

  const verifiedAt = new Date();

  await prisma.$transaction(async (tx) => {
    await tx.sourceDocument.update({
      where: { id: job.examPdfDocumentId },
      data: { verificationStatus: "VERIFIED" },
    });

    if (job.answerKeyDocumentId) {
      await tx.sourceDocument.update({
        where: { id: job.answerKeyDocumentId },
        data: { verificationStatus: "VERIFIED" },
      });
    }

    await tx.contentReviewLog.create({
      data: {
        entityType: "IMPORT_JOB",
        entityId: job.id,
        action: "DOCUMENTS_AND_ANSWER_KEY_VERIFIED",
        previousStatus: job.examPdfDocument.verificationStatus,
        newStatus: "VERIFIED",
        notes:
          body.notes?.trim() ||
          `Documentos oficiais conferidos por ${auth.user.name} (${auth.user.email}): Edição ${job.examEdition.editionCode}, Caderno ${job.examForm.versionLabel}, Data ${job.examEdition.examDate?.toISOString().slice(0, 10) ?? "N/A"}.`,
        metadataJson: {
          verifiedByUserId: auth.user.id,
          verifiedByEmail: auth.user.email,
          verifiedAt: verifiedAt.toISOString(),
          confirmedEditionAndDate: true,
          confirmedBookletVersion: true,
          confirmedAnswerKeyMap: true,
        },
        reviewerUserId: auth.user.id,
      },
    });
  });

  return NextResponse.json({
    verified: true,
    verifiedAt: verifiedAt.toISOString(),
    verifiedBy: auth.user.name,
  });
}
