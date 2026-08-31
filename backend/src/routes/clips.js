const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const { HOST_IP } = require("../services/cloudinary");
const { transcribeAudio } = require("../services/transcription");
const { parseAndDivideFullInterviewWithLLM } = require("../services/llm");

const uploadsDir = path.join(__dirname, "../../uploads/recordings");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || ".webm";
    cb(null, `clip_${Date.now()}_${Math.random().toString(36).substring(7)}${ext}`);
  }
});

const upload = multer({ storage });

// Lock expiry: 30 minutes (safety net if a device crashes)
const LOCK_EXPIRY_MS = 30 * 60 * 1000;

module.exports = (prisma, io) => {
  // ─────────────────────────────────────────────────────────────
  // ROUTER 1: /api/clips  — clip upload, list, delete
  // ─────────────────────────────────────────────────────────────
  const clipsRouter = express.Router();

  // POST /api/clips — Upload a single audio clip, save to disk
  clipsRouter.post("/", upload.single("audio"), async (req, res) => {
    try {
      const { sessionId, deviceId, durationSec } = req.body;
      if (!sessionId) return res.status(400).json({ error: "sessionId is required" });
      if (!req.file) return res.status(400).json({ error: "audio file is required" });

      const session = await prisma.session.findUnique({ where: { id: sessionId } });
      if (!session) return res.status(404).json({ error: "Session not found" });

      // Check lock ownership — only the device holding the lock may upload
      if (session.recordingLockDevice && session.recordingLockDevice !== deviceId) {
        const lockAge = session.lockAcquiredAt
          ? Date.now() - new Date(session.lockAcquiredAt).getTime()
          : 0;
        if (lockAge < LOCK_EXPIRY_MS) {
          return res.status(409).json({
            error: "Recording lock held by another device",
            lockedBy: session.recordingLockDevice
          });
        }
      }

      const filePath = req.file.path;
      const fileName = path.basename(filePath);
      const audioUrl = `http://${HOST_IP}:${process.env.PORT || 4000}/uploads/recordings/${fileName}`;

      const clip = await prisma.audioClip.create({
        data: {
          sessionId,
          filePath,
          audioUrl,
          durationSec: durationSec ? parseInt(durationSec) : null,
          status: "pending"
        }
      });

      // Release lock after upload completes
      await prisma.session.update({
        where: { id: sessionId },
        data: { recordingLockDevice: null, lockAcquiredAt: null }
      });

      if (io) {
        io.to(`session:${sessionId}`).emit("clip_saved", { clip, sessionId });
        io.to(`session:${sessionId}`).emit("lock_released", { sessionId });
      }

      res.status(201).json(clip);
    } catch (err) {
      console.error("[Clips] Upload error:", err);
      res.status(500).json({ error: err.message });
    }
  });

  // GET /api/clips?sessionId=xxx — List all clips for a session
  clipsRouter.get("/", async (req, res) => {
    try {
      const { sessionId } = req.query;
      if (!sessionId) return res.status(400).json({ error: "sessionId is required" });

      const clips = await prisma.audioClip.findMany({
        where: { sessionId },
        orderBy: { recordedAt: "asc" }
      });
      res.json(clips);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // DELETE /api/clips/:id — Delete a single clip
  clipsRouter.delete("/:id", async (req, res) => {
    try {
      const clip = await prisma.audioClip.findUnique({ where: { id: req.params.id } });
      if (!clip) return res.status(404).json({ error: "Clip not found" });

      if (clip.filePath && fs.existsSync(clip.filePath)) {
        try { fs.unlinkSync(clip.filePath); } catch (e) {}
      }

      await prisma.audioClip.delete({ where: { id: req.params.id } });

      if (io) {
        io.to(`session:${clip.sessionId}`).emit("clip_deleted", {
          clipId: clip.id,
          sessionId: clip.sessionId
        });
      }
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // ─────────────────────────────────────────────────────────────
  // ROUTER 2: /api/sessions — lock + transcribe + analyze ops
  // Mounted at /api/sessions so routes here match /:id/...
  // ─────────────────────────────────────────────────────────────
  const sessionOpsRouter = express.Router();

  // POST /api/sessions/:id/acquire-lock
  sessionOpsRouter.post("/:id/acquire-lock", async (req, res) => {
    try {
      const sessionId = req.params.id;
      const { deviceId } = req.body;
      if (!deviceId) return res.status(400).json({ error: "deviceId is required" });

      const session = await prisma.session.findUnique({ where: { id: sessionId } });
      if (!session) return res.status(404).json({ error: "Session not found" });

      if (session.recordingLockDevice && session.recordingLockDevice !== deviceId) {
        const lockAge = session.lockAcquiredAt
          ? Date.now() - new Date(session.lockAcquiredAt).getTime()
          : 0;
        if (lockAge < LOCK_EXPIRY_MS) {
          return res.status(409).json({
            error: "Already locked",
            lockedBy: session.recordingLockDevice
          });
        }
      }

      const updated = await prisma.session.update({
        where: { id: sessionId },
        data: { recordingLockDevice: deviceId, lockAcquiredAt: new Date() }
      });

      if (io) {
        io.to(`session:${sessionId}`).emit("recording_started", { sessionId, deviceId });
      }

      res.json({ acquired: true, session: updated });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // POST /api/sessions/:id/release-lock
  sessionOpsRouter.post("/:id/release-lock", async (req, res) => {
    try {
      const sessionId = req.params.id;
      await prisma.session.update({
        where: { id: sessionId },
        data: { recordingLockDevice: null, lockAcquiredAt: null }
      });

      if (io) {
        io.to(`session:${sessionId}`).emit("lock_released", { sessionId });
      }
      res.json({ released: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // POST /api/sessions/:id/transcribe
  sessionOpsRouter.post("/:id/transcribe", async (req, res) => {
    try {
      const sessionId = req.params.id;

      const session = await prisma.session.findUnique({
        where: { id: sessionId },
        include: { audioClips: { orderBy: { recordedAt: "asc" } } }
      });

      if (!session) return res.status(404).json({ error: "Session not found" });
      if (session.audioClips.length === 0) {
        return res.status(400).json({ error: "No audio clips to transcribe" });
      }

      await prisma.session.update({
        where: { id: sessionId },
        data: { isTranscribing: true, transcriptionStatus: "none" }
      });

      if (io) io.to(`session:${sessionId}`).emit("transcription_started", { sessionId });

      // Respond immediately — transcription runs in background
      res.json({ message: "Transcription started", sessionId });

      (async () => {
        try {
          const transcripts = [];

          for (const clip of session.audioClips) {
            if (clip.status === "done" && clip.transcript) {
              transcripts.push(clip.transcript);
              continue;
            }

            await prisma.audioClip.update({
              where: { id: clip.id },
              data: { status: "transcribing" }
            });

            if (io) io.to(`session:${sessionId}`).emit("clip_transcribing", { clipId: clip.id, sessionId });

            let transcript = "";
            try {
              transcript = await transcribeAudio(clip.filePath);
            } catch (e) {
              console.error(`[Transcribe] Clip ${clip.id} failed:`, e.message);
            }

            await prisma.audioClip.update({
              where: { id: clip.id },
              data: { transcript, status: transcript ? "done" : "error" }
            });

            if (transcript) transcripts.push(transcript);

            if (io) {
              io.to(`session:${sessionId}`).emit("clip_transcribed", { clipId: clip.id, sessionId, transcript });
            }
          }

          const fullTranscript = transcripts.filter(Boolean).join("\n\n");

          await prisma.session.update({
            where: { id: sessionId },
            data: { isTranscribing: false, transcriptionStatus: "done", fullTranscript }
          });

          if (io) io.to(`session:${sessionId}`).emit("transcription_done", { sessionId, fullTranscript });
        } catch (err) {
          console.error("[Transcribe] Background error:", err);
          await prisma.session.update({
            where: { id: sessionId },
            data: { isTranscribing: false, transcriptionStatus: "error" }
          });
          if (io) io.to(`session:${sessionId}`).emit("transcription_error", { sessionId, error: err.message });
        }
      })();

    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // POST /api/sessions/:id/analyze
  sessionOpsRouter.post("/:id/analyze", async (req, res) => {
    try {
      const sessionId = req.params.id;

      const session = await prisma.session.findUnique({
        where: { id: sessionId },
        include: { audioClips: true }
      });

      if (!session) return res.status(404).json({ error: "Session not found" });
      if (session.transcriptionStatus !== "done") {
        return res.status(400).json({ error: "Transcription must be completed first" });
      }
      if (!session.fullTranscript) {
        return res.status(400).json({ error: "No transcript available for analysis" });
      }

      await prisma.session.update({
        where: { id: sessionId },
        data: { isAnalyzing: true, analysisStatus: "none" }
      });

      if (io) io.to(`session:${sessionId}`).emit("analysis_started", { sessionId });

      res.json({ message: "LLM analysis started", sessionId });

      (async () => {
        try {
          const questionsList = await prisma.question.findMany({ orderBy: { createdAt: "asc" } });
          const settingsList = await prisma.settings.findMany();
          const settingsMap = {};
          settingsList.forEach((s) => (settingsMap[s.key] = s.value));

          const dividedSections = await parseAndDivideFullInterviewWithLLM(
            session.fullTranscript,
            questionsList,
            settingsMap
          );

          await prisma.recording.deleteMany({ where: { sessionId } });

          if (Array.isArray(dividedSections)) {
            for (let idx = 0; idx < dividedSections.length; idx++) {
              const item = dividedSections[idx];
              const isAnswered =
                item.wasAnswered === true ||
                (item.candidateAnswerOnly &&
                  !item.candidateAnswerOnly.includes("Not answered") &&
                  !item.candidateAnswerOnly.includes("not asked") &&
                  item.candidateAnswerOnly.trim().length > 3);

              if (!isAnswered) continue;

              const matchingQ =
                questionsList.find((q) => q.id === item.questionId) ||
                questionsList.find((q) =>
                  q.text.toLowerCase().trim() === item.questionText?.toLowerCase().trim()
                ) ||
                questionsList[idx] ||
                questionsList[0];

              if (!matchingQ) continue;

              try {
                await prisma.recording.create({
                  data: {
                    sessionId,
                    questionId: matchingQ.id,
                    takeNumber: 1,
                    audioUrl: session.audioClips[0]?.audioUrl || null,
                    rawTranscript: item.candidateAnswerOnly,
                    cleanTranscript: item.candidateAnswerOnly,
                    aiSummary: item.aiSummary || "Candidate response recorded.",
                    keyPoints: item.keyTakeaways || "Response saved.",
                    durationSec: 0,
                    isActive: true
                  }
                });
              } catch (recErr) {
                console.warn(`[Analyze] Recording create warning:`, recErr.message);
              }
            }
          }

          await prisma.session.update({
            where: { id: sessionId },
            data: { isAnalyzing: false, analysisStatus: "done", status: "complete" }
          });

          await prisma.candidate.update({
            where: { id: session.candidateId },
            data: { status: "complete" }
          });

          if (io) {
            io.to(`session:${sessionId}`).emit("analysis_done", { sessionId });
            io.emit("candidate_updated", { candidateId: session.candidateId });
          }
        } catch (err) {
          console.error("[Analyze] Background error:", err);
          await prisma.session.update({
            where: { id: sessionId },
            data: { isAnalyzing: false, analysisStatus: "error" }
          });
          if (io) io.to(`session:${sessionId}`).emit("analysis_error", { sessionId, error: err.message });
        }
      })();

    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  return { clipsRouter, sessionOpsRouter };
};
