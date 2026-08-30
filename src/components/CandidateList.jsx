import React, { useState, useEffect, useRef } from "react";
import { FileSpreadsheet, Upload, Plus, X, RotateCcw, AlertTriangle, Trash2, Layers } from "lucide-react";
import { importCandidatesExcel } from "../services/api";

export default function CandidateList({
  candidates,
  selectedCandidate,
  onSelectCandidate,
  onStartSession,
  onAddCandidate,
  onDeleteCandidate,
  onExportExcel,
  onResetDatabase,
  onRefreshData,
  onLogout
}) {
  const [activeTab, setActiveTab] = useState("remaining"); // remaining | completed | all
  const [showAddForm, setShowAddForm] = useState(false);

  // Reset Database Modal state
  const [showResetModal, setShowResetModal] = useState(false);
  const [resetPassword, setResetPassword] = useState("");
  const [resetError, setResetError] = useState("");
  const [isResetting, setIsResetting] = useState(false);

  // Import Choice Modal State
  const [pendingFile, setPendingFile] = useState(null);
  const [showImportChoiceModal, setShowImportChoiceModal] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importMsg, setImportMsg] = useState("");
  const fileInputRef = useRef(null);

  // 6 Candidate Metadata Form Parameters
  const [name, setName] = useState("");
  const [domainsAppliedFor, setDomainsAppliedFor] = useState("");
  const [branchAndSection, setBranchAndSection] = useState("");
  const [domainInAAC, setDomainInAAC] = useState("");
  const [cgpa, setCgpa] = useState("");
  const [currentAttendance, setCurrentAttendance] = useState("");

  // Real-time auto-polling for simultaneous multi-user updates
  useEffect(() => {
    const interval = setInterval(() => {
      if (onRefreshData) onRefreshData();
    }, 3000);
    return () => clearInterval(interval);
  }, [onRefreshData]);

  const completedCandidates = candidates.filter((c) => {
    const norm = (c.status || "").toLowerCase();
    return norm === "completed" || norm === "complete";
  });

  const remainingCandidates = candidates.filter((c) => {
    const norm = (c.status || "").toLowerCase();
    return norm !== "completed" && norm !== "complete";
  });

  const displayedCandidates =
    activeTab === "completed"
      ? completedCandidates
      : activeTab === "all"
      ? candidates
      : remainingCandidates;

  const handleAddSubmit = (e) => {
    e.preventDefault();
    if (!name.trim()) return;

    onAddCandidate({
      name: name.trim(),
      domainsAppliedFor: domainsAppliedFor.trim() || "Software Engineering",
      branchAndSection: branchAndSection.trim() || "CSE - A",
      domainInAAC: domainInAAC.trim() || "Computer Vision / AI",
      cgpa: cgpa.trim() || "8.5",
      currentAttendance: currentAttendance.trim() || "85%",
      role: domainsAppliedFor.trim() || "Candidate",
      department: branchAndSection.trim() || "Engineering",
      status: "not_started"
    });

    setName("");
    setDomainsAppliedFor("");
    setBranchAndSection("");
    setDomainInAAC("");
    setCgpa("");
    setCurrentAttendance("");
    setShowAddForm(false);
  };

  const handleImportFileClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setPendingFile(file);
    setShowImportChoiceModal(true);
  };

  const executeImport = async (clearExisting) => {
    if (!pendingFile) return;

    setShowImportChoiceModal(false);
    setImporting(true);
    setImportMsg(clearExisting ? "Clearing database & importing new roster..." : "Importing candidates...");

    const res = await importCandidatesExcel(pendingFile, clearExisting);
    setImporting(false);

    if (res && res.success) {
      setImportMsg(
        clearExisting
          ? `✓ Database cleared & ${res.count} new candidates imported!`
          : `✓ Successfully imported ${res.count} candidates!`
      );
      if (onRefreshData) onRefreshData();
    } else {
      setImportMsg(res?.error ? `Import error: ${res.error}` : "Failed to import Excel file.");
    }

    setPendingFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
    setTimeout(() => setImportMsg(""), 4000);
  };

  const handleResetSubmit = async (e) => {
    e.preventDefault();
    setResetError("");

    if (!resetPassword) {
      setResetError("Please enter admin password");
      return;
    }

    setIsResetting(true);
    const result = await onResetDatabase(resetPassword);
    setIsResetting(false);

    if (result && result.success) {
      setShowResetModal(false);
      setResetPassword("");
    } else {
      setResetError(result?.error || "Invalid admin password");
    }
  };

  return (
    <div>
      {/* Hidden File Input for Excel Import */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileSelect}
        accept=".xlsx,.xls,.csv"
        style={{ display: "none" }}
      />

      {/* Topbar */}
      <div className="topbar">
        <span className="mark">SIGNAL</span>
        <h1>Candidates</h1>
        <div className="flex-1" />
        <button
          onClick={handleImportFileClick}
          disabled={importing}
          className="ghost-btn font-mono text-xs text-[var(--teal)] border-[var(--teal)]/40 hover:border-[var(--teal)]"
          title="Import candidates roster from Excel file (.xlsx, .csv)"
        >
          <Upload className="h-3.5 w-3.5 inline mr-1 text-[var(--teal)]" />
          {importing ? "Importing..." : "↑ Import Candidates Excel"}
        </button>
        <button
          onClick={() => onExportExcel("all")}
          className="ghost-btn font-mono text-xs"
          title="Export All Candidates Master Excel Report"
        >
          <FileSpreadsheet className="h-3.5 w-3.5 inline mr-1 text-[var(--teal)]" />
          ↓ Export Master Excel
        </button>
        <button
          onClick={() => setShowResetModal(true)}
          className="ghost-btn font-mono text-xs text-[var(--red)] border-[var(--red)]/40 hover:border-[var(--red)]"
          title="Reset database and clear all test responses"
        >
          <RotateCcw className="h-3.5 w-3.5 inline mr-1" />
          Reset Database
        </button>
        <button onClick={onLogout} className="ghost-btn font-mono text-xs">
          Log out
        </button>
      </div>

      {/* Excel Import Choice Modal */}
      {showImportChoiceModal && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[var(--panel)] border border-[var(--amber)]/40 rounded-xl p-6 max-w-md w-full space-y-4 shadow-2xl">
            <div className="flex items-center gap-3 text-[var(--amber)]">
              <Upload className="h-6 w-6 shrink-0" />
              <h3 className="text-lg font-bold font-mono m-0">Import Candidates Roster</h3>
            </div>
            <p className="text-xs text-[var(--text)] m-0 leading-relaxed">
              You selected <strong>{pendingFile?.name}</strong>. Choose how you would like to handle existing database candidates and recordings:
            </p>

            <div className="space-y-3 pt-2">
              <button
                onClick={() => executeImport(true)}
                className="w-full text-left bg-[var(--panel-2)] border border-[var(--red)]/50 hover:border-[var(--red)] text-white p-3 rounded-lg cursor-pointer transition-colors"
              >
                <div className="font-semibold text-xs text-[var(--red)] flex items-center gap-2">
                  <Trash2 className="h-4 w-4" /> Clear Old Candidates &amp; Recordings
                </div>
                <div className="text-[11px] text-[var(--muted)] mt-1">
                  Permanently deletes existing candidates, recordings, and sessions, replacing the database with the new roster.
                </div>
              </button>

              <button
                onClick={() => executeImport(false)}
                className="w-full text-left bg-[var(--panel-2)] border border-[var(--teal)]/50 hover:border-[var(--teal)] text-white p-3 rounded-lg cursor-pointer transition-colors"
              >
                <div className="font-semibold text-xs text-[var(--teal)] flex items-center gap-2">
                  <Layers className="h-4 w-4" /> Keep Existing &amp; Append
                </div>
                <div className="text-[11px] text-[var(--muted)] mt-1">
                  Keeps all existing candidates and recordings intact, adding the new Excel candidates alongside them.
                </div>
              </button>
            </div>

            <div className="flex justify-end pt-2 border-t border-[var(--line)]">
              <button
                onClick={() => {
                  setShowImportChoiceModal(false);
                  setPendingFile(null);
                  if (fileInputRef.current) fileInputRef.current.value = "";
                }}
                className="ghost-btn text-xs"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Password Confirmation Reset Modal */}
      {showResetModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[var(--panel)] border border-[var(--red)]/40 rounded-xl p-6 max-w-md w-full space-y-4 shadow-2xl">
            <div className="flex items-center gap-3 text-[var(--red)]">
              <AlertTriangle className="h-6 w-6 shrink-0" />
              <h3 className="text-lg font-bold font-mono m-0">Confirm Database Reset</h3>
            </div>
            <p className="text-xs text-[var(--muted)] m-0 leading-relaxed">
              This action will permanently delete all candidate recordings, full audio files, AI section summaries, and test sessions.
            </p>

            <form onSubmit={handleResetSubmit} className="space-y-4">
              <div>
                <label className="field-label">Enter Admin Password to Confirm *</label>
                <input
                  type="password"
                  required
                  placeholder="Enter admin password (e.g. admin123)"
                  value={resetPassword}
                  onChange={(e) => setResetPassword(e.target.value)}
                  className="form-input"
                />
                {resetError && (
                  <span className="font-mono text-[11px] text-[var(--red)] block mt-1.5">
                    {resetError}
                  </span>
                )}
              </div>

              <div className="flex justify-end gap-3 pt-2 border-t border-[var(--line)]">
                <button
                  type="button"
                  onClick={() => {
                    setShowResetModal(false);
                    setResetError("");
                    setResetPassword("");
                  }}
                  className="ghost-btn text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isResetting}
                  className="btn-primary text-xs bg-[var(--red)] text-white hover:opacity-90"
                >
                  {isResetting ? "Resetting..." : "Yes, Clear & Reset Database"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Dashboard Body */}
      <div className="p-[26px_28px] max-w-[1080px] mx-auto space-y-6">
        {importMsg && (
          <div className="bg-[var(--panel-2)] border border-[var(--teal)] text-[var(--teal)] p-3 rounded-lg text-xs font-mono">
            {importMsg}
          </div>
        )}

        <div className="flex items-center">
          <h2 className="m-0 text-[15px] text-[var(--muted)] font-mono font-semibold tracking-[0.04em] uppercase">
            {candidates.length} TOTAL · {remainingCandidates.length} REMAINING · {completedCandidates.length} COMPLETE
          </h2>
          <div className="flex-1" />
          <button
            onClick={handleImportFileClick}
            disabled={importing}
            className="ghost-btn font-mono text-xs text-[var(--teal)] border-[var(--teal)]/40 hover:border-[var(--teal)] mr-2"
          >
            <Upload className="h-3.5 w-3.5 inline mr-1 text-[var(--teal)]" />
            ↑ Import Excel
          </button>
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

        {/* Dashboard Tabs for Remaining vs Completed Candidates */}
        <div className="flex gap-2 border-b border-[var(--line)] pb-3">
          <button
            onClick={() => setActiveTab("remaining")}
            className={`px-4 py-2 rounded-lg text-xs font-mono font-semibold transition-all cursor-pointer ${
              activeTab === "remaining"
                ? "bg-[var(--panel-2)] text-[var(--amber)] border border-[var(--amber)] shadow-sm"
                : "bg-transparent text-[var(--muted)] hover:text-white border border-transparent"
            }`}
          >
            Remaining Candidates ({remainingCandidates.length})
          </button>

          <button
            onClick={() => setActiveTab("completed")}
            className={`px-4 py-2 rounded-lg text-xs font-mono font-semibold transition-all cursor-pointer ${
              activeTab === "completed"
                ? "bg-[var(--panel-2)] text-[var(--teal)] border border-[var(--teal)] shadow-sm"
                : "bg-transparent text-[var(--muted)] hover:text-white border border-transparent"
            }`}
          >
            Completed Candidates ({completedCandidates.length})
          </button>

          <button
            onClick={() => setActiveTab("all")}
            className={`px-4 py-2 rounded-lg text-xs font-mono font-semibold transition-all cursor-pointer ${
              activeTab === "all"
                ? "bg-[var(--panel-2)] text-white border border-[var(--line)] shadow-sm"
                : "bg-transparent text-[var(--muted)] hover:text-white border border-transparent"
            }`}
          >
            All Candidates ({candidates.length})
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
                <label className="field-label">Domains Applied For</label>
                <input
                  type="text"
                  placeholder="e.g. Web Dev, AI/ML"
                  value={domainsAppliedFor}
                  onChange={(e) => setDomainsAppliedFor(e.target.value)}
                  className="form-input"
                />
              </div>
              <div>
                <label className="field-label">Branch & Section</label>
                <input
                  type="text"
                  placeholder="e.g. CSE - A"
                  value={branchAndSection}
                  onChange={(e) => setBranchAndSection(e.target.value)}
                  className="form-input"
                />
              </div>
              <div>
                <label className="field-label">Domain in AAC</label>
                <input
                  type="text"
                  placeholder="e.g. Computer Vision"
                  value={domainInAAC}
                  onChange={(e) => setDomainInAAC(e.target.value)}
                  className="form-input"
                />
              </div>
              <div>
                <label className="field-label">CGPA</label>
                <input
                  type="text"
                  placeholder="e.g. 8.75"
                  value={cgpa}
                  onChange={(e) => setCgpa(e.target.value)}
                  className="form-input"
                />
              </div>
              <div>
                <label className="field-label">Current Attendance (%)</label>
                <input
                  type="text"
                  placeholder="e.g. 88%"
                  value={currentAttendance}
                  onChange={(e) => setCurrentAttendance(e.target.value)}
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
        {displayedCandidates.length === 0 ? (
          <div className="text-center py-12 font-mono text-[var(--muted)] text-sm bg-[var(--panel)] border border-[var(--line)] rounded-xl">
            {activeTab === "completed"
              ? "No completed candidates yet."
              : activeTab === "remaining"
              ? "All candidates have completed their interviews!"
              : "No candidates found."}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-[14px]">
            {displayedCandidates.map((cand) => {
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
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div>
                        <p className="text-[15px] font-semibold m-0 leading-tight text-[var(--text)]">
                          {cand.name}
                        </p>
                        <p className="text-[12px] text-[var(--amber)] font-mono m-[3px_0_0_0]">
                          {cand.branchAndSection || cand.department || "Branch & Sec"}
                        </p>
                      </div>
                      <span className={`status-pill ${pillClass}`}>{pillText}</span>
                    </div>

                    <div className="text-[11.5px] text-[var(--muted)] space-y-0.5 mb-3 font-sans">
                      <div><strong>Domains:</strong> {cand.domainsAppliedFor || cand.role || "N/A"}</div>
                      <div><strong>AAC Domain:</strong> {cand.domainInAAC || "N/A"}</div>
                      <div><strong>CGPA:</strong> {cand.cgpa || "N/A"} | <strong>Attnd:</strong> {cand.currentAttendance || "N/A"}</div>
                    </div>

                    <div className="font-mono text-[11px] text-[var(--muted)] mb-3">
                      {cand.questionsCount || 12} questions · {cand.recordingsCount || 0} recordings
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
        )}
      </div>
    </div>
  );
}
