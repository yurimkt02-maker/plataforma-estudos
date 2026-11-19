import { NextRequest, NextResponse } from "next/server";
import { requireApiAdmin } from "@/lib/auth/api-guard";
import { isDatabaseConfigured, prisma } from "@/lib/db/prisma";

export const runtime = "nodejs";

/**
 * Serve o PDF original armazenado de forma privada no Prisma Postgres (StoredDocumentFile),
 * estritamente restrito ao administrador autenticado (jamais exposto em URL pública).
 */
export async function GET(
  _request: NextRequest,
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
  const doc = await prisma.sourceDocument.findUnique({
    where: { id },
    select: { id: true, sha256: true, storageKey: true, title: true },
  });

  if (!doc) {
    return NextResponse.json(
      { error: "NOT_FOUND", message: "Documento de origem não encontrado." },
      { status: 404 }
    );
  }

  const stored = await prisma.storedDocumentFile.findFirst({
    where: {
      OR: [
        ...(doc.storageKey ? [{ id: doc.storageKey }] : []),
        { sha256: doc.sha256 },
      ],
    },
  });

  if (!stored) {
    return NextResponse.json(
      {
        error: "FILE_NOT_STORED",
        message:
          "Binário PDF não armazenado para este documento (importado antes do armazenamento privado).",
      },
      { status: 404 }
    );
  }

  const safeName = stored.fileName.replace(/[^\w.\-() ]+/g, "_");

  return new NextResponse(Buffer.from(stored.content), {
    status: 200,
    headers: {
      "Content-Type": stored.mimeType || "application/pdf",
      "Content-Disposition": `inline; filename="${safeName}"`,
      "Content-Length": String(stored.sizeBytes),
      "Cache-Control": "private, no-store, max-age=0",
      "X-Content-Type-Options": "nosniff",
      "X-Frame-Options": "SAMEORIGIN",
    },
  });
}
