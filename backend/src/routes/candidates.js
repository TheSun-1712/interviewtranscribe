const express = require("express");
const multer = require("multer");
const XLSX = require("xlsx");
const path = require("path");
const fs = require("fs");

const router = express.Router();

const uploadsDir = path.join(__dirname, "../../uploads/temp");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || ".xlsx";
    cb(null, `import_${Date.now()}_${Math.random().toString(36).substring(7)}${ext}`);
  }
});

const upload = multer({ storage });

module.exports = (prisma, io) => {
  // GET all candidates
  router.get("/", async (req, res) => {
    try {
      const candidates = await prisma.candidate.findMany({
        orderBy: { createdAt: "desc" },
        include: {
          sessions: {
            orderBy: { startedAt: "asc" },
            include: {
              recordings: true,
              audioClips: { orderBy: { recordedAt: "asc" } }
            }
          }
        }
      });
      res.json(candidates);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // GET candidate by ID
  router.get("/:id", async (req, res) => {
    try {
      const candidate = await prisma.candidate.findUnique({
        where: { id: req.params.id },
        include: {
          sessions: {
            orderBy: { startedAt: "asc" },
            include: {
              recordings: {
                include: { question: true }
              },
              audioClips: { orderBy: { recordedAt: "asc" } }
            }
          }
        }
      });
      if (!candidate) return res.status(404).json({ error: "Candidate not found" });
      res.json(candidate);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // POST create new single candidate
  router.post("/", async (req, res) => {
    try {
      const {
        name,
        domainsAppliedFor,
        branchAndSection,
        domainInAAC,
        cgpa,
        currentAttendance,
        role,
        department,
        email,
        notes
      } = req.body;

      if (!name) return res.status(400).json({ error: "Candidate name is required" });

      const candidate = await prisma.candidate.create({
        data: {
          name: name.trim(),
          domainsAppliedFor: domainsAppliedFor?.trim() || "Software Engineering",
          branchAndSection: branchAndSection?.trim() || "CSE - A",
          domainInAAC: domainInAAC?.trim() || "Computer Vision / AI",
          cgpa: cgpa?.trim() || "8.5",
          currentAttendance: currentAttendance?.trim() || "85%",
          role: role?.trim() || domainsAppliedFor?.trim() || "Candidate",
          department: department?.trim() || branchAndSection?.trim() || "Engineering",
          email: email?.trim() || `${name.toLowerCase().replace(/\s+/g, ".")}@example.com`,
          notes: notes?.trim() || "",
          status: "not_started"
        }
      });
      res.status(201).json(candidate);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // POST import candidates from Excel / CSV file with optional clearExisting flag
  router.post("/import", upload.single("file"), async (req, res) => {
    try {
      if (!req.file) return res.status(400).json({ error: "Excel file is required" });

      const clearExisting =
        req.body.clearExisting === "true" ||
        req.body.clearExisting === true ||
        req.query.clearExisting === "true";

      if (clearExisting) {
        console.log("[Excel Import] Clearing all existing recordings, sessions, and candidates...");
        await prisma.recording.deleteMany({});
        await prisma.session.deleteMany({});
        await prisma.candidate.deleteMany({});
      }

      const fileBuffer = fs.readFileSync(req.file.path);
      const workbook = XLSX.read(fileBuffer, { type: "buffer" });
      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];
      const rows = XLSX.utils.sheet_to_json(worksheet);

      if (!rows || rows.length === 0) {
        return res.status(400).json({ error: "Excel sheet is empty or invalid format" });
      }

      const createdCandidates = [];

      for (const row of rows) {
        // Flexible key matching for candidate parameters
        const name =
          row["Candidate Name"] ||
          row["Name"] ||
          row["Full Name"] ||
          row["candidate_name"] ||
          row["name"];

        if (!name || String(name).trim() === "") continue;

        const domainsAppliedFor =
          row["Domains Applied For"] ||
          row["Domains"] ||
          row["Domain Applied For"] ||
          row["domains_applied_for"] ||
          "Software Engineering";

        const branchAndSection =
          row["Branch & Section"] ||
          row["Branch and Section"] ||
          row["Branch"] ||
          row["branch_and_section"] ||
          "CSE - A";

        const domainInAAC =
          row["Domain in AAC"] ||
          row["AAC Domain"] ||
          row["AAC"] ||
          row["domain_in_aac"] ||
          "Computer Vision / AI";

        const cgpa =
          row["CGPA"] ||
          row["cgpa"] ||
          row["Cgpa"] ||
          "8.5";

        const currentAttendance =
          row["Current Attendance"] ||
          row["Current Attendance (%)"] ||
          row["Attendance"] ||
          row["attendance"] ||
          "85%";

        const candidate = await prisma.candidate.create({
          data: {
            name: String(name).trim(),
            domainsAppliedFor: String(domainsAppliedFor).trim(),
            branchAndSection: String(branchAndSection).trim(),
            domainInAAC: String(domainInAAC).trim(),
            cgpa: String(cgpa).trim(),
            currentAttendance: String(currentAttendance).trim(),
            role: String(domainsAppliedFor).trim(),
            department: String(branchAndSection).trim(),
            email: `${String(name).toLowerCase().replace(/\s+/g, ".")}@example.com`,
            status: "not_started"
          }
        });

        createdCandidates.push(candidate);
      }

      // Cleanup temp uploaded file if exists
      if (req.file.path && fs.existsSync(req.file.path)) {
        try { fs.unlinkSync(req.file.path); } catch(e){}
      }

      res.status(201).json({
        success: true,
        clearedExisting: Boolean(clearExisting),
        count: createdCandidates.length,
        candidates: createdCandidates
      });
    } catch (err) {
      console.error("Import candidates error:", err);
      res.status(500).json({ error: err.message });
    }
  });

  // PATCH update candidate fields (name, branch/section, domains, AAC domain, CGPA, attendance)
  router.patch("/:id", async (req, res) => {
    try {
      const { name, branchAndSection, domainsAppliedFor, domainInAAC, cgpa, currentAttendance } = req.body;

      const updateData = {};
      if (name !== undefined) updateData.name = String(name).trim();
      if (branchAndSection !== undefined) updateData.branchAndSection = String(branchAndSection).trim();
      if (domainsAppliedFor !== undefined) updateData.domainsAppliedFor = String(domainsAppliedFor).trim();
      if (domainInAAC !== undefined) updateData.domainInAAC = String(domainInAAC).trim();
      if (cgpa !== undefined) updateData.cgpa = String(cgpa).trim();
      if (currentAttendance !== undefined) updateData.currentAttendance = String(currentAttendance).trim();

      const updated = await prisma.candidate.update({
        where: { id: req.params.id },
        data: updateData,
        include: {
          sessions: {
            orderBy: { startedAt: "asc" },
            include: {
              recordings: { include: { question: true } },
              audioClips: { orderBy: { recordedAt: "asc" } }
            }
          }
        }
      });

      if (io) {
        io.emit("candidate_updated", { candidateId: updated.id });
      }

      res.json(updated);
    } catch (err) {
      console.error("[Candidates] Update error:", err);
      res.status(500).json({ error: err.message });
    }
  });

  // PATCH /:id/feedback — save interviewer score & comment by candidateId + questionIndex
  // The frontend doesn't know the recording row ID, only candidateId + questionIndex
  router.patch("/:id/feedback", async (req, res) => {
    try {
      const candidateId = req.params.id;
      const { questionIndex, score, comment } = req.body;

      if (questionIndex === undefined) {
        return res.status(400).json({ error: "questionIndex is required" });
      }

      // Find the latest session for this candidate
      const candidate = await prisma.candidate.findUnique({
        where: { id: candidateId },
        include: {
          sessions: {
            orderBy: { startedAt: "desc" },
            take: 1,
            include: {
              recordings: {
                include: { question: true },
                orderBy: { recordedAt: "desc" }
              }
            }
          }
        }
      });

      if (!candidate) return res.status(404).json({ error: "Candidate not found" });

      let latestSession = candidate.sessions[0];

      if (!latestSession) {
        // Auto-create a session if none exists yet so feedback can always be recorded
        latestSession = await prisma.session.create({
          data: {
            candidateId: candidate.id,
            interviewer: "Lead Interviewer",
            status: "in_progress"
          },
          include: {
            recordings: {
              include: { question: true }
            }
          }
        });
      }

      // Fetch questions ordered by creation date
      const questions = await prisma.question.findMany({ orderBy: { createdAt: "asc" } });

      if (!questions || questions.length === 0) {
        return res.status(400).json({ error: "No questions found in database" });
      }

      // Match target question positionally (questionIndex is 1-based: 1 to 12)
      const targetQuestion =
        questions[Number(questionIndex) - 1] ||
        questions[0];

      // Find if recording already exists for this question in the current session
      let recording = (latestSession.recordings || []).find(
        (r) => r.questionId === targetQuestion.id
      ) || null;

      if (recording) {
        // Update existing recording
        recording = await prisma.recording.update({
          where: { id: recording.id },
          data: {
            score: score !== undefined && score !== null && score !== "" ? parseFloat(score) : null,
            comments: comment !== undefined ? String(comment).trim() : undefined
          },
          include: { question: true }
        });
      } else {
        // Create new recording row with the interviewer's feedback
        recording = await prisma.recording.create({
          data: {
            sessionId: latestSession.id,
            questionId: targetQuestion.id,
            takeNumber: 1,
            rawTranscript: "[Score/comment added manually]",
            cleanTranscript: "[Score/comment added manually]",
            aiSummary: "",
            score: score !== undefined && score !== null && score !== "" ? parseFloat(score) : null,
            comments: comment !== undefined ? String(comment).trim() : "",
            durationSec: 0,
            isActive: true
          },
          include: { question: true }
        });
      }

      res.json(recording);
    } catch (err) {
      console.error("[Candidates] Feedback save error:", err);
      res.status(500).json({ error: err.message });
    }
  });

  // PATCH toggle candidate flag
  router.patch("/:id/flag", async (req, res) => {
    try {
      const candidate = await prisma.candidate.findUnique({ where: { id: req.params.id } });
      if (!candidate) return res.status(404).json({ error: "Candidate not found" });

      const updated = await prisma.candidate.update({
        where: { id: req.params.id },
        data: { isFlagged: !candidate.isFlagged },
        include: {
          sessions: {
            include: { recordings: true }
          }
        }
      });

      // Broadcast to all connected devices
      if (io) {
        io.emit("candidate_updated", { candidateId: updated.id, isFlagged: updated.isFlagged });
      }

      res.json(updated);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // PATCH update candidate status
  router.patch("/:id/status", async (req, res) => {
    try {
      const { status } = req.body;
      const updated = await prisma.candidate.update({
        where: { id: req.params.id },
        data: { status },
        include: {
          sessions: {
            include: { recordings: true }
          }
        }
      });
      res.json(updated);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // DELETE candidate
  router.delete("/:id", async (req, res) => {
    try {
      await prisma.candidate.delete({
        where: { id: req.params.id }
      });
      res.json({ success: true, message: "Candidate deleted" });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  return router;
};

