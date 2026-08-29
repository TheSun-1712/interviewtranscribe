const express = require("express");
const XLSX = require("xlsx");
const { divideAndCategorizeInterviewWithLLM } = require("../services/llm");
const router = express.Router();

module.exports = (prisma) => {
  // GET export Excel workbook with LLM section auto-partitioning
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
      const targetCandidate = candidateId
        ? candidates.find((c) => c.id === candidateId) || candidates[0]
        : candidates[0];

      const recordingsList = targetCandidate?.sessions.flatMap((s) => s.recordings) || [];

      // Build Q&A list for LLM section partitioning
      const qAndAList = questions.map((q) => {
        const qTakes = recordingsList.filter((r) => r.questionId === q.id);
        const activeTake = qTakes.find((t) => t.isActive) || qTakes[qTakes.length - 1];
        return {
          questionId: q.id,
          questionText: q.text,
          category: q.category || "General",
          transcript: activeTake ? (activeTake.cleanTranscript || activeTake.rawTranscript || "") : "",
          audioUrl: activeTake?.audioUrl || "[No Audio Link]",
          durationSec: activeTake?.durationSec || 0,
          takeNumber: activeTake?.takeNumber || 0
        };
      });

      // Run LLM auto-categorization & division pass
      const categorizedQandA = await divideAndCategorizeInterviewWithLLM(qAndAList, settingsMap);

      // ==========================================
      // SHEET 1: SESSION SUMMARY
      // ==========================================
      const summaryRows = categorizedQandA.map((item, idx) => ({
        "Q#": idx + 1,
        "Section Category": item.sectionName,
        "Question Text": item.questionText,
        "AI Section Summary": item.aiSummary,
        "Key Strengths & Takeaways": item.keyTakeaways,
        "Duration (s)": item.durationSec ? `${item.durationSec}s` : "-",
        "Cloudinary Audio Link": item.audioUrl,
        "Full Transcript": item.transcript || "[No Transcript]"
      }));

      const summarySheetData = [
        ["INTERVIEW TRANSCRIPTION & CATEGORIZED SECTION REPORT"],
        ["Generated On", new Date().toLocaleString()],
        [],
        ["CANDIDATE METADATA"],
        ["Full Name:", targetCandidate?.name || "All Candidates", "", "Status:", targetCandidate?.status || "N/A"],
        ["Role / Position:", targetCandidate?.role || "N/A", "", "Department:", targetCandidate?.department || "N/A"],
        ["Email:", targetCandidate?.email || "N/A", "", "Total Recordings:", recordingsList.length],
        [],
        ["SECTION-BY-SECTION ANALYSIS & TRANSCRIPTS"]
      ];

      const summarySheet = XLSX.utils.aoa_to_sheet(summarySheetData);
      XLSX.utils.sheet_add_json(summarySheet, summaryRows, { origin: "A10", skipHeader: false });

      summarySheet["!cols"] = [
        { wch: 6 },  // Q#
        { wch: 25 }, // Section Category
        { wch: 45 }, // Question Text
        { wch: 50 }, // AI Section Summary
        { wch: 40 }, // Key Strengths
        { wch: 14 }, // Duration
        { wch: 45 }, // Audio Link
        { wch: 65 }  // Full Transcript
      ];

      XLSX.utils.book_append_sheet(workbook, summarySheet, "Session Summary");

      // ==========================================
      // SHEET 2: CATEGORIZED SECTIONS PARTITION
      // ==========================================
      const sectionGroupedRows = [];
      const categoriesMap = {};

      categorizedQandA.forEach((item) => {
        const cat = item.sectionName || "General";
        if (!categoriesMap[cat]) categoriesMap[cat] = [];
        categoriesMap[cat].push(item);
      });

      for (const [catName, items] of Object.entries(categoriesMap)) {
        items.forEach((item, idx) => {
          sectionGroupedRows.push({
            "Section Category": catName,
            "Item #": idx + 1,
            "Question": item.questionText,
            "AI Answer Summary": item.aiSummary,
            "Key Insights": item.keyTakeaways,
            "Audio Link": item.audioUrl,
            "Clean Spoken Transcript": item.transcript || "[No response]"
          });
        });
      }

      const sectionSheet = XLSX.utils.json_to_sheet(sectionGroupedRows);
      sectionSheet["!cols"] = [
        { wch: 25 }, { wch: 8 }, { wch: 45 }, { wch: 50 }, { wch: 40 }, { wch: 45 }, { wch: 65 }
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

      // Set binary output headers
      const fileName = `Interview_Transcript_Categorized_${Date.now()}.xlsx`;
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
