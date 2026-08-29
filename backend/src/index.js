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

// Seed initial database defaults if empty
async function seedDatabase() {
  try {
    const qCount = await prisma.question.count();
    if (qCount === 0) {
      console.log("Seeding pre-decided questions into SQLite database...");
      await prisma.question.createMany({
        data: [
          { category: "Background & Overview", text: "Can you walk us through your professional journey and highlight key milestones?", isCustom: false },
          { category: "Background & Overview", text: "What attracted you to this role and why do you want to join our organization?", isCustom: false },
          { category: "Technical Competency", text: "Describe a complex technical problem you solved recently. What was your approach?", isCustom: false },
          { category: "Technical Competency", text: "How do you maintain quality and reliability when delivering features under tight deadlines?", isCustom: false },
          { category: "Problem Solving & Architecture", text: "If you had to redesign a system failing under high traffic load, what steps would you take?", isCustom: false },
          { category: "Culture & Collaboration", text: "Tell us about a time you had a significant disagreement with a teammate. How did you handle it?", isCustom: false },
          { category: "Wrap-Up & Q&A", text: "Do you have any questions for us regarding the team structure or upcoming challenges?", isCustom: false }
        ]
      });
    }

    const cCount = await prisma.candidate.count();
    if (cCount === 0) {
      console.log("Seeding starter candidate profiles into SQLite database...");
      await prisma.candidate.createMany({
        data: [
          { name: "Alex Morgan", role: "Senior Software Engineer", department: "Engineering", email: "alex.morgan@techcorp.com", status: "completed", notes: "Strong 6+ years React & Node experience" },
          { name: "Samantha Vance", role: "Product Design Lead", department: "Design & UX", email: "samantha.vance@designhub.io", status: "in_progress", notes: "Portfolio showcasing design system architecture" },
          { name: "David Chen", role: "AI & ML Specialist", department: "Data Science", email: "david.chen@ai-labs.org", status: "not_started", notes: "Specializes in LLMs, speech recognition & NLP" }
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
