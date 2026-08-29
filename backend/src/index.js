require("dotenv").config();
const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const path = require("path");
const fs = require("fs");
const { PrismaClient } = require("@prisma/client");

const authRouter = require("./routes/auth");
const candidatesRouter = require("./routes/candidates");
const questionsRouter = require("./routes/questions");
const sessionsRouter = require("./routes/sessions");
const recordingsRouter = require("./routes/recordings");
const settingsRouter = require("./routes/settings");
const exportRouter = require("./routes/export");

const prisma = new PrismaClient();
const app = express();
const PORT = process.env.PORT || 4000;

// Express Middlewares
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser(process.env.SESSION_SECRET || "interview_secret"));

// Serve static uploaded audio files
const uploadsDir = path.join(__dirname, "../uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}
app.use("/uploads", express.static(uploadsDir));

// Health Check
app.get("/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date(), service: "Interview Transcriber Express Backend" });
});

// API Routes
app.use("/api/auth", authRouter);
app.use("/api/candidates", candidatesRouter(prisma));
app.use("/api/questions", questionsRouter(prisma));
app.use("/api/sessions", sessionsRouter(prisma));
app.use("/api/recordings", recordingsRouter(prisma));
app.use("/api/settings", settingsRouter(prisma));
app.use("/api/export.xlsx", exportRouter(prisma));

// Official 12-Question Interview Bank Seed
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

async function seedDatabase() {
  try {
    const qCount = await prisma.question.count();
    if (qCount === 0) {
      console.log("Seeding official 12-question interview bank into PostgreSQL...");
      await prisma.question.createMany({ data: OFFICIAL_QUESTIONS });
    }

    const cCount = await prisma.candidate.count();
    if (cCount === 0) {
      console.log("Seeding fresh candidate profiles into PostgreSQL...");
      await prisma.candidate.createMany({
        data: [
          { name: "Alex Morgan", role: "Full Stack Engineer", department: "Engineering", email: "alex.morgan@techcorp.com", status: "not_started" },
          { name: "Samantha Vance", role: "AI & ML Engineer", department: "AAC Research", email: "samantha.vance@designhub.io", status: "not_started" },
          { name: "David Chen", role: "Backend Architect", department: "Infrastructure", email: "david.chen@ai-labs.org", status: "not_started" },
          { name: "Priya Sharma", role: "DevOps & Systems Engineer", department: "Operations", email: "priya.sharma@enterprise.com", status: "not_started" }
        ]
      });
    }
  } catch (err) {
    console.warn("Database seed warning:", err.message);
  }
}

// Start Express server
app.listen(PORT, async () => {
  console.log(`Backend API running at http://localhost:${PORT}`);
  await seedDatabase();
});
