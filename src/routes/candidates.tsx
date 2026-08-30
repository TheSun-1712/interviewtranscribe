import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useStudio } from "@/lib/store";
import {
  fetchCandidates,
  createCandidate as apiCreateCandidate,
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

  const [candidates, setCandidates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Add Candidate Modal/Form state
  const [showAddForm, setShowAddForm] = useState(false);
  const [name, setName] = useState("");
  const [role, setRole] = useState("");
  const [department, setDepartment] = useState("");
  const [email, setEmail] = useState("");

  // Reset Database Modal state
  const [showResetModal, setShowResetModal] = useState(false);
  const [resetPassword, setResetPassword] = useState("");
  const [resetError, setResetError] = useState("");
  const [isResetting, setIsResetting] = useState(false);

  const loadData = async () => {
    setLoading(true);
    const dbCandidates = await fetchCandidates();
    if (dbCandidates && Array.isArray(dbCandidates)) {
      setCandidates(dbCandidates);
    } else {
      // Fallback to studio state if backend API offline
      setCandidates(state.candidates || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const newCandData = {
      name: name.trim(),
      role: role.trim() || "Candidate",
      department: department.trim() || "Engineering",
      email: email.trim() || `${name.toLowerCase().replace(/\s+/g, ".")}@example.com`,
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
    setRole("");
    setDepartment("");
    setEmail("");
    setShowAddForm(false);
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

  const completedCount = candidates.filter(
    (c) =>
      c.status?.toLowerCase() === "complete" ||
      c.status?.toLowerCase() === "completed"
  ).length;

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "var(--bg)", color: "var(--text)" }}>
      {/* Topbar */}
      <div className="topbar">
        <span className="mark">SIGNAL</span>
        <h1>Candidates</h1>
        <div className="spacer"></div>
        <button
          onClick={() => handleExportExcel()}
          className="ghost-btn"
          title="Export All Candidates Master Excel"
        >
          Export All Candidates Excel
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
        <div className="dash-head">
          <h2>
            {candidates.length} CANDIDATES · {completedCount} COMPLETE
          </h2>
          <div className="spacer"></div>
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="add-btn"
          >
            {showAddForm ? "✕ Cancel" : "+ Add candidate"}
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
              <div>
                <label className="field-label">Email</label>
                <input
                  type="email"
                  placeholder="e.g. priya@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
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
        ) : (
          <div className="cand-grid">
            {candidates.map((cand) => {
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

              // Compute recording stats
              let recCount = cand.recordingsCount || 0;
              let qCount = cand.questionsCount || 0;

              if (Array.isArray(cand.sessions)) {
                let recSum = 0;
                cand.sessions.forEach((s: any) => {
                  if (Array.isArray(s.recordings)) recSum += s.recordings.length;
                });
                if (recSum > 0) recCount = recSum;
              }

              const metaText =
                isComplete
                  ? `${qCount || 8} questions · ${recCount} recordings`
                  : isInProgress
                  ? `${qCount > 0 ? `${qCount} of 8` : "5 of 8"} questions · ${recCount} recordings`
                  : "0 questions asked";

              return (
                <div key={cand.id} className="cand-card">
                  <div>
                    <div className="cand-top">
                      <div>
                        <p className="cand-name">{cand.name}</p>
                        <p className="cand-role">{cand.role || "Candidate"}</p>
                      </div>
                      <span className={`status-pill ${pillClass}`}>{pillText}</span>
                    </div>
                    <div className="cand-meta">{metaText}</div>
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
