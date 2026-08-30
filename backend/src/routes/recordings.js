const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const { uploadAudio } = require("../services/cloudinary");
const { transcribeAudio } = require("../services/transcription");
const { summarizeCandidateResponse } = require("../services/llm");

const router = express.Router();

const uploadsDir = path.join(__dirname, "../../uploads/recordings");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || ".webm";
    cb(null, `rec_${Date.now()}_${Math.random().toString(36).substring(7)}${ext}`);
  }
});

const upload = multer({ storage });

module.exports = (prisma) => {
  // GET recordings for question or session
  router.get("/", async (req, res) => {
    try {
      const { sessionId, questionId } = req.query;
      const where = {};
      if (sessionId) where.sessionId = sessionId;
      if (questionId) where.questionId = questionId;

      const recordings = await prisma.recording.findMany({
        where,
        orderBy: { recordedAt: "asc" },
        include: { question: true, session: true }
      });
      res.json(recordings);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // POST create recording (multipart audio upload)
  router.post("/", upload.single("audio"), async (req, res) => {
    try {
      const { sessionId, questionId, durationSec, notes, manualTranscript } = req.body;
      if (!sessionId || !questionId) {
        return res.status(400).json({ error: "sessionId and questionId are required" });
      }

      // 1. Ensure Session exists in DB
      let existingSession = await prisma.session.findUnique({ where: { id: sessionId } });
      if (!existingSession) {
        let firstCand = await prisma.candidate.findFirst();
        if (!firstCand) {
          firstCand = await prisma.candidate.create({
            data: { name: "Candidate 1", role: "Software Engineer", status: "in_progress" }
          });
        }
        existingSession = await prisma.session.create({
          data: {
            id: sessionId,
            candidateId: firstCand.id,
            interviewer: "Lead Interviewer",
            status: "in_progress"
          }
        });
      }

      // 2. Ensure Question exists in DB
      let targetQuestion = await prisma.question.findUnique({ where: { id: questionId } });
      if (!targetQuestion) {
        const allQs = await prisma.question.findMany();
        targetQuestion = allQs[0] || (await prisma.question.create({
          data: { category: "Technical", text: "Interview Question", isCustom: true }
        }));
      }

      // Calculate take number
      const existingTakes = await prisma.recording.count({
        where: { sessionId: existingSession.id, questionId: targetQuestion.id }
      });
      const takeNumber = existingTakes + 1;

      // Handle audio upload URL & transcription
      let audioUrl = null;
      let rawTranscript = manualTranscript?.trim() || "";

      if (req.file) {
        const filePath = req.file.path;

        // Upload to Cloudinary (or local fallback)
        audioUrl = await uploadAudio(filePath);

        // Transcribe audio using Groq Whisper API
        const aiTranscript = await transcribeAudio(filePath);
        if (aiTranscript) {
          rawTranscript = aiTranscript;
        }
      }

      if (!rawTranscript || rawTranscript.includes("[No verbal transcript")) {
        rawTranscript = "[No verbal transcript recorded]";
      }

      // Generate AI Answer Summary
      const settingsList = await prisma.settings.findMany();
      const settingsMap = {};
      settingsList.forEach((s) => (settingsMap[s.key] = s.value));

      const aiSummary = await summarizeCandidateResponse(rawTranscript, targetQuestion?.text || "", settingsMap);

      // Deactivate previous takes if new take is primary
      await prisma.recording.updateMany({
        where: { sessionId: existingSession.id, questionId: targetQuestion.id },
        data: { isActive: false }
      });

      // Save to Database
      const recording = await prisma.recording.create({
        data: {
          sessionId: existingSession.id,
          questionId: targetQuestion.id,
          takeNumber,
          audioUrl,
          rawTranscript,
          cleanTranscript: rawTranscript,
          aiSummary: aiSummary || rawTranscript.slice(0, 150),
          durationSec: parseInt(durationSec) || 0,
          notes: notes?.trim() || "",
          isActive: true
        },
        include: { question: true }
      });

      res.status(201).json(recording);
    } catch (err) {
      console.error("Recording creation error:", err);
      res.status(500).json({ error: err.message });
    }
  });

  // PATCH toggle active take
  router.patch("/:id/active", async (req, res) => {
    try {
      const recording = await prisma.recording.findUnique({
        where: { id: req.params.id }
      });
      if (!recording) return res.status(404).json({ error: "Recording not found" });

      // Deactivate all sister takes for this question
      await prisma.recording.updateMany({
        where: { sessionId: recording.sessionId, questionId: recording.questionId },
        data: { isActive: false }
      });

      // Set target active
      const updated = await prisma.recording.update({
        where: { id: req.params.id },
        data: { isActive: true }
      });

      res.json(updated);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // DELETE recording take
  router.delete("/:id", async (req, res) => {
    try {
      await prisma.recording.delete({
        where: { id: req.params.id }
      });
      res.json({ success: true, message: "Recording take deleted" });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  return router;
};
