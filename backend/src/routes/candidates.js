const express = require("express");
const router = express.Router();

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

  // POST create new candidate
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
