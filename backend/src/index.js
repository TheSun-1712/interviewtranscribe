require("dotenv").config();
const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const path = require("path");
const fs = require("fs");
const http = require("http");
const { Server } = require("socket.io");
const { PrismaClient } = require("@prisma/client");
const { getHostIp } = require("./services/cloudinary");

const authRouter = require("./routes/auth");
const candidatesRouter = require("./routes/candidates");
const questionsRouter = require("./routes/questions");
const sessionsRouter = require("./routes/sessions");
const recordingsRouter = require("./routes/recordings");
const settingsRouter = require("./routes/settings");
const exportRouter = require("./routes/export");

const prisma = new PrismaClient();
const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 4000;

// Socket.IO — allow all origins for LAN access
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Socket.IO connection handler
io.on("connection", (socket) => {
  console.log(`[Socket.IO] Client connected: ${socket.id}`);

  // Client joins a room for a specific session/candidate
  socket.on("join_session", (sessionId) => {
    socket.join(`session:${sessionId}`);
    console.log(`[Socket.IO] ${socket.id} joined session:${sessionId}`);
  });

  socket.on("leave_session", (sessionId) => {
    socket.leave(`session:${sessionId}`);
  });

  // Candidate list room (for real-time flag/status updates)
  socket.on("join_roster", () => {
    socket.join("roster");
    console.log(`[Socket.IO] ${socket.id} joined roster`);
  });

  socket.on("disconnect", () => {
    console.log(`[Socket.IO] Client disconnected: ${socket.id}`);
  });
});

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
  res.json({
    status: "ok",
    timestamp: new Date(),
    service: "Interview Transcriber Express Backend",
    hostIp: getHostIp()
  });
});

// API Routes
app.use("/api/auth", authRouter);
app.use("/api/candidates", candidatesRouter(prisma, io));
app.use("/api/questions", questionsRouter(prisma));
app.use("/api/sessions", sessionsRouter(prisma));
app.use("/api/recordings", recordingsRouter(prisma));
app.use("/api/settings", settingsRouter(prisma));
app.use("/api/export.xlsx", exportRouter(prisma));

// Clip-based recording routes (new architecture)
const { clipsRouter, sessionOpsRouter } = require("./routes/clips")(prisma, io);
app.use("/api/clips", clipsRouter);
app.use("/api/sessions", sessionOpsRouter);

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
  } catch (err) {
    console.warn("Database seed warning:", err.message);
  }
}

// Start HTTP server (with Socket.IO)
server.listen(PORT, "0.0.0.0", async () => {
  const hostIp = getHostIp();
  console.log(`Backend API running at http://localhost:${PORT} (local)`);
  console.log(`Backend API accessible on LAN at http://${hostIp}:${PORT}`);
  await seedDatabase();
});
