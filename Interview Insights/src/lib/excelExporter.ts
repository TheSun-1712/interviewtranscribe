import * as XLSX from "xlsx";
import { OFFICIAL_QUESTIONS } from "./questions";
import { NOT_ANSWERED } from "./transcribe";
import { answeredCount, candidateStatus } from "./store";
import type { Candidate } from "./types";

const safeSheetName = (name: string, used: Set<string>) => {
  let base = name.replace(/[\\/*?:[\]]/g, "").slice(0, 28) || "Candidate";
  let final = base;
  let i = 2;
  while (used.has(final)) final = `${base.slice(0, 25)} ${i++}`;
  used.add(final);
  return final;
};

export function exportAllCandidates(candidates: Candidate[]) {
  const wb = XLSX.utils.book_new();
  const used = new Set<string>();

  const directory = candidates.map((c, i) => ({
    ID: i + 1,
    "Candidate Name": c.name,
    "Role / Position": c.role,
    Department: c.department,
    Email: c.email,
    Status: candidateStatus(c),
    "Date Added": c.dateAdded,
    "Questions Completed": `${answeredCount(c)} of ${OFFICIAL_QUESTIONS.length}`,
    "Total Sessions": c.sessions,
    "Full Interview Audio Link": c.fullAudioUrl ?? "",
    Notes: c.notes,
  }));

  const dirSheet = XLSX.utils.json_to_sheet(directory);
  dirSheet["!cols"] = [
    { wch: 5 },
    { wch: 22 },
    { wch: 20 },
    { wch: 16 },
    { wch: 26 },
    { wch: 13 },
    { wch: 12 },
    { wch: 20 },
    { wch: 14 },
    { wch: 34 },
    { wch: 24 },
  ];
  XLSX.utils.book_append_sheet(wb, dirSheet, safeSheetName("All Candidates Directory", used));

  for (const c of candidates) {
    const header = [
      ["Candidate", c.name],
      ["Role", c.role],
      ["Department", c.department],
      ["Email", c.email],
      ["Status", candidateStatus(c)],
      ["Full Session Audio Link", c.fullAudioUrl ?? ""],
      [],
    ];
    const rows = OFFICIAL_QUESTIONS.map((q) => {
      const a = c.answers[q.id];
      return [
        q.n,
        q.category,
        q.prompt,
        a?.summary ?? NOT_ANSWERED,
        a?.insights ?? "",
        a?.duration ?? "",
        a?.audioUrl ?? "",
        a?.transcript ?? NOT_ANSWERED,
      ];
    });
    const sheet = XLSX.utils.aoa_to_sheet([
      ...header,
      [
        "Q#",
        "Section Category",
        "Question Prompt",
        "Executive AI Summary",
        "Key Insights & Strengths",
        "Duration (s)",
        "Audio Recording Link",
        "Clean Candidate Answer",
      ],
      ...rows,
    ]);
    sheet["!cols"] = [
      { wch: 5 },
      { wch: 24 },
      { wch: 46 },
      { wch: 60 },
      { wch: 40 },
      { wch: 12 },
      { wch: 30 },
      { wch: 70 },
    ];
    XLSX.utils.book_append_sheet(wb, sheet, safeSheetName(c.name, used));
  }

  XLSX.writeFile(wb, `interview-transcriber-export-${new Date().toISOString().slice(0, 10)}.xlsx`);
}
