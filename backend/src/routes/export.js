const express = require("express");
const XLSX = require("xlsx");
const { divideAndCategorizeInterviewWithLLM } = require("../services/llm");
const router = express.Router();

module.exports = (prisma) => {
  // GET export Excel workbook with master all candidates & LLM section auto-partitioning
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

      // Determine candidate focus (single candidate vs ALL candidates)
      const isMasterExport = !candidateId || candidateId === "all";
      const targetCandidates = isMasterExport
        ? candidates
        : candidates.filter((c) => c.id === candidateId);

      // Collect all Q&A data
      const allQAData = [];

      for (const cand of targetCandidates) {
        const candRecordings = cand.sessions.flatMap((s) => s.recordings);
        for (const q of questions) {
          const qTakes = candRecordings.filter((r) => r.questionId === q.id);
          const activeTake = qTakes.find((t) => t.isActive) || qTakes[qTakes.length - 1];

          allQAData.push({
            candidateId: cand.id,
            candidateName: cand.name,
            candidateRole: cand.role || "Candidate",
            questionId: q.id,
            questionText: q.text,
            category: q.category || "General",
            transcript: activeTake ? (activeTake.cleanTranscript || activeTake.rawTranscript || "") : "",
            aiSummary: activeTake?.aiSummary || (activeTake?.cleanTranscript ? activeTake.cleanTranscript.slice(0, 150) + "..." : "[No response]"),
            keyTakeaways: activeTake?.keyPoints || "Direct response recorded.",
            audioUrl: activeTake?.audioUrl || "[No Audio Link]",
            durationSec: activeTake?.durationSec || 0
          });
        }
      }

      // ==========================================
      // SHEET 1: MASTER SUMMARY OVERVIEW
      // ==========================================
      const summaryRows = allQAData.map((item, idx) => ({
        "ID": idx + 1,
        "Candidate Name": item.candidateName,
        "Candidate Role": item.candidateRole,
        "Section Category": item.category,
        "Question Text": item.questionText,
        "Executive AI Answer Summary": item.aiSummary,
        "Key Strengths & Insights": item.keyTakeaways,
        "Duration": item.durationSec ? `${item.durationSec}s` : "-",
        "Cloudinary Audio Link": item.audioUrl,
        "Spoken Answer Transcript": item.transcript || "[No response]"
      }));

      const summarySheetData = [
        ["MASTER INTERVIEW TRANSCRIPTION & EXECUTIVE SUMMARY REPORT"],
        ["Generated On", new Date().toLocaleString()],
        [],
        ["CANDIDATE SCOPE"],
        ["Scope:", isMasterExport ? `ALL CANDIDATES (${targetCandidates.length} Total)` : targetCandidates[0]?.name || "Single Candidate"],
        ["Total Questions Tracked:", questions.length],
        [],
        ["EXECUTIVE QUESTION-BY-QUESTION SUMMARY"]
      ];

      const summarySheet = XLSX.utils.aoa_to_sheet(summarySheetData);
      XLSX.utils.sheet_add_json(summarySheet, summaryRows, { origin: "A9", skipHeader: false });

      summarySheet["!cols"] = [
        { wch: 5 },  // ID
        { wch: 22 }, // Candidate Name
        { wch: 20 }, // Candidate Role
        { wch: 22 }, // Section Category
        { wch: 45 }, // Question Text
        { wch: 55 }, // Executive AI Answer Summary
        { wch: 40 }, // Key Strengths
        { wch: 12 }, // Duration
        { wch: 45 }, // Audio Link
        { wch: 65 }  // Spoken Transcript
      ];

      XLSX.utils.book_append_sheet(workbook, summarySheet, "Master Executive Summary");

      // ==========================================
      // SHEET 2: CATEGORIZED SECTIONS BREAKDOWN
      // ==========================================
      const sectionGroupedRows = [];
      const categoriesMap = {};

      allQAData.forEach((item) => {
        const cat = item.category || "General";
        if (!categoriesMap[cat]) categoriesMap[cat] = [];
        categoriesMap[cat].push(item);
      });

      for (const [catName, items] of Object.entries(categoriesMap)) {
        items.forEach((item, idx) => {
          sectionGroupedRows.push({
            "Section Category": catName,
            "Item #": idx + 1,
            "Candidate Name": item.candidateName,
            "Question": item.questionText,
            "Executive AI Summary": item.aiSummary,
            "Key Insights": item.keyTakeaways,
            "Cloudinary Audio Link": item.audioUrl,
            "Spoken Transcript": item.transcript || "[No response]"
          });
        });
      }

      const sectionSheet = XLSX.utils.json_to_sheet(sectionGroupedRows);
      sectionSheet["!cols"] = [
        { wch: 22 }, { wch: 8 }, { wch: 22 }, { wch: 45 }, { wch: 55 }, { wch: 40 }, { wch: 45 }, { wch: 65 }
      ];
      XLSX.utils.book_append_sheet(workbook, sectionSheet, "Category Sections Partition");

      // ==========================================
      // SHEET 3: ALL CANDIDATES DIRECTORY
      // ==========================================
      const masterRows = candidates.map((c, index) => ({
        "ID": index + 1,
        "Candidate Name": c.name,
        "Role / Position": c.role || "Candidate",
        "Department": c.department || "N/A",
        "Email": c.email || "N/A",
        "Status": c.status,
        "Created Date": c.createdAt.toISOString().split("T")[0],
        "Total Sessions": c.sessions.length,
        "Notes": c.notes || ""
      }));

      const masterSheet = XLSX.utils.json_to_sheet(masterRows);
      masterSheet["!cols"] = [
        { wch: 5 }, { wch: 22 }, { wch: 24 }, { wch: 18 }, { wch: 26 }, { wch: 14 }, { wch: 14 }, { wch: 16 }, { wch: 35 }
      ];
      XLSX.utils.book_append_sheet(workbook, masterSheet, "All Candidates Directory");

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
