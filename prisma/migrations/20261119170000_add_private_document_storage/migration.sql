-- Additive-only migration: Private persistent PDF storage linked by SHA-256 to SourceDocument.storageKey
-- Zero destructive operations on existing tables.

CREATE TABLE IF NOT EXISTS "StoredDocumentFile" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "sha256" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL DEFAULT 'application/pdf',
    "sizeBytes" INTEGER NOT NULL,
    "content" BYTEA NOT NULL,
    "uploadedBy" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StoredDocumentFile_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "StoredDocumentFile_sha256_key" ON "StoredDocumentFile"("sha256");
CREATE INDEX IF NOT EXISTS "StoredDocumentFile_createdAt_idx" ON "StoredDocumentFile"("createdAt");
