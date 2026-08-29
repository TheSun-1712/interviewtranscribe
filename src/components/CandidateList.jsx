import React, { useState } from "react";
import { FileSpreadsheet, Plus, X } from "lucide-react";

export default function CandidateList({
  candidates,
  selectedCandidate,
  onSelectCandidate,
  onStartSession,
  onAddCandidate,
  onDeleteCandidate,
  onExportExcel,
  onLogout
}) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [name, setName] = useState("");
  const [role, setRole] = useState("");
  const [department, setDepartment] = useState("");
  const [notes, setNotes] = useState("");

  const completedCount = candidates.filter(
    (c) => c.status?.toLowerCase() === "completed" || c.status?.toLowerCase() === "complete"
  ).length;

  const handleAddSubmit = (e) => {
    e.preventDefault();
    if (!name.trim()) return;

    onAddCandidate({
      name: name.trim(),
      role: role.trim() || "Candidate",
      department: department.trim() || "General",
      notes: notes.trim(),
      status: "not_started"
    });

    setName("");
    setRole("");
    setDepartment("");
    setNotes("");
    setShowAddForm(false);
  };

  return (
    <div>
      {/* Topbar */}
      <div className="topbar">
        <span className="mark">SIGNAL</span>
        <h1>Candidates</h1>
        <div className="flex-1" />
        <button
          onClick={onExportExcel}
          className="ghost-btn font-mono text-xs"
          title="Export Excel Report"
        >
          <FileSpreadsheet className="h-3.5 w-3.5 inline mr-1 text-[var(--teal)]" />
          Export Excel
        </button>
        <button onClick={onLogout} className="ghost-btn font-mono text-xs">
          Log out
        </button>
      </div>

      {/* Dashboard Body */}
      <div className="p-[26px_28px] max-w-[1080px] mx-auto space-y-6">
        <div className="flex items-center">
          <h2 className="m-0 text-[15px] text-[var(--muted)] font-mono font-semibold tracking-[0.04em] uppercase">
            {candidates.length} CANDIDATES · {completedCount} COMPLETE
          </h2>
          <div className="flex-1" />
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="btn-amber"
          >
            {showAddForm ? (
              <>
                <X className="h-4 w-4" /> Cancel
              </>
            ) : (
              <>
                <Plus className="h-4 w-4" /> Add candidate
              </>
            )}
          </button>
        </div>

        {/* Inline Add Candidate Form */}
        {showAddForm && (
          <form
            onSubmit={handleAddSubmit}
            className="bg-[var(--panel)] border border-[var(--line)] rounded-xl p-5 space-y-4"
          >
            <h3 className="text-sm font-semibold font-mono text-[var(--amber)]">
              + ADD NEW CANDIDATE
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="field-label">Full Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Priya Nair"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="form-input"
                />
              </div>
              <div>
                <label className="field-label">Role / Position</label>
                <input
                  type="text"
                  placeholder="e.g. Backend Engineer"
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  className="form-input"
                />
              </div>
              <div>
                <label className="field-label">Department</label>
                <input
                  type="text"
                  placeholder="e.g. Engineering"
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                  className="form-input"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowAddForm(false)}
                className="ghost-btn text-xs"
              >
                Cancel
              </button>
              <button type="submit" className="btn-primary text-xs">
                Save Candidate
              </button>
            </div>
          </form>
        )}

        {/* Candidate Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-[14px]">
          {candidates.map((cand) => {
            const statusNorm = cand.status?.toLowerCase() || "not_started";
            const isComplete = statusNorm === "complete" || statusNorm === "completed";
            const isInProgress = statusNorm === "in_progress" || statusNorm === "in progress";

            let pillClass = "status-not_started";
            let pillText = "Not started";
            let actionText = "Start session";

            if (isComplete) {
              pillClass = "status-complete";
              pillText = "Complete";
              actionText = "View summary";
            } else if (isInProgress) {
              pillClass = "status-in_progress";
              pillText = "In progress";
              actionText = "Resume session";
            }

            return (
              <div key={cand.id} className="panel-card flex flex-col justify-between">
                <div>
                  <div className="flex items-start justify-between gap-2 mb-2.5">
                    <div>
                      <p className="text-[15px] font-semibold m-0 leading-tight text-[var(--text)]">
                        {cand.name}
                      </p>
                      <p className="text-[12.5px] text-[var(--muted)] m-[3px_0_0_0]">
                        {cand.role || "Candidate"}
                      </p>
                    </div>
                    <span className={`status-pill ${pillClass}`}>{pillText}</span>
                  </div>

                  <div className="font-mono text-[11.5px] text-[var(--muted)] mb-[14px]">
                    {cand.questionsCount || 0} questions · {cand.recordingsCount || 0} recordings
                  </div>
                </div>

                <div className="space-y-2 pt-2 border-t border-[var(--line)]">
                  <button
                    onClick={() => onStartSession(cand)}
                    className={`w-full bg-[var(--panel-2)] border border-[var(--line)] text-[var(--text)] p-[9px] rounded-md cursor-pointer text-[13px] font-medium hover:border-[var(--teal)] transition-colors ${
                      isInProgress ? "border-[var(--amber)] text-[var(--amber)]" : ""
                    }`}
                  >
                    {actionText}
                  </button>

                  <button
                    onClick={() => onExportExcel(cand)}
                    className="w-full text-center text-[11px] font-mono text-[var(--muted)] hover:text-[var(--teal)] transition-colors py-1"
                  >
                    ↓ Export Excel
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
