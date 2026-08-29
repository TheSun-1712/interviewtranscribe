const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const { uploadAudio } = require("../services/cloudinary");
const { transcribeAudio } = require("../services/transcription");
const { cleanTranscriptWithLLM } = require("../services/llm");

const router = express.Router();

// Multer storage setup for uploads directory
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

      // Calculate take number
      const existingTakes = await prisma.recording.count({
        where: { sessionId, questionId }
      });
      const takeNumber = existingTakes + 1;

      // Handle audio upload URL & transcription
      let audioUrl = null;
      let rawTranscript = manualTranscript?.trim() || "";

      if (req.file) {
        const filePath = req.file.path;

        // 1. Upload to Cloudinary (or local fallback)
        audioUrl = await uploadAudio(filePath);

        // 2. Transcribe audio using Groq Whisper API
        const aiTranscript = await transcribeAudio(filePath);
        if (aiTranscript) {
          rawTranscript = aiTranscript;
        }
      }

      if (!rawTranscript || rawTranscript.includes("[No verbal transcript")) {
        rawTranscript = "[No verbal transcript recorded]";
      }

      // 3. Optional LLM cleanup pass
      const settingsList = await prisma.settings.findMany();
      const settingsMap = {};
      settingsList.forEach((s) => (settingsMap[s.key] = s.value));

      const cleanTranscript = await cleanTranscriptWithLLM(rawTranscript, settingsMap);

      // Deactivate previous takes if new take is primary
      await prisma.recording.updateMany({
        where: { sessionId, questionId },
        data: { isActive: false }
      });

      // Save to Database
      const recording = await prisma.recording.create({
        data: {
          sessionId,
          questionId,
          takeNumber,
          audioUrl,
          rawTranscript,
          cleanTranscript,
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
