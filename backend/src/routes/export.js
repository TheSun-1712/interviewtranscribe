const express = require("express");
const XLSX = require("xlsx");
const { smartClassifyTranscript } = require("../services/heuristicClassifier");

const router = express.Router();

module.exports = (prisma) => {
  // GET export Excel workbook with individual tabs per candidate
  router.get("/", async (req, res) => {
    try {
      const { candidateId } = req.query;

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
        "Domains Applied For": c.domainsAppliedFor || "N/A",
        "Branch & Section": c.branchAndSection || "N/A",
        "Domain in AAC": c.domainInAAC || "N/A",
        "CGPA": c.cgpa || "N/A",
        "Current Attendance": c.currentAttendance || "N/A",
        "Status": c.status,
        "Date Added": c.createdAt.toISOString().split("T")[0],
        "Total Sessions": c.sessions.length,
        "Full Interview Audio Link": c.sessions.find((s) => s.fullAudioUrl)?.fullAudioUrl || "N/A"
      }));

      const masterSheet = XLSX.utils.json_to_sheet(masterRows);
      masterSheet["!cols"] = [
        { wch: 5 }, { wch: 22 }, { wch: 24 }, { wch: 18 }, { wch: 22 }, { wch: 10 }, { wch: 18 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 45 }
      ];
      XLSX.utils.book_append_sheet(workbook, masterSheet, "All Candidates Directory");

      // ==========================================
      // DEDICATED TAB PER CANDIDATE
      // ==========================================
      for (const cand of targetCandidates) {
        const candRecordings = cand.sessions.flatMap((s) => s.recordings);
        const activeSession = cand.sessions.find((s) => s.fullTranscript || s.fullAudioUrl) || cand.sessions[0];
        const fullAudio = activeSession?.fullAudioUrl || "[No Full Audio]";
        const fullTranscript = activeSession?.fullTranscript || "";

        // Generate heuristic classification safety net
        const heuristicFallback = fullTranscript ? smartClassifyTranscript(fullTranscript, questions) : [];

        const fullSheetData = [
          [`CANDIDATE INTERVIEW REPORT — ${cand.name.toUpperCase()}`],
          ["Generated On", new Date().toLocaleString()],
          [],
          ["CANDIDATE PROFILE PARAMETERS"],
          ["Full Name:", cand.name, "", "CGPA:", cand.cgpa || "N/A"],
          ["Domains Applied For:", cand.domainsAppliedFor || "N/A", "", "Current Attendance:", cand.currentAttendance || "N/A"],
          ["Branch & Section:", cand.branchAndSection || "N/A", "", "Status:", cand.status],
          ["Domain in AAC:", cand.domainInAAC || "N/A", "", "Full Session Audio:", fullAudio],
          [],
          ["QUESTION-BY-QUESTION RESPONSES & EVALUATIONS (1 to 12)"],
          [
            "Q#",
            "Section Category",
            "Question Prompt",
            "Executive AI Answer Summary (English)",
            "Interviewer Score",
            "Interviewer Comments",
            "Duration (s)",
            "Audio Recording Link",
            "Clean Candidate Answer (English)"
          ]
        ];

        questions.forEach((q, idx) => {
          const qTakes = candRecordings.filter((r) => r.questionId === q.id);
          const activeTake = qTakes.find((t) => t.isActive) || qTakes[qTakes.length - 1];
          const fallbackItem = heuristicFallback[idx] || {};

          let summary = activeTake?.aiSummary;
          let answer = activeTake?.cleanTranscript || activeTake?.rawTranscript;

          const isAnsweredInTake =
            activeTake &&
            answer &&
            !answer.includes("Not answered") &&
            !answer.includes("not asked");

          const isAnsweredInFallback =
            fallbackItem.wasAnswered === true ||
            (fallbackItem.candidateAnswerOnly &&
              !fallbackItem.candidateAnswerOnly.includes("Not answered") &&
              !fallbackItem.candidateAnswerOnly.includes("not asked"));

          if (isAnsweredInTake) {
            // Keep active take summary & answer
          } else if (isAnsweredInFallback) {
            summary = fallbackItem.aiSummary;
            answer = fallbackItem.candidateAnswerOnly;
          } else {
            summary = "Question not asked in session";
            answer = "[Not answered in this session]";
          }

          fullSheetData.push([
            idx + 1,
            q.category || "General",
            q.text,
            summary,
            activeTake?.score !== null && activeTake?.score !== undefined ? activeTake.score : "-",
            activeTake?.comments || "-",
            activeTake?.durationSec ? `${activeTake.durationSec}s` : "-",
            activeTake?.audioUrl || fullAudio,
            answer
          ]);
        });

        const candSheet = XLSX.utils.aoa_to_sheet(fullSheetData);
        candSheet["!cols"] = [
          { wch: 5 },  // Q#
          { wch: 24 }, // Category
          { wch: 45 }, // Question Prompt
          { wch: 55 }, // AI Summary
          { wch: 18 }, // Interviewer Score
          { wch: 40 }, // Interviewer Comments
          { wch: 14 }, // Duration
          { wch: 45 }, // Audio Link
          { wch: 65 }  // Clean Candidate Answer
        ];

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
