-- Additive-only migration: Expected question count per ExamEdition and ExamForm
-- Supports distinct official question counts within the same career (e.g. TJSP 2025 = 70 vs TJSP 2024 = 100).

ALTER TABLE "ExamEdition" ADD COLUMN IF NOT EXISTS "expectedQuestionCount" INTEGER;
ALTER TABLE "ExamForm" ADD COLUMN IF NOT EXISTS "expectedQuestionCount" INTEGER;
