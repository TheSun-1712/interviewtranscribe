const express = require("express");
const router = express.Router();

module.exports = (prisma) => {
  // GET all settings
  router.get("/", async (req, res) => {
    try {
      const settingsList = await prisma.settings.findMany();
      const settingsMap = {
        llmBaseUrl: process.env.LLM_BASE_URL || "https://api.groq.com/openai/v1",
        llmApiKey: process.env.GROQ_API_KEY || "",
        llmModel: process.env.LLM_MODEL || "llama3-70b-8192",
        transcriptionUrl: process.env.WHISPER_SERVICE_URL || "http://localhost:9000",
        cloudinaryCloudName: process.env.CLOUDINARY_CLOUD_NAME || "neugchyg"
      };

      settingsList.forEach((s) => {
        settingsMap[s.key] = s.value;
      });

      res.json(settingsMap);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // PUT update settings
  router.put("/", async (req, res) => {
    try {
      const updates = req.body;

      for (const [key, value] of Object.entries(updates)) {
        await prisma.settings.upsert({
          where: { key },
          update: { value: String(value) },
          create: { key, value: String(value) }
        });
      }

      res.json({ success: true, message: "Settings updated successfully" });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // POST reset database (password protected)
  router.post("/reset-database", async (req, res) => {
    try {
      const { password } = req.body;
      if (password !== "admin123" && password !== "admin") {
        return res.status(401).json({ error: "Invalid admin password" });
      }

      console.log("Resetting database tables...");

      // Delete all recordings, sessions, candidates
      await prisma.recording.deleteMany();
      await prisma.session.deleteMany();
      await prisma.candidate.deleteMany();

      // Seed fresh initial starter candidate roster
      const freshCandidates = [
        { name: "Priya Nair", role: "Backend Engineer", department: "Engineering", email: "priya.nair@example.com", status: "not_started" },
        { name: "Arjun Verma", role: "Frontend Engineer", department: "UI Engineering", email: "arjun.verma@example.com", status: "not_started" },
        { name: "Meera Iyer", role: "ML Engineer", department: "AI Research", email: "meera.iyer@example.com", status: "not_started" },
        { name: "Rohan Das", role: "DevOps Engineer", department: "Infrastructure", email: "rohan.das@example.com", status: "not_started" }
      ];

      for (const cand of freshCandidates) {
        await prisma.candidate.create({ data: cand });
      }

      res.json({ success: true, message: "Database reset and re-seeded successfully" });
    } catch (err) {
      console.error("Reset database error:", err);
      res.status(500).json({ error: err.message });
    }
  });

  return router;
};
