const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const { uploadAudio } = require("../services/cloudinary");
const { transcribeAudio } = require("../services/transcription");
const { parseAndDivideFullInterviewWithLLM } = require("../services/llm");

const router = express.Router();

const uploadsDir = path.join(__dirname, "../../uploads/recordings");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || ".webm";
    cb(null, `full_sess_${Date.now()}_${Math.random().toString(36).substring(7)}${ext}`);
  }
});

const upload = multer({ storage });

module.exports = (prisma) => {
  // GET all sessions
  router.get("/", async (req, res) => {
    try {
      const sessions = await prisma.session.findMany({
        orderBy: { startedAt: "desc" },
        include: {
          candidate: true,
          recordings: {
            include: { question: true }
          }
        }
      });
      res.json(sessions);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // GET session by ID
  router.get("/:id", async (req, res) => {
    try {
      const session = await prisma.session.findUnique({
        where: { id: req.params.id },
        include: {
          candidate: true,
          recordings: {
            include: { question: true },
            orderBy: { recordedAt: "asc" }
          }
        }
      });
      if (!session) return res.status(404).json({ error: "Session not found" });
      res.json(session);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // POST create new session
  router.post("/", async (req, res) => {
    try {
      const { candidateId, interviewer } = req.body;
      if (!candidateId) return res.status(400).json({ error: "candidateId is required" });

      // Ensure candidate exists
      const existingCand = await prisma.candidate.findUnique({ where: { id: candidateId } });
      if (!existingCand) {
        return res.status(404).json({ error: `Candidate with ID ${candidateId} not found` });
      }

      const session = await prisma.session.create({
        data: {
          candidateId,
          interviewer: interviewer || "Lead Interviewer",
          status: "in_progress"
        },
        include: { candidate: true }
      });

      await prisma.candidate.update({
        where: { id: candidateId },
        data: { status: "in_progress" }
      });

      res.status(201).json(session);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // POST upload single continuous full-interview recording
  router.post("/:id/full-recording", upload.single("audio"), async (req, res) => {
    try {
      const sessionId = req.params.id;
      if (!req.file) return res.status(400).json({ error: "Audio file is required" });

      const filePath = req.file.path;

      // 1. Upload full interview audio to Cloudinary
      const fullAudioUrl = await uploadAudio(filePath);

      // 2. Transcribe continuous audio with Groq Whisper Large V3 API
      const fullTranscript = await transcribeAudio(filePath);

      // 3. Fetch questions list & settings
      const questionsList = await prisma.question.findMany({ orderBy: { createdAt: "asc" } });
      const settingsList = await prisma.settings.findMany();
      const settingsMap = {};
      settingsList.forEach((s) => (settingsMap[s.key] = s.value));

      // 4. Auto-divide & analyze full interview using Groq Llama AI
      const dividedSections = await parseAndDivideFullInterviewWithLLM(fullTranscript, questionsList, settingsMap);

      // 5. Ensure Session row exists in DB
      let existingSession = await prisma.session.findUnique({ where: { id: sessionId } });
      if (!existingSession) {
        let candidateToUse = await prisma.candidate.findFirst();
        if (!candidateToUse) {
          candidateToUse = await prisma.candidate.create({
            data: { name: "Candidate 1", role: "Software Engineer", status: "in_progress" }
          });
        }

        existingSession = await prisma.session.create({
          data: {
            id: sessionId,
            candidateId: candidateToUse.id,
            interviewer: "Lead Interviewer",
            status: "in_progress"
          }
        });
      }

      const updatedSession = await prisma.session.update({
        where: { id: existingSession.id },
        data: {
          fullAudioUrl,
          fullTranscript,
          status: "complete"
        },
        include: { candidate: true }
      });

      // 6. Create section recording rows for each auto-partitioned question answer safely
      if (Array.isArray(dividedSections)) {
        for (const item of dividedSections) {
          const matchingQ =
            questionsList.find((q) => q.id === item.questionId) ||
            questionsList.find((q) => q.text.toLowerCase().trim() === item.questionText?.toLowerCase().trim()) ||
            questionsList.find((q, idx) => idx + 1 === Number(item.qNumber));

          const targetQuestion = matchingQ || questionsList[0];
          if (!targetQuestion) continue;

          try {
            await prisma.recording.create({
              data: {
                sessionId: existingSession.id,
                questionId: targetQuestion.id,
                takeNumber: 1,
                audioUrl: fullAudioUrl,
                rawTranscript: item.candidateAnswerOnly || item.fullSpokenSection || fullTranscript,
                cleanTranscript: item.candidateAnswerOnly || item.fullSpokenSection || fullTranscript,
                aiSummary: item.aiSummary || "Candidate answer recorded.",
                keyPoints: item.keyTakeaways || "Response saved.",
                durationSec: parseInt(req.body.durationSec) || 0,
                isActive: true
              }
            });
          } catch (recErr) {
            console.warn(`[Session Recording Creation Warning for Question ${targetQuestion.id}]:`, recErr.message);
          }
        }
      }

      await prisma.candidate.update({
        where: { id: updatedSession.candidateId },
        data: { status: "complete" }
      });

      const finalSession = await prisma.session.findUnique({
        where: { id: existingSession.id },
        include: {
          candidate: true,
          recordings: { include: { question: true } }
        }
      });

      res.json(finalSession);
    } catch (err) {
      console.error("Full recording processing error:", err);
      res.status(500).json({ error: err.message });
    }
  });

  // PATCH complete session
  router.patch("/:id/complete", async (req, res) => {
    try {
      const session = await prisma.session.update({
        where: { id: req.params.id },
        data: { status: "complete" },
        include: { candidate: true }
      });

      await prisma.candidate.update({
        where: { id: session.candidateId },
        data: { status: "complete" }
      });

      res.json(session);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  return router;
};
