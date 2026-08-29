const express = require("express");
const XLSX = require("xlsx");
const { divideAndCategorizeInterviewWithLLM } = require("../services/llm");
const router = express.Router();

module.exports = (prisma) => {
  // GET export Excel workbook with individual tabs per candidate
  router.get("/", async (req, res) => {
    try {
      const { candidateId, sessionId } = req.query;

      const candidates = await prisma.candidate.findMany({
        include: {
          sessions: {
            include: {
              recordings: {
                include: { question: true },
                orderBy: { recordedAt: "asc" }
              }
            }
          }
        }
      });

      const questions = await prisma.question.findMany({
        orderBy: { createdAt: "asc" }
      });

      const settingsList = await prisma.settings.findMany();
      const settingsMap = {};
      settingsList.forEach((s) => (settingsMap[s.key] = s.value));

      const workbook = XLSX.utils.book_new();

      const isMasterExport = !candidateId || candidateId === "all";
      const targetCandidates = isMasterExport
        ? candidates
        : candidates.filter((c) => c.id === candidateId);

      // ==========================================
      // TAB 1: MASTER CANDIDATES DIRECTORY OVERVIEW
      // ==========================================
      const masterRows = candidates.map((c, index) => ({
        "ID": index + 1,
        "Candidate Name": c.name,
        "Role / Position": c.role || "Candidate",
        "Department": c.department || "N/A",
        "Email": c.email || "N/A",
        "Status": c.status,
        "Date Added": c.createdAt.toISOString().split("T")[0],
        "Total Sessions": c.sessions.length,
        "Full Interview Audio Link": c.sessions.find((s) => s.fullAudioUrl)?.fullAudioUrl || "N/A",
        "Notes": c.notes || ""
      }));

      const masterSheet = XLSX.utils.json_to_sheet(masterRows);
      masterSheet["!cols"] = [
        { wch: 5 }, { wch: 22 }, { wch: 24 }, { wch: 18 }, { wch: 26 }, { wch: 14 }, { wch: 14 }, { wch: 16 }, { wch: 45 }, { wch: 35 }
      ];
      XLSX.utils.book_append_sheet(workbook, masterSheet, "All Candidates Directory");

      // ==========================================
      // DEDICATED TAB PER CANDIDATE
      // ==========================================
      for (const cand of targetCandidates) {
        const candRecordings = cand.sessions.flatMap((s) => s.recordings);
        const fullAudio = cand.sessions.find((s) => s.fullAudioUrl)?.fullAudioUrl || "[No Full Audio]";

        const candidateQAData = questions.map((q, idx) => {
          const qTakes = candRecordings.filter((r) => r.questionId === q.id);
          const activeTake = qTakes.find((t) => t.isActive) || qTakes[qTakes.length - 1];

          return {
            "Q#": idx + 1,
            "Section Category": q.category || "General",
            "Question Prompt": q.text,
            "Executive AI Answer Summary": activeTake?.aiSummary || (activeTake?.cleanTranscript ? activeTake.cleanTranscript.slice(0, 150) + "..." : "No response recorded"),
            "Key Insights & Strengths": activeTake?.keyPoints || "Response recorded",
            "Duration (s)": activeTake?.durationSec ? `${activeTake.durationSec}s` : "-",
            "Audio Recording Link": activeTake?.audioUrl || fullAudio,
            "Clean Candidate Answer": activeTake?.cleanTranscript || activeTake?.rawTranscript || "[No spoken answer]"
          };
        });

        const sheetHeader = [
          [`CANDIDATE INTERVIEW REPORT — ${cand.name.toUpperCase()}`],
          ["Generated On", new Date().toLocaleString()],
          [],
          ["CANDIDATE PROFILE"],
          ["Full Name:", cand.name, "", "Status:", cand.status],
          ["Role / Position:", cand.role || "N/A", "", "Department:", cand.department || "N/A"],
          ["Email:", cand.email || "N/A", "", "Full Session Audio:", fullAudio],
          [],
          ["QUESTION-BY-QUESTION RESPONSES & AI SUMMARIES (1 to 12)"]
        ];

        const candSheet = XLSX.utils.aoa_to_sheet(sheetHeader);
        XLSX.utils.sheet_add_json(candSheet, candidateQAData, { origin: "A10", skipHeader: false });

        candSheet["!cols"] = [
          { wch: 5 },  // Q#
          { wch: 24 }, // Category
          { wch: 45 }, // Question Prompt
          { wch: 55 }, // Executive AI Answer Summary
          { wch: 40 }, // Key Insights
          { wch: 14 }, // Duration
          { wch: 45 }, // Audio Link
          { wch: 65 }  // Clean Candidate Answer
        ];

        // Sheet name capped at 31 chars (Excel limit)
        const sheetName = cand.name.slice(0, 28).replace(/[\\/?*:[\]]/g, "");
        XLSX.utils.book_append_sheet(workbook, candSheet, sheetName);
      }

      const fileName = isMasterExport
        ? `Interview_Transcripts_All_Candidates_${Date.now()}.xlsx`
        : `Interview_Transcript_${(targetCandidates[0]?.name || "Candidate").replace(/\s+/g, "_")}_${Date.now()}.xlsx`;

      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);

      const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
      res.send(buffer);
    } catch (err) {
      console.error("Excel export error:", err);
      res.status(500).json({ error: err.message });
    }
  });

  return router;
};
