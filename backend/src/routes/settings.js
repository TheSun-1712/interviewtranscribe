const express = require("express");
const router = express.Router();

const OFFICIAL_QUESTIONS = [
  { category: "Background & Overview", text: "Name, introduce yourself.", isCustom: false },
  { category: "Project & Strategy", text: "What is your problem statement.", isCustom: false },
  { category: "Project & Strategy", text: "What is your approach/implementation plan to your project?", isCustom: false },
  { category: "Domain Technical", text: "Basic questions on your domain.", isCustom: false },
  { category: "Data Structures & Ideation", text: "Ask a DSA question and basically just know their ideation capabilities.", isCustom: false },
  { category: "Training & Development", text: "What did you understand about training and development?", isCustom: false },
  { category: "Career Vision & Tech Role", text: "What do you think that YOU would do in tech?", isCustom: false },
  { category: "AAC Focus Area", text: "What area in AAC that you are most interested in?", isCustom: false },
  { category: "Domain Spontaneity", text: "Spontaneous question based on candidate domain & background.", isCustom: false },
  { category: "Logistics & Availability", text: "Are you able to stay after hours when required for project delivery?", isCustom: false },
  { category: "Mentorship & Leadership", text: "Are you interested in becoming a mentor to junior team members?", isCustom: false },
  { category: "Behavioral & Soft Skills", text: "Behavioural question: Describe a challenging situation and how you navigated it.", isCustom: false }
];

module.exports = (prisma) => {
  // GET all settings
  router.get("/", async (req, res) => {
    try {
      const settingsList = await prisma.settings.findMany();
      const settingsMap = {
        llmBaseUrl: process.env.OLLAMA_BASE_URL || process.env.LLM_BASE_URL || "http://localhost:11434/v1",
        llmApiKey: "",
        llmModel: process.env.OLLAMA_MODEL || process.env.LLM_MODEL || "qwen3.5:4b",
        transcriptionUrl: process.env.WHISPER_SERVICE_URL || "http://localhost:9000",
        storageMode: "local"
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

      // Delete all recordings, sessions, candidates, and old questions
      await prisma.recording.deleteMany();
      await prisma.session.deleteMany();
      await prisma.candidate.deleteMany();
      await prisma.question.deleteMany();

      // Seed fresh official 12 questions
      await prisma.question.createMany({ data: OFFICIAL_QUESTIONS });

      // Seed fresh candidate roster
      const freshCandidates = [
        { name: "Alex Morgan", role: "Full Stack Engineer", department: "Engineering", email: "alex.morgan@techcorp.com", status: "not_started" },
        { name: "Samantha Vance", role: "AI & ML Engineer", department: "AAC Research", email: "samantha.vance@designhub.io", status: "not_started" },
        { name: "David Chen", role: "Backend Architect", department: "Infrastructure", email: "david.chen@ai-labs.org", status: "not_started" },
        { name: "Priya Sharma", role: "DevOps & Systems Engineer", department: "Operations", email: "priya.sharma@enterprise.com", status: "not_started" }
      ];

      for (const cand of freshCandidates) {
        await prisma.candidate.create({ data: cand });
      }

      res.json({ success: true, message: "Database reset and re-seeded successfully with 12 official questions" });
    } catch (err) {
      console.error("Reset database error:", err);
      res.status(500).json({ error: err.message });
    }
  });

  return router;
};
