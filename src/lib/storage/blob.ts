import { createHash } from "node:crypto";
import { put } from "@vercel/blob";
import { logger } from "@/lib/utils/logger";

const MAX_UPLOAD_SIZE_BYTES = 25 * 1024 * 1024; // 25 MB
const ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/webp",
]);

export type StoredDocumentArtifact = {
  storageKey: string;
  objectUrl: string;
  sha256: string;
  fileSizeBytes: number;
  mimeType: string;
};

/**
 * Calcula o hash SHA-256 determinístico de um arquivo binário.
 */
export function computeSha256(buffer: Buffer): string {
  return createHash("sha256").update(buffer).digest("hex");
}

/**
 * Valida e persiste um documento oficial (PDF de prova, gabarito ou imagem) no Vercel Blob.
 * Jamais utiliza o filesystem temporário das Functions da Vercel como armazenamento persistente.
 */
export async function storeExamArtifact(params: {
  filename: string;
  buffer: Buffer;
  mimeType: string;
  folder: "exams" | "answer-keys" | "notices" | "assets";
}): Promise<StoredDocumentArtifact> {
  const { filename, buffer, mimeType, folder } = params;

  if (!ALLOWED_MIME_TYPES.has(mimeType)) {
    throw new Error(
      `Tipo de arquivo não permitido (${mimeType}). Apenas PDFs e imagens (PNG, JPEG, WEBP) são aceitos.`
    );
  }

  if (buffer.byteLength === 0 || buffer.byteLength > MAX_UPLOAD_SIZE_BYTES) {
    throw new Error(
      `Tamanho de arquivo inválido (${buffer.byteLength} bytes). Limite máximo: 25 MB.`
    );
  }

  const sha256 = computeSha256(buffer);
  const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, "_");
  const storageKey = `acervo/${folder}/${sha256.slice(0, 12)}-${safeName}`;

  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    logger.warn("STORAGE_BLOB_TOKEN_MISSING", {
      storageKey,
      note: "BLOB_READ_WRITE_TOKEN não configurada; retornando referência catalogada para processamento administrativo.",
    });
    return {
      storageKey,
      objectUrl: `blob://pending-upload/${storageKey}`,
      sha256,
      fileSizeBytes: buffer.byteLength,
      mimeType,
    };
  }

  const blob = await put(storageKey, buffer, {
    access: "public",
    contentType: mimeType,
    addRandomSuffix: false,
  });

  logger.info("STORAGE_ARTIFACT_UPLOADED", {
    storageKey,
    sha256,
    fileSizeBytes: buffer.byteLength,
  });

  return {
    storageKey,
    objectUrl: blob.url,
    sha256,
    fileSizeBytes: buffer.byteLength,
    mimeType,
  };
}
