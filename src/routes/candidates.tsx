import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, useRef } from "react";
import { useStudio } from "@/lib/store";
import {
  fetchCandidates,
  createCandidate as apiCreateCandidate,
  importCandidatesExcel,
  resetDatabase as apiResetDatabase,
  getExcelExportUrl
} from "@/services/api";

export const Route = createFileRoute("/candidates")({
  head: () => ({
    meta: [
      { title: "Interview Tracker — Candidates Dashboard" },
      {
        name: "description",
        content: "Candidate Roster Dashboard — Interview Tracker",
      },
    ],
  }),
  component: CandidatesPage,
});

export default function CandidatesPage() {
  const { state, logout } = useStudio();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState<"remaining" | "completed" | "all">("remaining");
  const [candidates, setCandidates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Import Choice Modal State
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [showImportChoiceModal, setShowImportChoiceModal] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importMsg, setImportMsg] = useState("");

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Add Candidate Form state
  const [showAddForm, setShowAddForm] = useState(false);
  const [name, setName] = useState("");
  const [domainsAppliedFor, setDomainsAppliedFor] = useState("");
  const [branchAndSection, setBranchAndSection] = useState("");
  const [domainInAAC, setDomainInAAC] = useState("");
  const [cgpa, setCgpa] = useState("");
  const [currentAttendance, setCurrentAttendance] = useState("");

  // Reset Database Modal state
  const [showResetModal, setShowResetModal] = useState(false);
  const [resetPassword, setResetPassword] = useState("");
  const [resetError, setResetError] = useState("");
  const [isResetting, setIsResetting] = useState(false);

  const loadData = async () => {
    const dbCandidates = await fetchCandidates();
    if (dbCandidates && Array.isArray(dbCandidates)) {
      setCandidates(dbCandidates);
    } else {
      setCandidates(state.candidates || []);
    }
  };

  // Initial load
  useEffect(() => {
    async function init() {
      setLoading(true);
      await loadData();
      setLoading(false);
    }
    init();
  }, []);

  // Real-time auto-polling
  useEffect(() => {
    const interval = setInterval(() => {
      loadData();
    }, 3000);
    return () => clearInterval(interval);
  }, []);

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

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const newCandData = {
      name: name.trim(),
      domainsAppliedFor: domainsAppliedFor.trim() || "Web Dev, AI/ML",
      branchAndSection: branchAndSection.trim() || "CSE - A",
      domainInAAC: domainInAAC.trim() || "Computer Vision",
      cgpa: cgpa.trim() || "8.5",
      currentAttendance: currentAttendance.trim() || "85%",
      status: "not_started"
    };

    const saved = await apiCreateCandidate(newCandData);
    if (saved) {
      setCandidates((prev) => [saved, ...prev]);
    } else {
      setCandidates((prev) => [
        { ...newCandData, id: `cand_${Date.now()}`, sessions: [] },
        ...prev
      ]);
    }

    setName("");
    setDomainsAppliedFor("");
    setBranchAndSection("");
    setDomainInAAC("");
    setCgpa("");
    setCurrentAttendance("");
    setShowAddForm(false);
  };

  const handleFileImportClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setPendingFile(file);
    setShowImportChoiceModal(true);
  };

  const executeImport = async (clearExisting: boolean) => {
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
      await loadData();
    } else {
      setImportMsg(res?.error ? `Import error: ${res.error}` : "Failed to import Excel file.");
    }

    setPendingFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
    setTimeout(() => setImportMsg(""), 4000);
  };

  const handleResetSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setResetError("");
    if (!resetPassword) {
      setResetError("Please enter admin password");
      return;
    }

    setIsResetting(true);
    const res = await apiResetDatabase(resetPassword);
    setIsResetting(false);

    if (res && res.success) {
      setShowResetModal(false);
      setResetPassword("");
      await loadData();
    } else {
      setResetError(res?.error || "Invalid password");
    }
  };

  const handleExportExcel = (candId?: string) => {
    const url = getExcelExportUrl(candId);
    window.open(url, "_blank");
  };

  const handleLogout = () => {
    logout();
    navigate({ to: "/" });
  };

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "var(--bg)", color: "var(--text)" }}>
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
        <div className="spacer"></div>
        <button
          onClick={handleFileImportClick}
          disabled={importing}
          className="ghost-btn"
          style={{ color: "var(--teal)", borderColor: "var(--teal)" }}
          title="Import candidates from Excel (.xlsx, .csv)"
        >
          {importing ? "Importing..." : "↑ Import Candidates Excel"}
        </button>
        <button
          onClick={() => handleExportExcel()}
          className="ghost-btn"
          title="Export All Candidates Master Excel"
        >
          ↓ Export Master Excel
        </button>
        <button
          onClick={() => setShowResetModal(true)}
          className="ghost-btn"
          style={{ color: "var(--red)", borderColor: "var(--red)" }}
        >
          Reset Database
        </button>
        <button onClick={handleLogout} className="ghost-btn">
          Log out
        </button>
      </div>

      {/* Excel Import Choice Modal */}
      {showImportChoiceModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(0, 0, 0, 0.75)",
            backdropFilter: "blur(4px)",
            zIndex: 9999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "20px"
          }}
        >
          <div
            className="login-card"
            style={{ width: "420px", borderColor: "var(--amber)" }}
          >
            <span className="login-mark" style={{ color: "var(--amber)" }}>
              EXCEL CANDIDATE IMPORT
            </span>
            <h3 style={{ margin: "0 0 10px 0", fontSize: "16px", color: "var(--text)" }}>
              Import Candidates Roster
            </h3>
            <p style={{ fontSize: "12px", color: "var(--muted)", marginBottom: "16px" }}>
              Selected file: <strong>{pendingFile?.name}</strong>. Choose how you would like to process existing candidates and recordings:
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginBottom: "16px" }}>
              <button
                type="button"
                onClick={() => executeImport(true)}
                className="btn-primary"
                style={{ backgroundColor: "var(--red)", color: "#fff", textAlign: "left", padding: "12px" }}
              >
                <div style={{ fontWeight: "bold", fontSize: "13px" }}>🗑️ Clear Old Candidates &amp; Recordings</div>
                <div style={{ fontSize: "11px", opacity: 0.9, marginTop: "2px" }}>
                  Deletes all existing candidates and recordings, loading fresh Excel roster.
                </div>
              </button>

              <button
                type="button"
                onClick={() => executeImport(false)}
                className="btn-primary"
                style={{ backgroundColor: "var(--teal)", color: "#fff", textAlign: "left", padding: "12px" }}
              >
                <div style={{ fontWeight: "bold", fontSize: "13px" }}>📁 Keep Existing &amp; Append</div>
                <div style={{ fontSize: "11px", opacity: 0.9, marginTop: "2px" }}>
                  Appends new candidates alongside existing candidate data.
                </div>
              </button>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <button
                type="button"
                onClick={() => {
                  setShowImportChoiceModal(false);
                  setPendingFile(null);
                  if (fileInputRef.current) fileInputRef.current.value = "";
                }}
                className="ghost-btn"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Password Confirmation Reset Modal */}
      {showResetModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(0, 0, 0, 0.75)",
            backdropFilter: "blur(4px)",
            zIndex: 9999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "20px"
          }}
        >
          <div
            className="login-card"
            style={{ width: "380px", borderColor: "var(--red)" }}
          >
            <span className="login-mark" style={{ color: "var(--red)" }}>
              DANGER ZONE / DATABASE RESET
            </span>
            <h3 style={{ margin: "0 0 12px 0", fontSize: "16px", color: "var(--text)" }}>
              Confirm Database Reset
            </h3>
            <p style={{ fontSize: "12px", color: "var(--muted)", marginBottom: "18px" }}>
              This will permanently delete all candidate recordings, AI summaries, and test sessions.
            </p>

            <form onSubmit={handleResetSubmit}>
              <label className="field-label">Admin Password *</label>
              <input
                type="password"
                required
                placeholder="Enter password (admin123)"
                value={resetPassword}
                onChange={(e) => setResetPassword(e.target.value)}
              />
              {resetError && (
                <span
                  style={{
                    color: "var(--red)",
                    fontFamily: "var(--mono)",
                    fontSize: "11px",
                    display: "block",
                    marginBottom: "14px"
                  }}
                >
                  {resetError}
                </span>
              )}
              <div style={{ display: "flex", gap: "10px", marginTop: "10px" }}>
                <button
                  type="button"
                  onClick={() => {
                    setShowResetModal(false);
                    setResetError("");
                    setResetPassword("");
                  }}
                  className="ghost-btn"
                  style={{ flex: 1 }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isResetting}
                  className="btn-primary"
                  style={{ flex: 1, backgroundColor: "var(--red)", color: "#fff" }}
                >
                  {isResetting ? "Resetting..." : "Confirm Reset"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Dashboard Body */}
      <div className="dash-body">
        {importMsg && (
          <div
            style={{
              backgroundColor: "var(--panel-2)",
              border: "1px solid var(--teal)",
              color: "var(--teal)",
              padding: "10px 16px",
              borderRadius: "8px",
              marginBottom: "16px",
              fontSize: "13px",
              fontFamily: "var(--mono)"
            }}
          >
            {importMsg}
          </div>
        )}

        <div className="dash-head">
          <h2>
            {candidates.length} TOTAL · {remainingCandidates.length} REMAINING · {completedCandidates.length} COMPLETE
          </h2>
          <div className="spacer"></div>
          <button
            onClick={handleFileImportClick}
            disabled={importing}
            className="ghost-btn"
            style={{ marginRight: "10px", color: "var(--teal)", borderColor: "var(--teal)" }}
          >
            ↑ Import Excel
          </button>
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="add-btn"
          >
            {showAddForm ? "✕ Cancel" : "+ Add candidate"}
          </button>
        </div>

        {/* Dashboard Tabs for Remaining vs Completed Candidates */}
        <div style={{ display: "flex", gap: "10px", marginBottom: "18px", borderBottom: "1px solid var(--line)", paddingBottom: "12px" }}>
          <button
            onClick={() => setActiveTab("remaining")}
            className="ghost-btn"
            style={{
              borderColor: activeTab === "remaining" ? "var(--amber)" : "transparent",
              color: activeTab === "remaining" ? "var(--amber)" : "var(--muted)",
              backgroundColor: activeTab === "remaining" ? "var(--panel-2)" : "transparent",
              fontWeight: activeTab === "remaining" ? "bold" : "normal"
            }}
          >
            Remaining Candidates ({remainingCandidates.length})
          </button>

          <button
            onClick={() => setActiveTab("completed")}
            className="ghost-btn"
            style={{
              borderColor: activeTab === "completed" ? "var(--teal)" : "transparent",
              color: activeTab === "completed" ? "var(--teal)" : "var(--muted)",
              backgroundColor: activeTab === "completed" ? "var(--panel-2)" : "transparent",
              fontWeight: activeTab === "completed" ? "bold" : "normal"
            }}
          >
            Completed Candidates ({completedCandidates.length})
          </button>

          <button
            onClick={() => setActiveTab("all")}
            className="ghost-btn"
            style={{
              borderColor: activeTab === "all" ? "var(--line)" : "transparent",
              color: activeTab === "all" ? "var(--text)" : "var(--muted)",
              backgroundColor: activeTab === "all" ? "var(--panel-2)" : "transparent",
              fontWeight: activeTab === "all" ? "bold" : "normal"
            }}
          >
            All Candidates ({candidates.length})
          </button>
        </div>

        {/* Inline Add Candidate Form */}
        {showAddForm && (
          <form
            onSubmit={handleAddSubmit}
            style={{
              backgroundColor: "var(--panel)",
              border: "1px solid var(--line)",
              borderRadius: "10px",
              padding: "18px",
              marginBottom: "20px"
            }}
          >
            <h3
              style={{
                margin: "0 0 14px 0",
                fontSize: "13px",
                fontFamily: "var(--mono)",
                color: "var(--amber)"
              }}
            >
              + ADD NEW CANDIDATE
            </h3>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                gap: "12px",
                marginBottom: "14px"
              }}
            >
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

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
              <button
                type="button"
                onClick={() => setShowAddForm(false)}
                className="ghost-btn"
              >
                Cancel
              </button>
              <button type="submit" className="btn-primary" style={{ width: "auto" }}>
                Save Candidate
              </button>
            </div>
          </form>
        )}

        {/* Candidate Cards Grid */}
        {loading ? (
          <div style={{ textAlign: "center", padding: "40px", fontFamily: "var(--mono)", color: "var(--muted)" }}>
            Loading candidates database...
          </div>
        ) : displayedCandidates.length === 0 ? (
          <div style={{ textAlign: "center", padding: "40px", backgroundColor: "var(--panel)", border: "1px solid var(--line)", borderRadius: "10px", color: "var(--muted)", fontFamily: "var(--mono)" }}>
            {activeTab === "completed"
              ? "No completed candidates yet."
              : activeTab === "remaining"
              ? "All candidates have completed their interviews!"
              : "No candidates found."}
          </div>
        ) : (
          <div className="cand-grid">
            {displayedCandidates.map((cand) => {
              const statusNorm = (cand.status || "not_started").toLowerCase();
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

              let recCount = cand.recordingsCount || 0;
              let qCount = cand.questionsCount || 0;

              if (Array.isArray(cand.sessions)) {
                let recSum = 0;
                cand.sessions.forEach((s: any) => {
                  if (Array.isArray(s.recordings)) recSum += s.recordings.length;
                });
                if (recSum > 0) recCount = recSum;
              }

              return (
                <div key={cand.id} className="cand-card">
                  <div>
                    <div className="cand-top">
                      <div>
                        <p className="cand-name">{cand.name}</p>
                        <p className="cand-role">{cand.branchAndSection || cand.role || "Branch & Sec"}</p>
                      </div>
                      <span className={`status-pill ${pillClass}`}>{pillText}</span>
                    </div>

                    <div style={{ fontSize: "11.5px", color: "var(--muted)", marginBottom: "8px", fontFamily: "var(--sans)" }}>
                      <div><strong>Domains:</strong> {cand.domainsAppliedFor || "N/A"}</div>
                      <div><strong>AAC Domain:</strong> {cand.domainInAAC || "N/A"}</div>
                      <div><strong>CGPA:</strong> {cand.cgpa || "N/A"} | <strong>Attnd:</strong> {cand.currentAttendance || "N/A"}</div>
                    </div>

                    <div className="cand-meta">
                      {qCount > 0 ? `${qCount} questions` : "12 questions"} · {recCount} recordings
                    </div>
                  </div>

                  <div>
                    <button
                      onClick={() => navigate({ to: "/session/$id", params: { id: cand.id } })}
                      className={`cand-action ${isInProgress ? "resume" : ""}`}
                    >
                      {actionText}
                    </button>
                    <div style={{ textAlign: "center", marginTop: "8px" }}>
                      <a
                        href="#"
                        onClick={(e) => {
                          e.preventDefault();
                          handleExportExcel(cand.id);
                        }}
                        style={{
                          fontSize: "11px",
                          fontFamily: "var(--mono)",
                          color: "var(--muted)",
                          textDecoration: "none"
                        }}
                      >
                        ↓ Export Excel
                      </a>
                    </div>
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
