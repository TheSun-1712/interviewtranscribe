const express = require("express");
const router = express.Router();

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

      const session = await prisma.session.create({
        data: {
          candidateId,
          interviewer: interviewer || "Lead Interviewer",
          status: "in_progress"
        },
        include: { candidate: true }
      });

      // Update candidate status to in_progress
      await prisma.candidate.update({
        where: { id: candidateId },
        data: { status: "in_progress" }
      });

      res.status(201).json(session);
    } catch (err) {
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
