-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('OWNER', 'ADMIN');

-- CreateEnum
CREATE TYPE "ThemePreference" AS ENUM ('LIGHT', 'DARK', 'SYSTEM');

-- CreateEnum
CREATE TYPE "ExamEditionStatus" AS ENUM ('DRAFT', 'ACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "QuestionType" AS ENUM ('MULTIPLE_CHOICE', 'TRUE_FALSE', 'SHORT_ANSWER', 'ESSAY');

-- CreateEnum
CREATE TYPE "QuestionStatus" AS ENUM ('DRAFT', 'AWAITING_REVIEW', 'APPROVED', 'PUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "DifficultyLevel" AS ENUM ('EASY', 'MEDIUM', 'HARD');

-- CreateEnum
CREATE TYPE "AnswerKeyStatus" AS ENUM ('PRELIMINARY', 'DEFINITIVE', 'RECTIFIED', 'ANNULLED', 'PENDING_VERIFICATION');

-- CreateEnum
CREATE TYPE "AnnulledScoringPolicy" AS ENUM ('AWARD_TO_ALL', 'EXCLUDE_FROM_TOTAL', 'RECALCULATE_WEIGHT');

-- CreateEnum
CREATE TYPE "StudySessionMode" AS ENUM ('PRACTICE', 'REVIEW', 'NOTEBOOK', 'FILTERED');

-- CreateEnum
CREATE TYPE "SimulationMode" AS ENUM ('CUSTOM', 'PAST_EXAM', 'WEAKNESS_FOCUS');

-- CreateEnum
CREATE TYPE "SimulationAttemptStatus" AS ENUM ('IN_PROGRESS', 'COMPLETED', 'ABANDONED');

-- CreateEnum
CREATE TYPE "ReviewQueueStatus" AS ENUM ('PENDING', 'COMPLETED', 'SNOOZED');

-- CreateEnum
CREATE TYPE "NotebookType" AS ENUM ('CUSTOM', 'AUTO_ERRORS', 'TRACK_FOCUS');

-- CreateEnum
CREATE TYPE "SourceDocumentType" AS ENUM ('EXAM_BOOKLET', 'OFFICIAL_ANSWER_KEY', 'RECTIFICATION_NOTICE', 'PUBLIC_NOTICE', 'SUPPORT_MATERIAL');

-- CreateEnum
CREATE TYPE "VerificationStatus" AS ENUM ('PENDING', 'VERIFIED', 'OUTDATED', 'DIVERGENT', 'REJECTED');

-- CreateEnum
CREATE TYPE "ImportJobStatus" AS ENUM ('PENDING', 'EXTRACTING', 'STRUCTURED', 'AWAITING_REVIEW', 'APPROVED', 'REJECTED', 'PUBLISHED', 'FAILED');

-- CreateEnum
CREATE TYPE "LegalSourceType" AS ENUM ('FEDERAL_LAW', 'STATE_LAW', 'CONSTITUTION', 'STF_PRECEDENT', 'STJ_PRECEDENT', 'SUMULA_VINCULANTE', 'SUMULA', 'ADMINISTRATIVE_RULE', 'TECHNICAL_STANDARD');

-- CreateEnum
CREATE TYPE "ExplanationStatus" AS ENUM ('PENDING_VERIFICATION', 'VERIFIED', 'POSSIBLY_OUTDATED', 'DIVERGENCE_IDENTIFIED', 'REVIEW_REQUIRED');

-- CreateTable
CREATE TABLE "User" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'OWNER',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserSettings" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "activeTrackCode" TEXT NOT NULL DEFAULT 'TJSP',
    "theme" "ThemePreference" NOT NULL DEFAULT 'LIGHT',
    "dailyGoalQuestions" INTEGER NOT NULL DEFAULT 30,
    "hideAnnulledInPractice" BOOLEAN NOT NULL DEFAULT false,
    "spacedRepetitionConfig" JSONB NOT NULL DEFAULT '{"intervalsDays":[1,3,7,14,30],"defaultEaseFactor":2.5}',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudyTrack" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "targetRole" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StudyTrack_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Institution" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "acronym" TEXT NOT NULL,
    "state" TEXT,
    "websiteUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Institution_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExamBoard" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "acronym" TEXT NOT NULL,
    "websiteUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExamBoard_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Position" (
    "id" UUID NOT NULL,
    "studyTrackId" UUID NOT NULL,
    "institutionId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "state" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Position_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExamEdition" (
    "id" UUID NOT NULL,
    "positionId" UUID NOT NULL,
    "examBoardId" UUID NOT NULL,
    "rulesetId" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "examDate" TIMESTAMP(3),
    "phase" TEXT NOT NULL DEFAULT '1ª Fase - Prova Objetiva',
    "editionCode" TEXT NOT NULL,
    "officialNoticeUrl" TEXT,
    "status" "ExamEditionStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExamEdition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExamForm" (
    "id" UUID NOT NULL,
    "examEditionId" UUID NOT NULL,
    "versionLabel" TEXT NOT NULL,
    "colorOrType" TEXT,
    "language" TEXT NOT NULL DEFAULT 'pt-BR',
    "notes" TEXT,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExamForm_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Subject" (
    "id" UUID NOT NULL,
    "parentId" UUID,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "code" TEXT,
    "isLegalSubject" BOOLEAN NOT NULL DEFAULT false,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Subject_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuestionSubject" (
    "id" UUID NOT NULL,
    "questionId" UUID NOT NULL,
    "subjectId" UUID NOT NULL,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "QuestionSubject_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Question" (
    "id" UUID NOT NULL,
    "questionType" "QuestionType" NOT NULL DEFAULT 'MULTIPLE_CHOICE',
    "statement" TEXT NOT NULL,
    "supportText" TEXT,
    "instruction" TEXT,
    "status" "QuestionStatus" NOT NULL DEFAULT 'DRAFT',
    "difficulty" "DifficultyLevel" NOT NULL DEFAULT 'MEDIUM',
    "canonicalHash" TEXT NOT NULL,
    "isOutdated" BOOLEAN NOT NULL DEFAULT false,
    "outdatedNotes" TEXT,
    "importedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "validatedAt" TIMESTAMP(3),
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Question_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuestionOption" (
    "id" UUID NOT NULL,
    "questionId" UUID NOT NULL,
    "label" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "displayOrder" INTEGER NOT NULL,

    CONSTRAINT "QuestionOption_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuestionAsset" (
    "id" UUID NOT NULL,
    "questionId" UUID NOT NULL,
    "assetType" TEXT NOT NULL,
    "storagePath" TEXT NOT NULL,
    "objectUrl" TEXT,
    "sha256" TEXT,
    "caption" TEXT,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QuestionAsset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExamQuestionInstance" (
    "id" UUID NOT NULL,
    "examFormId" UUID NOT NULL,
    "questionId" UUID NOT NULL,
    "originalNumber" INTEGER NOT NULL,
    "displayOrder" INTEGER NOT NULL,
    "optionMapping" JSONB,
    "isAnnulled" BOOLEAN NOT NULL DEFAULT false,
    "annulmentReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExamQuestionInstance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuestionRevision" (
    "id" UUID NOT NULL,
    "questionId" UUID NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "previousSnapshot" JSONB NOT NULL,
    "newSnapshot" JSONB NOT NULL,
    "reason" TEXT NOT NULL,
    "changedByUserId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QuestionRevision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OfficialAnswerKey" (
    "id" UUID NOT NULL,
    "examQuestionInstanceId" UUID NOT NULL,
    "sourceDocumentId" UUID,
    "answerValue" TEXT NOT NULL,
    "status" "AnswerKeyStatus" NOT NULL DEFAULT 'DEFINITIVE',
    "revisionNumber" INTEGER NOT NULL DEFAULT 1,
    "isDefinitive" BOOLEAN NOT NULL DEFAULT true,
    "justification" TEXT,
    "publishedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OfficialAnswerKey_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudySession" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "trackId" UUID,
    "mode" "StudySessionMode" NOT NULL DEFAULT 'PRACTICE',
    "title" TEXT,
    "filtersJson" JSONB NOT NULL DEFAULT '{}',
    "totalQuestions" INTEGER NOT NULL DEFAULT 0,
    "answeredCount" INTEGER NOT NULL DEFAULT 0,
    "correctCount" INTEGER NOT NULL DEFAULT 0,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),

    CONSTRAINT "StudySession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuestionAttempt" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "questionId" UUID NOT NULL,
    "examQuestionInstanceId" UUID NOT NULL,
    "studySessionId" UUID,
    "officialKeyRevisionId" UUID NOT NULL,
    "selectedAnswer" TEXT,
    "isBlank" BOOLEAN NOT NULL DEFAULT false,
    "isCorrect" BOOLEAN NOT NULL,
    "awardedPoints" DECIMAL(6,2) NOT NULL DEFAULT 0,
    "timeSpentSeconds" INTEGER NOT NULL DEFAULT 0,
    "attemptNumber" INTEGER NOT NULL DEFAULT 1,
    "idempotencyKey" TEXT,
    "answeredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QuestionAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserProgress" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "studyTrackId" UUID NOT NULL,
    "subjectId" UUID NOT NULL,
    "uniqueQuestionsAttempted" INTEGER NOT NULL DEFAULT 0,
    "uniqueQuestionsCorrectFirstTry" INTEGER NOT NULL DEFAULT 0,
    "uniqueQuestionsRecovered" INTEGER NOT NULL DEFAULT 0,
    "totalAttempts" INTEGER NOT NULL DEFAULT 0,
    "totalCorrectAttempts" INTEGER NOT NULL DEFAULT 0,
    "totalTimeSpentSeconds" INTEGER NOT NULL DEFAULT 0,
    "accuracyRate" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "lastAnsweredAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserProgress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReviewQueue" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "questionId" UUID NOT NULL,
    "examQuestionInstanceId" UUID NOT NULL,
    "status" "ReviewQueueStatus" NOT NULL DEFAULT 'PENDING',
    "priority" INTEGER NOT NULL DEFAULT 1,
    "intervalDays" INTEGER NOT NULL DEFAULT 1,
    "easeFactor" DECIMAL(4,2) NOT NULL DEFAULT 2.50,
    "consecutiveCorrect" INTEGER NOT NULL DEFAULT 0,
    "errorCount" INTEGER NOT NULL DEFAULT 1,
    "declaredDifficulty" "DifficultyLevel",
    "lastReviewedAt" TIMESTAMP(3),
    "nextReviewAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReviewQueue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Bookmark" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "questionId" UUID NOT NULL,
    "tag" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Bookmark_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudyNote" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "questionId" UUID NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StudyNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SavedFilter" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "studyTrackCode" TEXT,
    "filtersJson" JSONB NOT NULL,
    "isPinned" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SavedFilter_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExamRuleset" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "questionType" "QuestionType" NOT NULL DEFAULT 'MULTIPLE_CHOICE',
    "optionsCount" INTEGER NOT NULL DEFAULT 5,
    "correctPoints" DECIMAL(6,2) NOT NULL DEFAULT 1.00,
    "wrongPoints" DECIMAL(6,2) NOT NULL DEFAULT 0.00,
    "blankPoints" DECIMAL(6,2) NOT NULL DEFAULT 0.00,
    "annulledPolicy" "AnnulledScoringPolicy" NOT NULL DEFAULT 'AWARD_TO_ALL',
    "minPassingPercentage" DECIMAL(5,2) NOT NULL DEFAULT 50.00,
    "passingRulesJson" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExamRuleset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Simulation" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "studyTrackId" UUID,
    "examEditionId" UUID,
    "examFormId" UUID,
    "title" TEXT NOT NULL,
    "mode" "SimulationMode" NOT NULL DEFAULT 'CUSTOM',
    "durationMinutes" INTEGER NOT NULL DEFAULT 240,
    "totalQuestions" INTEGER NOT NULL,
    "rulesetSnapshot" JSONB NOT NULL,
    "configurationJson" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Simulation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SimulationItem" (
    "id" UUID NOT NULL,
    "simulationId" UUID NOT NULL,
    "questionId" UUID NOT NULL,
    "examQuestionInstanceId" UUID NOT NULL,
    "subjectId" UUID,
    "position" INTEGER NOT NULL,
    "weight" DECIMAL(5,2) NOT NULL DEFAULT 1.00,

    CONSTRAINT "SimulationItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SimulationAttempt" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "simulationId" UUID NOT NULL,
    "status" "SimulationAttemptStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "timeSpentSeconds" INTEGER NOT NULL DEFAULT 0,
    "rawScore" DECIMAL(8,2) NOT NULL DEFAULT 0,
    "netScore" DECIMAL(8,2) NOT NULL DEFAULT 0,
    "maxScore" DECIMAL(8,2) NOT NULL DEFAULT 0,
    "percentageScore" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "correctCount" INTEGER NOT NULL DEFAULT 0,
    "wrongCount" INTEGER NOT NULL DEFAULT 0,
    "blankCount" INTEGER NOT NULL DEFAULT 0,
    "annulledCount" INTEGER NOT NULL DEFAULT 0,
    "breakdownJson" JSONB NOT NULL DEFAULT '{}',

    CONSTRAINT "SimulationAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SimulationResponse" (
    "id" UUID NOT NULL,
    "simulationAttemptId" UUID NOT NULL,
    "simulationItemId" UUID NOT NULL,
    "officialKeyRevisionId" UUID,
    "selectedAnswer" TEXT,
    "isBlank" BOOLEAN NOT NULL DEFAULT true,
    "isCorrect" BOOLEAN NOT NULL DEFAULT false,
    "isAnnulled" BOOLEAN NOT NULL DEFAULT false,
    "markedForReview" BOOLEAN NOT NULL DEFAULT false,
    "awardedPoints" DECIMAL(6,2) NOT NULL DEFAULT 0,
    "timeSpentSeconds" INTEGER NOT NULL DEFAULT 0,
    "answeredAt" TIMESTAMP(3),

    CONSTRAINT "SimulationResponse_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notebook" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "studyTrackId" UUID,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "notebookType" "NotebookType" NOT NULL DEFAULT 'CUSTOM',
    "isSystemAutoErrors" BOOLEAN NOT NULL DEFAULT false,
    "colorHex" TEXT NOT NULL DEFAULT '#183A54',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Notebook_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotebookQuestion" (
    "id" UUID NOT NULL,
    "notebookId" UUID NOT NULL,
    "questionId" UUID NOT NULL,
    "examQuestionInstanceId" UUID,
    "addedReason" TEXT,
    "position" INTEGER NOT NULL DEFAULT 0,
    "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NotebookQuestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SourceDocument" (
    "id" UUID NOT NULL,
    "examEditionId" UUID NOT NULL,
    "examFormId" UUID,
    "documentType" "SourceDocumentType" NOT NULL,
    "title" TEXT NOT NULL,
    "officialUrl" TEXT NOT NULL,
    "storageKey" TEXT,
    "sha256" TEXT NOT NULL,
    "fileSizeBytes" INTEGER,
    "mimeType" TEXT NOT NULL DEFAULT 'application/pdf',
    "versionLabel" TEXT,
    "sourceDate" TIMESTAMP(3),
    "retrievedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "rightsNotes" TEXT,
    "verificationStatus" "VerificationStatus" NOT NULL DEFAULT 'VERIFIED',

    CONSTRAINT "SourceDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuestionSource" (
    "id" UUID NOT NULL,
    "questionId" UUID NOT NULL,
    "sourceDocumentId" UUID NOT NULL,
    "pageNumber" INTEGER,
    "sourceReference" TEXT,
    "extractedSnippetHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QuestionSource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImportJob" (
    "id" UUID NOT NULL,
    "examEditionId" UUID NOT NULL,
    "examFormId" UUID NOT NULL,
    "examPdfDocumentId" UUID NOT NULL,
    "answerKeyDocumentId" UUID,
    "status" "ImportJobStatus" NOT NULL DEFAULT 'PENDING',
    "currentStage" TEXT NOT NULL DEFAULT 'REGISTERED',
    "totalDetected" INTEGER NOT NULL DEFAULT 0,
    "totalStructured" INTEGER NOT NULL DEFAULT 0,
    "totalValidated" INTEGER NOT NULL DEFAULT 0,
    "totalPublished" INTEGER NOT NULL DEFAULT 0,
    "errorMessage" TEXT,
    "logsJson" JSONB NOT NULL DEFAULT '[]',
    "idempotencyKey" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ImportJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImportJobItem" (
    "id" UUID NOT NULL,
    "importJobId" UUID NOT NULL,
    "questionId" UUID,
    "originalNumber" INTEGER NOT NULL,
    "rawExtractedText" TEXT NOT NULL,
    "structuredPayloadJson" JSONB NOT NULL,
    "detectedAnswerKey" TEXT,
    "validationStatus" "VerificationStatus" NOT NULL DEFAULT 'PENDING',
    "validationErrorsJson" JSONB NOT NULL DEFAULT '[]',
    "reviewerNotes" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ImportJobItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContentReviewLog" (
    "id" UUID NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" UUID NOT NULL,
    "action" TEXT NOT NULL,
    "previousStatus" TEXT,
    "newStatus" TEXT,
    "notes" TEXT,
    "metadataJson" JSONB NOT NULL DEFAULT '{}',
    "reviewerUserId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContentReviewLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LegalSource" (
    "id" UUID NOT NULL,
    "sourceType" "LegalSourceType" NOT NULL,
    "authority" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "officialUrl" TEXT NOT NULL,
    "documentNumber" TEXT,
    "jurisdiction" TEXT NOT NULL DEFAULT 'BR-FEDERAL',
    "publishedAt" TIMESTAMP(3),
    "effectiveFrom" TIMESTAMP(3),
    "effectiveTo" TIMESTAMP(3),
    "lastCheckedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "verificationStatus" "VerificationStatus" NOT NULL DEFAULT 'VERIFIED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LegalSource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LegalPassage" (
    "id" UUID NOT NULL,
    "legalSourceId" UUID NOT NULL,
    "referenceLabel" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "textHash" TEXT NOT NULL,
    "effectiveFrom" TIMESTAMP(3),
    "effectiveTo" TIMESTAMP(3),
    "isCurrentlyInForce" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LegalPassage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuestionExplanation" (
    "id" UUID NOT NULL,
    "questionId" UUID NOT NULL,
    "officialKeyRevisionId" UUID NOT NULL,
    "status" "ExplanationStatus" NOT NULL DEFAULT 'PENDING_VERIFICATION',
    "summary" TEXT NOT NULL,
    "correctOptionAnalysis" TEXT NOT NULL,
    "wrongOptionsAnalysisJson" JSONB NOT NULL DEFAULT '{}',
    "historicalUnderstanding" TEXT NOT NULL,
    "currentUnderstanding" TEXT NOT NULL,
    "hasDivergenceOrUpdate" BOOLEAN NOT NULL DEFAULT false,
    "divergenceNote" TEXT,
    "modelId" TEXT NOT NULL,
    "promptVersion" TEXT NOT NULL DEFAULT 'v1.0',
    "sourceSnapshotHash" TEXT NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "verifiedAt" TIMESTAMP(3),
    "lastCheckedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QuestionExplanation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExplanationCitation" (
    "id" UUID NOT NULL,
    "explanationId" UUID NOT NULL,
    "legalSourceId" UUID NOT NULL,
    "legalPassageId" UUID,
    "claimReference" TEXT NOT NULL,
    "quotedSnippet" TEXT,
    "isVerifiedAtExamDate" BOOLEAN NOT NULL DEFAULT true,
    "isVerifiedCurrently" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExplanationCitation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LegalUpdateCheck" (
    "id" UUID NOT NULL,
    "legalSourceId" UUID NOT NULL,
    "explanationId" UUID,
    "checkStatus" TEXT NOT NULL,
    "changeDetected" BOOLEAN NOT NULL DEFAULT false,
    "findingsSummary" TEXT NOT NULL,
    "previousHash" TEXT,
    "newHash" TEXT,
    "checkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LegalUpdateCheck_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "UserSettings_userId_key" ON "UserSettings"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "StudyTrack_code_key" ON "StudyTrack"("code");

-- CreateIndex
CREATE INDEX "StudyTrack_isActive_displayOrder_idx" ON "StudyTrack"("isActive", "displayOrder");

-- CreateIndex
CREATE UNIQUE INDEX "Institution_acronym_key" ON "Institution"("acronym");

-- CreateIndex
CREATE UNIQUE INDEX "ExamBoard_acronym_key" ON "ExamBoard"("acronym");

-- CreateIndex
CREATE UNIQUE INDEX "Position_code_key" ON "Position"("code");

-- CreateIndex
CREATE INDEX "Position_studyTrackId_isActive_idx" ON "Position"("studyTrackId", "isActive");

-- CreateIndex
CREATE INDEX "Position_institutionId_idx" ON "Position"("institutionId");

-- CreateIndex
CREATE UNIQUE INDEX "ExamEdition_editionCode_key" ON "ExamEdition"("editionCode");

-- CreateIndex
CREATE INDEX "ExamEdition_positionId_examBoardId_year_idx" ON "ExamEdition"("positionId", "examBoardId", "year");

-- CreateIndex
CREATE INDEX "ExamEdition_examBoardId_year_idx" ON "ExamEdition"("examBoardId", "year");

-- CreateIndex
CREATE INDEX "ExamEdition_status_idx" ON "ExamEdition"("status");

-- CreateIndex
CREATE INDEX "ExamForm_examEditionId_idx" ON "ExamForm"("examEditionId");

-- CreateIndex
CREATE UNIQUE INDEX "ExamForm_examEditionId_versionLabel_key" ON "ExamForm"("examEditionId", "versionLabel");

-- CreateIndex
CREATE UNIQUE INDEX "Subject_slug_key" ON "Subject"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Subject_code_key" ON "Subject"("code");

-- CreateIndex
CREATE INDEX "Subject_parentId_displayOrder_idx" ON "Subject"("parentId", "displayOrder");

-- CreateIndex
CREATE INDEX "QuestionSubject_subjectId_isPrimary_idx" ON "QuestionSubject"("subjectId", "isPrimary");

-- CreateIndex
CREATE INDEX "QuestionSubject_questionId_idx" ON "QuestionSubject"("questionId");

-- CreateIndex
CREATE UNIQUE INDEX "QuestionSubject_questionId_subjectId_key" ON "QuestionSubject"("questionId", "subjectId");

-- CreateIndex
CREATE UNIQUE INDEX "Question_canonicalHash_key" ON "Question"("canonicalHash");

-- CreateIndex
CREATE INDEX "Question_status_difficulty_idx" ON "Question"("status", "difficulty");

-- CreateIndex
CREATE INDEX "Question_status_isOutdated_idx" ON "Question"("status", "isOutdated");

-- CreateIndex
CREATE INDEX "Question_publishedAt_idx" ON "Question"("publishedAt");

-- CreateIndex
CREATE INDEX "QuestionOption_questionId_displayOrder_idx" ON "QuestionOption"("questionId", "displayOrder");

-- CreateIndex
CREATE UNIQUE INDEX "QuestionOption_questionId_label_key" ON "QuestionOption"("questionId", "label");

-- CreateIndex
CREATE INDEX "QuestionAsset_questionId_position_idx" ON "QuestionAsset"("questionId", "position");

-- CreateIndex
CREATE INDEX "ExamQuestionInstance_questionId_idx" ON "ExamQuestionInstance"("questionId");

-- CreateIndex
CREATE INDEX "ExamQuestionInstance_examFormId_displayOrder_idx" ON "ExamQuestionInstance"("examFormId", "displayOrder");

-- CreateIndex
CREATE UNIQUE INDEX "ExamQuestionInstance_examFormId_originalNumber_key" ON "ExamQuestionInstance"("examFormId", "originalNumber");

-- CreateIndex
CREATE UNIQUE INDEX "ExamQuestionInstance_examFormId_questionId_key" ON "ExamQuestionInstance"("examFormId", "questionId");

-- CreateIndex
CREATE INDEX "QuestionRevision_questionId_idx" ON "QuestionRevision"("questionId");

-- CreateIndex
CREATE UNIQUE INDEX "QuestionRevision_questionId_versionNumber_key" ON "QuestionRevision"("questionId", "versionNumber");

-- CreateIndex
CREATE INDEX "OfficialAnswerKey_examQuestionInstanceId_isDefinitive_idx" ON "OfficialAnswerKey"("examQuestionInstanceId", "isDefinitive");

-- CreateIndex
CREATE INDEX "OfficialAnswerKey_status_idx" ON "OfficialAnswerKey"("status");

-- CreateIndex
CREATE UNIQUE INDEX "OfficialAnswerKey_examQuestionInstanceId_revisionNumber_key" ON "OfficialAnswerKey"("examQuestionInstanceId", "revisionNumber");

-- CreateIndex
CREATE INDEX "StudySession_userId_startedAt_idx" ON "StudySession"("userId", "startedAt");

-- CreateIndex
CREATE INDEX "StudySession_userId_trackId_idx" ON "StudySession"("userId", "trackId");

-- CreateIndex
CREATE UNIQUE INDEX "QuestionAttempt_idempotencyKey_key" ON "QuestionAttempt"("idempotencyKey");

-- CreateIndex
CREATE INDEX "QuestionAttempt_userId_answeredAt_idx" ON "QuestionAttempt"("userId", "answeredAt");

-- CreateIndex
CREATE INDEX "QuestionAttempt_userId_isCorrect_idx" ON "QuestionAttempt"("userId", "isCorrect");

-- CreateIndex
CREATE INDEX "QuestionAttempt_userId_questionId_attemptNumber_idx" ON "QuestionAttempt"("userId", "questionId", "attemptNumber");

-- CreateIndex
CREATE INDEX "QuestionAttempt_questionId_idx" ON "QuestionAttempt"("questionId");

-- CreateIndex
CREATE INDEX "UserProgress_userId_studyTrackId_idx" ON "UserProgress"("userId", "studyTrackId");

-- CreateIndex
CREATE UNIQUE INDEX "UserProgress_userId_studyTrackId_subjectId_key" ON "UserProgress"("userId", "studyTrackId", "subjectId");

-- CreateIndex
CREATE INDEX "ReviewQueue_userId_status_nextReviewAt_idx" ON "ReviewQueue"("userId", "status", "nextReviewAt");

-- CreateIndex
CREATE INDEX "ReviewQueue_userId_priority_idx" ON "ReviewQueue"("userId", "priority");

-- CreateIndex
CREATE UNIQUE INDEX "ReviewQueue_userId_questionId_key" ON "ReviewQueue"("userId", "questionId");

-- CreateIndex
CREATE INDEX "Bookmark_userId_createdAt_idx" ON "Bookmark"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Bookmark_userId_questionId_key" ON "Bookmark"("userId", "questionId");

-- CreateIndex
CREATE UNIQUE INDEX "StudyNote_userId_questionId_key" ON "StudyNote"("userId", "questionId");

-- CreateIndex
CREATE INDEX "SavedFilter_userId_isPinned_idx" ON "SavedFilter"("userId", "isPinned");

-- CreateIndex
CREATE UNIQUE INDEX "ExamRuleset_code_key" ON "ExamRuleset"("code");

-- CreateIndex
CREATE INDEX "Simulation_userId_createdAt_idx" ON "Simulation"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "Simulation_studyTrackId_mode_idx" ON "Simulation"("studyTrackId", "mode");

-- CreateIndex
CREATE INDEX "SimulationItem_simulationId_idx" ON "SimulationItem"("simulationId");

-- CreateIndex
CREATE UNIQUE INDEX "SimulationItem_simulationId_position_key" ON "SimulationItem"("simulationId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "SimulationItem_simulationId_questionId_key" ON "SimulationItem"("simulationId", "questionId");

-- CreateIndex
CREATE INDEX "SimulationAttempt_userId_status_startedAt_idx" ON "SimulationAttempt"("userId", "status", "startedAt");

-- CreateIndex
CREATE INDEX "SimulationAttempt_simulationId_idx" ON "SimulationAttempt"("simulationId");

-- CreateIndex
CREATE INDEX "SimulationResponse_simulationAttemptId_idx" ON "SimulationResponse"("simulationAttemptId");

-- CreateIndex
CREATE UNIQUE INDEX "SimulationResponse_simulationAttemptId_simulationItemId_key" ON "SimulationResponse"("simulationAttemptId", "simulationItemId");

-- CreateIndex
CREATE INDEX "Notebook_userId_isSystemAutoErrors_idx" ON "Notebook"("userId", "isSystemAutoErrors");

-- CreateIndex
CREATE INDEX "Notebook_userId_studyTrackId_idx" ON "Notebook"("userId", "studyTrackId");

-- CreateIndex
CREATE INDEX "NotebookQuestion_notebookId_position_idx" ON "NotebookQuestion"("notebookId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "NotebookQuestion_notebookId_questionId_key" ON "NotebookQuestion"("notebookId", "questionId");

-- CreateIndex
CREATE UNIQUE INDEX "SourceDocument_sha256_key" ON "SourceDocument"("sha256");

-- CreateIndex
CREATE INDEX "SourceDocument_examEditionId_documentType_idx" ON "SourceDocument"("examEditionId", "documentType");

-- CreateIndex
CREATE INDEX "SourceDocument_verificationStatus_idx" ON "SourceDocument"("verificationStatus");

-- CreateIndex
CREATE INDEX "QuestionSource_sourceDocumentId_pageNumber_idx" ON "QuestionSource"("sourceDocumentId", "pageNumber");

-- CreateIndex
CREATE UNIQUE INDEX "QuestionSource_questionId_sourceDocumentId_key" ON "QuestionSource"("questionId", "sourceDocumentId");

-- CreateIndex
CREATE UNIQUE INDEX "ImportJob_idempotencyKey_key" ON "ImportJob"("idempotencyKey");

-- CreateIndex
CREATE INDEX "ImportJob_status_createdAt_idx" ON "ImportJob"("status", "createdAt");

-- CreateIndex
CREATE INDEX "ImportJob_examEditionId_examFormId_idx" ON "ImportJob"("examEditionId", "examFormId");

-- CreateIndex
CREATE INDEX "ImportJobItem_importJobId_validationStatus_idx" ON "ImportJobItem"("importJobId", "validationStatus");

-- CreateIndex
CREATE UNIQUE INDEX "ImportJobItem_importJobId_originalNumber_key" ON "ImportJobItem"("importJobId", "originalNumber");

-- CreateIndex
CREATE INDEX "ContentReviewLog_entityType_entityId_idx" ON "ContentReviewLog"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "ContentReviewLog_createdAt_idx" ON "ContentReviewLog"("createdAt");

-- CreateIndex
CREATE INDEX "LegalSource_sourceType_verificationStatus_idx" ON "LegalSource"("sourceType", "verificationStatus");

-- CreateIndex
CREATE INDEX "LegalSource_authority_documentNumber_idx" ON "LegalSource"("authority", "documentNumber");

-- CreateIndex
CREATE INDEX "LegalPassage_legalSourceId_isCurrentlyInForce_idx" ON "LegalPassage"("legalSourceId", "isCurrentlyInForce");

-- CreateIndex
CREATE UNIQUE INDEX "LegalPassage_legalSourceId_referenceLabel_textHash_key" ON "LegalPassage"("legalSourceId", "referenceLabel", "textHash");

-- CreateIndex
CREATE INDEX "QuestionExplanation_questionId_status_idx" ON "QuestionExplanation"("questionId", "status");

-- CreateIndex
CREATE INDEX "QuestionExplanation_status_idx" ON "QuestionExplanation"("status");

-- CreateIndex
CREATE UNIQUE INDEX "QuestionExplanation_questionId_officialKeyRevisionId_source_key" ON "QuestionExplanation"("questionId", "officialKeyRevisionId", "sourceSnapshotHash");

-- CreateIndex
CREATE INDEX "ExplanationCitation_explanationId_idx" ON "ExplanationCitation"("explanationId");

-- CreateIndex
CREATE INDEX "ExplanationCitation_legalSourceId_idx" ON "ExplanationCitation"("legalSourceId");

-- CreateIndex
CREATE INDEX "LegalUpdateCheck_legalSourceId_checkedAt_idx" ON "LegalUpdateCheck"("legalSourceId", "checkedAt");

-- AddForeignKey
ALTER TABLE "UserSettings" ADD CONSTRAINT "UserSettings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Position" ADD CONSTRAINT "Position_studyTrackId_fkey" FOREIGN KEY ("studyTrackId") REFERENCES "StudyTrack"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Position" ADD CONSTRAINT "Position_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExamEdition" ADD CONSTRAINT "ExamEdition_positionId_fkey" FOREIGN KEY ("positionId") REFERENCES "Position"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExamEdition" ADD CONSTRAINT "ExamEdition_examBoardId_fkey" FOREIGN KEY ("examBoardId") REFERENCES "ExamBoard"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExamEdition" ADD CONSTRAINT "ExamEdition_rulesetId_fkey" FOREIGN KEY ("rulesetId") REFERENCES "ExamRuleset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExamForm" ADD CONSTRAINT "ExamForm_examEditionId_fkey" FOREIGN KEY ("examEditionId") REFERENCES "ExamEdition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subject" ADD CONSTRAINT "Subject_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Subject"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestionSubject" ADD CONSTRAINT "QuestionSubject_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestionSubject" ADD CONSTRAINT "QuestionSubject_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestionOption" ADD CONSTRAINT "QuestionOption_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestionAsset" ADD CONSTRAINT "QuestionAsset_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExamQuestionInstance" ADD CONSTRAINT "ExamQuestionInstance_examFormId_fkey" FOREIGN KEY ("examFormId") REFERENCES "ExamForm"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExamQuestionInstance" ADD CONSTRAINT "ExamQuestionInstance_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestionRevision" ADD CONSTRAINT "QuestionRevision_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestionRevision" ADD CONSTRAINT "QuestionRevision_changedByUserId_fkey" FOREIGN KEY ("changedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OfficialAnswerKey" ADD CONSTRAINT "OfficialAnswerKey_examQuestionInstanceId_fkey" FOREIGN KEY ("examQuestionInstanceId") REFERENCES "ExamQuestionInstance"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OfficialAnswerKey" ADD CONSTRAINT "OfficialAnswerKey_sourceDocumentId_fkey" FOREIGN KEY ("sourceDocumentId") REFERENCES "SourceDocument"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudySession" ADD CONSTRAINT "StudySession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudySession" ADD CONSTRAINT "StudySession_trackId_fkey" FOREIGN KEY ("trackId") REFERENCES "StudyTrack"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestionAttempt" ADD CONSTRAINT "QuestionAttempt_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestionAttempt" ADD CONSTRAINT "QuestionAttempt_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestionAttempt" ADD CONSTRAINT "QuestionAttempt_examQuestionInstanceId_fkey" FOREIGN KEY ("examQuestionInstanceId") REFERENCES "ExamQuestionInstance"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestionAttempt" ADD CONSTRAINT "QuestionAttempt_studySessionId_fkey" FOREIGN KEY ("studySessionId") REFERENCES "StudySession"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestionAttempt" ADD CONSTRAINT "QuestionAttempt_officialKeyRevisionId_fkey" FOREIGN KEY ("officialKeyRevisionId") REFERENCES "OfficialAnswerKey"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserProgress" ADD CONSTRAINT "UserProgress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserProgress" ADD CONSTRAINT "UserProgress_studyTrackId_fkey" FOREIGN KEY ("studyTrackId") REFERENCES "StudyTrack"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserProgress" ADD CONSTRAINT "UserProgress_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewQueue" ADD CONSTRAINT "ReviewQueue_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewQueue" ADD CONSTRAINT "ReviewQueue_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewQueue" ADD CONSTRAINT "ReviewQueue_examQuestionInstanceId_fkey" FOREIGN KEY ("examQuestionInstanceId") REFERENCES "ExamQuestionInstance"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bookmark" ADD CONSTRAINT "Bookmark_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bookmark" ADD CONSTRAINT "Bookmark_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudyNote" ADD CONSTRAINT "StudyNote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudyNote" ADD CONSTRAINT "StudyNote_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SavedFilter" ADD CONSTRAINT "SavedFilter_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Simulation" ADD CONSTRAINT "Simulation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Simulation" ADD CONSTRAINT "Simulation_studyTrackId_fkey" FOREIGN KEY ("studyTrackId") REFERENCES "StudyTrack"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Simulation" ADD CONSTRAINT "Simulation_examEditionId_fkey" FOREIGN KEY ("examEditionId") REFERENCES "ExamEdition"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Simulation" ADD CONSTRAINT "Simulation_examFormId_fkey" FOREIGN KEY ("examFormId") REFERENCES "ExamForm"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SimulationItem" ADD CONSTRAINT "SimulationItem_simulationId_fkey" FOREIGN KEY ("simulationId") REFERENCES "Simulation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SimulationItem" ADD CONSTRAINT "SimulationItem_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SimulationItem" ADD CONSTRAINT "SimulationItem_examQuestionInstanceId_fkey" FOREIGN KEY ("examQuestionInstanceId") REFERENCES "ExamQuestionInstance"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SimulationItem" ADD CONSTRAINT "SimulationItem_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SimulationAttempt" ADD CONSTRAINT "SimulationAttempt_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SimulationAttempt" ADD CONSTRAINT "SimulationAttempt_simulationId_fkey" FOREIGN KEY ("simulationId") REFERENCES "Simulation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SimulationResponse" ADD CONSTRAINT "SimulationResponse_simulationAttemptId_fkey" FOREIGN KEY ("simulationAttemptId") REFERENCES "SimulationAttempt"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SimulationResponse" ADD CONSTRAINT "SimulationResponse_simulationItemId_fkey" FOREIGN KEY ("simulationItemId") REFERENCES "SimulationItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SimulationResponse" ADD CONSTRAINT "SimulationResponse_officialKeyRevisionId_fkey" FOREIGN KEY ("officialKeyRevisionId") REFERENCES "OfficialAnswerKey"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notebook" ADD CONSTRAINT "Notebook_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notebook" ADD CONSTRAINT "Notebook_studyTrackId_fkey" FOREIGN KEY ("studyTrackId") REFERENCES "StudyTrack"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotebookQuestion" ADD CONSTRAINT "NotebookQuestion_notebookId_fkey" FOREIGN KEY ("notebookId") REFERENCES "Notebook"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotebookQuestion" ADD CONSTRAINT "NotebookQuestion_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotebookQuestion" ADD CONSTRAINT "NotebookQuestion_examQuestionInstanceId_fkey" FOREIGN KEY ("examQuestionInstanceId") REFERENCES "ExamQuestionInstance"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SourceDocument" ADD CONSTRAINT "SourceDocument_examEditionId_fkey" FOREIGN KEY ("examEditionId") REFERENCES "ExamEdition"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SourceDocument" ADD CONSTRAINT "SourceDocument_examFormId_fkey" FOREIGN KEY ("examFormId") REFERENCES "ExamForm"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestionSource" ADD CONSTRAINT "QuestionSource_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestionSource" ADD CONSTRAINT "QuestionSource_sourceDocumentId_fkey" FOREIGN KEY ("sourceDocumentId") REFERENCES "SourceDocument"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImportJob" ADD CONSTRAINT "ImportJob_examEditionId_fkey" FOREIGN KEY ("examEditionId") REFERENCES "ExamEdition"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImportJob" ADD CONSTRAINT "ImportJob_examFormId_fkey" FOREIGN KEY ("examFormId") REFERENCES "ExamForm"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImportJob" ADD CONSTRAINT "ImportJob_examPdfDocumentId_fkey" FOREIGN KEY ("examPdfDocumentId") REFERENCES "SourceDocument"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImportJob" ADD CONSTRAINT "ImportJob_answerKeyDocumentId_fkey" FOREIGN KEY ("answerKeyDocumentId") REFERENCES "SourceDocument"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImportJobItem" ADD CONSTRAINT "ImportJobItem_importJobId_fkey" FOREIGN KEY ("importJobId") REFERENCES "ImportJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImportJobItem" ADD CONSTRAINT "ImportJobItem_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentReviewLog" ADD CONSTRAINT "ContentReviewLog_reviewerUserId_fkey" FOREIGN KEY ("reviewerUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LegalPassage" ADD CONSTRAINT "LegalPassage_legalSourceId_fkey" FOREIGN KEY ("legalSourceId") REFERENCES "LegalSource"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestionExplanation" ADD CONSTRAINT "QuestionExplanation_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestionExplanation" ADD CONSTRAINT "QuestionExplanation_officialKeyRevisionId_fkey" FOREIGN KEY ("officialKeyRevisionId") REFERENCES "OfficialAnswerKey"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExplanationCitation" ADD CONSTRAINT "ExplanationCitation_explanationId_fkey" FOREIGN KEY ("explanationId") REFERENCES "QuestionExplanation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExplanationCitation" ADD CONSTRAINT "ExplanationCitation_legalSourceId_fkey" FOREIGN KEY ("legalSourceId") REFERENCES "LegalSource"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExplanationCitation" ADD CONSTRAINT "ExplanationCitation_legalPassageId_fkey" FOREIGN KEY ("legalPassageId") REFERENCES "LegalPassage"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LegalUpdateCheck" ADD CONSTRAINT "LegalUpdateCheck_legalSourceId_fkey" FOREIGN KEY ("legalSourceId") REFERENCES "LegalSource"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LegalUpdateCheck" ADD CONSTRAINT "LegalUpdateCheck_explanationId_fkey" FOREIGN KEY ("explanationId") REFERENCES "QuestionExplanation"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Full Text Search (Português) index for Question statement and supportText
CREATE INDEX IF NOT EXISTS "Question_fts_pt_idx"
ON "Question"
USING GIN (to_tsvector('portuguese', coalesce("statement", '') || ' ' || coalesce("supportText", '')));
