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

module.exports = (prisma) => {
  // GET all candidates
  router.get("/", async (req, res) => {
    try {
      const candidates = await prisma.candidate.findMany({
        orderBy: { createdAt: "desc" },
        include: {
          sessions: {
            include: {
              recordings: true
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
            include: {
              recordings: {
                include: { question: true }
              }
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
