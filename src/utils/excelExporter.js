import * as XLSX from "xlsx";

/**
 * Export interview session data into structured Excel workbook (.xlsx)
 * Auto-divides candidate answers into respective question sections
 */
export function exportInterviewToExcel(session, candidate, questionsList, recordingsMap, allCandidates = []) {
  const workbook = XLSX.utils.book_new();
  const sessionDate = session?.date || new Date().toISOString().split("T")[0];
  const candidateName = candidate?.name || "Unknown Candidate";
  const candidateRole = candidate?.role || "Interviewee";
  const interviewer = session?.interviewer || "Lead Interviewer";
  const sessionId = session?.id || `SESS-${Date.now().toString().slice(-6)}`;

  let totalTakesCount = 0;
  let totalDurationSec = 0;

  const summaryOverviewRows = [];
  const categorizedSectionsMap = {};

  questionsList.forEach((q, idx) => {
    const takes = recordingsMap[q.id] || [];
    totalTakesCount += takes.length;

    const activeTake = takes.find((t) => t.isActive) || takes[takes.length - 1];
    if (activeTake) {
      totalDurationSec += activeTake.durationSeconds || 0;
    }

    const categoryName = q.category || "General";

    const itemData = {
      "Q#": idx + 1,
      "Section Category": categoryName,
      "Question Text": q.text,
      "Total Takes": takes.length,
      "Active Take": activeTake ? `Take ${activeTake.takeNumber}` : "No Recording",
      "Duration (s)": activeTake ? `${activeTake.durationSeconds || 0}s` : "-",
      "Cloudinary Audio Link": activeTake?.audioUrl || "[No Audio Link]",
      "Spoken Transcript": activeTake?.transcript || "[No Transcript]",
      Status: takes.length > 0 ? "Completed" : "Skipped"
    };

    summaryOverviewRows.push(itemData);

    if (!categorizedSectionsMap[categoryName]) {
      categorizedSectionsMap[categoryName] = [];
    }
    categorizedSectionsMap[categoryName].push(itemData);
  });

  const minutes = Math.floor(totalDurationSec / 60);
  const seconds = totalDurationSec % 60;
  const formattedTotalTime = `${minutes}m ${seconds}s`;

  // SHEET 1: SESSION SUMMARY
  const summarySheetData = [
    ["INTERVIEW TRANSCRIPTION & SECTION ANALYSIS REPORT"],
    ["Generated On", new Date().toLocaleString()],
    [],
    ["CANDIDATE INFORMATION"],
    ["Full Name:", candidateName, "", "Session ID:", sessionId],
    ["Role / Position:", candidateRole, "", "Date:", sessionDate],
    ["Department:", candidate?.department || "N/A", "", "Interviewer:", interviewer],
    ["Email:", candidate?.email || "N/A", "", "Session Status:", session?.status || "Completed"],
    [],
    ["SESSION METRICS"],
    ["Total Questions:", questionsList.length, "", "Total Takes Recorded:", totalTakesCount],
    ["Total Recording Time:", formattedTotalTime, "", "Average Time / Question:", `${Math.round(totalDurationSec / (questionsList.length || 1))}s`],
    [],
    ["QUESTION OVERVIEW SUMMARY"]
  ];

  const summarySheet = XLSX.utils.aoa_to_sheet(summarySheetData);
  XLSX.utils.sheet_add_json(summarySheet, summaryOverviewRows, {
    origin: "A15",
    skipHeader: false
  });

  summarySheet["!cols"] = [
    { wch: 6 }, { wch: 25 }, { wch: 45 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 45 }, { wch: 65 }, { wch: 12 }
  ];

  XLSX.utils.book_append_sheet(workbook, summarySheet, "Session Summary");

  // SHEET 2: CATEGORIZED SECTIONS PARTITION
  const sectionPartitionRows = [];
  for (const [catName, items] of Object.entries(categorizedSectionsMap)) {
    items.forEach((item, idx) => {
      sectionPartitionRows.push({
        "Section Category": catName,
        "Item #": idx + 1,
        "Question Prompt": item["Question Text"],
        "Cloudinary Audio Link": item["Cloudinary Audio Link"],
        "Spoken Answer Transcript": item["Spoken Transcript"],
        "Status": item["Status"]
      });
    });
  }

  const sectionSheet = XLSX.utils.json_to_sheet(sectionPartitionRows);
  sectionSheet["!cols"] = [
    { wch: 25 }, { wch: 8 }, { wch: 45 }, { wch: 45 }, { wch: 70 }, { wch: 12 }
  ];
  XLSX.utils.book_append_sheet(workbook, sectionSheet, "Category Sections Partition");

  // SHEET 3: ALL CANDIDATES DIRECTORY
  if (allCandidates && allCandidates.length > 0) {
    const masterRows = allCandidates.map((c, index) => ({
      "ID": index + 1,
      "Candidate Name": c.name,
      "Role / Position": c.role,
      "Department": c.department,
      "Email": c.email,
      "Status": c.status,
      "Date Added": c.dateAdded,
      "Sessions Completed": c.sessionsCount || 0,
      "Notes": c.notes || ""
    }));

    const masterSheet = XLSX.utils.json_to_sheet(masterRows);
    masterSheet["!cols"] = [
      { wch: 5 }, { wch: 22 }, { wch: 24 }, { wch: 18 }, { wch: 26 }, { wch: 14 }, { wch: 14 }, { wch: 20 }, { wch: 35 }
    ];

    XLSX.utils.book_append_sheet(workbook, masterSheet, "All Candidates Directory");
  }

  const fileName = `Interview_Transcript_Categorized_${candidateName.replace(/\s+/g, "_")}_${sessionId}.xlsx`;
  XLSX.writeFile(workbook, fileName);
}
