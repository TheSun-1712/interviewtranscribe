-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'interviewer',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Settings" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,

    CONSTRAINT "Settings_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "Candidate" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "domainsAppliedFor" TEXT,
    "branchAndSection" TEXT,
    "domainInAAC" TEXT,
    "cgpa" TEXT,
    "currentAttendance" TEXT,
    "role" TEXT,
    "department" TEXT,
    "email" TEXT,
    "notes" TEXT,
    "status" TEXT NOT NULL DEFAULT 'not_started',
    "isFlagged" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Candidate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Question" (
    "id" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "category" TEXT,
    "description" TEXT,
    "isCustom" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Question_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "candidateId" TEXT NOT NULL,
    "userId" TEXT,
    "interviewer" TEXT DEFAULT 'Lead Interviewer',
    "fullAudioUrl" TEXT,
    "fullTranscript" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT NOT NULL DEFAULT 'in_progress',
    "recordingLockDevice" TEXT,
    "lockAcquiredAt" TIMESTAMP(3),
    "isTranscribing" BOOLEAN NOT NULL DEFAULT false,
    "isAnalyzing" BOOLEAN NOT NULL DEFAULT false,
    "transcriptionStatus" TEXT NOT NULL DEFAULT 'none',
    "analysisStatus" TEXT NOT NULL DEFAULT 'none',

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AudioClip" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "filePath" TEXT NOT NULL,
    "audioUrl" TEXT NOT NULL,
    "durationSec" INTEGER,
    "transcript" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AudioClip_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Recording" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "takeNumber" INTEGER NOT NULL,
    "audioUrl" TEXT,
    "rawTranscript" TEXT,
    "cleanTranscript" TEXT,
    "aiSummary" TEXT,
    "keyPoints" TEXT,
    "score" DOUBLE PRECISION,
    "comments" TEXT,
    "durationSec" INTEGER,
    "notes" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Recording_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "Candidate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AudioClip" ADD CONSTRAINT "AudioClip_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Recording" ADD CONSTRAINT "Recording_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Recording" ADD CONSTRAINT "Recording_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question"("id") ON DELETE CASCADE ON UPDATE CASCADE;
