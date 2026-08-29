import React, { useState } from "react";
import { StudioProvider, useStudio, answeredCount, candidateStatus, formatClock } from "./lib/store";
import { OFFICIAL_COUNT, OFFICIAL_QUESTIONS } from "./lib/questions";
import { NOT_ANSWERED } from "./lib/transcribe";
import RecordButton from "./components/RecordButton";

export default function App() {
  return (
    <StudioProvider>
      <MainContainer />
    </StudioProvider>
  );
}

function MainContainer() {
  const { ready, state, login, logout, resetDatabase, exportExcel, addCandidate, addCustomQuestion, removeCustomQuestion, saveTake, saveFullInterview, questions } = useStudio();
  const [currentView, setCurrentView] = useState("candidates"); // candidates | session | questions | settings
  const [selectedCandidateId, setSelectedCandidateId] = useState(null);
  const [resetOpen, setResetOpen] = useState(false);
  const [resetPassword, setResetPassword] = useState("");
  const [resetError, setResetError] = useState(null);

  // Login form state
  const [loginPassword, setLoginPassword] = useState("");
  const [loginError, setLoginError] = useState(null);

  // Add Candidate form state
  const [addingCandidate, setAddingCandidate] = useState(false);
  const [candForm, setCandForm] = useState({ name: "", role: "", department: "", email: "" });

  // Custom question state in Session view
  const [customQuestionPrompt, setCustomQuestionPrompt] = useState("");
  const [fullRecStatus, setFullRecStatus] = useState("idle");

  if (!ready) {
    return (
      <div className="min-h-screen grid place-items-center bg-[#141821] text-[#838C9E]">
        <p className="mono text-[11px] uppercase tracking-[0.22em]">Loading Studio...</p>
      </div>
    );
  }

  if (!state.authed) {
    const handleLoginSubmit = (e) => {
      e.preventDefault();
      if (login(loginPassword)) {
        setLoginError(null);
      } else {
        setLoginError("Invalid admin password");
      }
    };

    return (
      <main className="grid min-h-screen place-items-center bg-[#141821] px-6 text-[#F0F4F8]">
        <div className="w-full max-w-sm">
          <div className="rounded-2xl bg-[#1B2130] p-6 ring-1 ring-[#2C3448]">
            <div className="flex items-end gap-1.5" aria-hidden="true">
              {[0.35, 0.7, 1, 0.5, 0.85, 0.4, 0.95, 0.6, 0.3].map((h, i) => (
                <span
                  key={i}
                  className="animate-meter w-1 rounded-full bg-[#4FB6A6]/70"
                  style={{ height: `${h * 32}px`, animationDelay: `${i * 0.09}s` }}
                />
              ))}
            </div>
            <p className="mt-5 text-[10px] uppercase tracking-[0.22em] text-[#838C9E]">
              Signal · Admin Access
            </p>
            <h1 className="display mt-1 text-2xl font-semibold text-balance">
              Interview Transcriber Studio
            </h1>
            <p className="mt-2 text-[12px] leading-relaxed text-[#838C9E]">
              Enter the shared operator password to open the candidate roster.
            </p>

            <form onSubmit={handleLoginSubmit} className="mt-5">
              <input
                type="password"
                value={loginPassword}
                onChange={(e) => {
                  setLoginPassword(e.target.value);
                  setLoginError(null);
                }}
                placeholder="Admin password"
                className="mono w-full rounded-xl bg-[#141821] px-3 py-2.5 text-[12px] ring-1 ring-[#2C3448] outline-none placeholder:text-[#838C9E]/60 focus:ring-[#4FB6A6]/50"
              />
              {loginError && (
                <p className="mt-2.5 rounded-lg bg-[#E15B5B]/20 px-3 py-2 text-[11px] text-[#E15B5B]">
                  {loginError}
                </p>
              )}
              <button
                type="submit"
                className="mt-3 w-full rounded-xl bg-[#4FB6A6] px-3 py-2.5 text-[11px] font-semibold text-[#141821] transition-colors hover:bg-[#58C9B9]"
              >
                Sign In
              </button>
            </form>
          </div>
          <p className="mono mt-3 text-center text-[10px] text-[#838C9E]">
            Demo password · admin123
          </p>
        </div>
      </main>
    );
  }

  const activeCandidate = state.candidates.find((c) => c.id === selectedCandidateId);

  const confirmResetDb = async () => {
    const ok = await resetDatabase(resetPassword);
    if (ok) {
      setResetOpen(false);
      setResetPassword("");
      setResetError(null);
      setCurrentView("candidates");
    } else {
      setResetError("Incorrect admin password.");
    }
  };

  return (
    <div className="min-h-screen bg-[#141821] text-[#F0F4F8]">
      {/* Top Navbar */}
      <header className="sticky top-0 z-20 border-b border-[#2C3448] bg-[#141821]/85 backdrop-blur-sm">
        <div className="mx-auto flex h-16 max-w-[1200px] items-center gap-4 px-6">
          <button onClick={() => setCurrentView("candidates")} className="flex items-center gap-2.5 text-left">
            <span className="size-2.5 rounded-full bg-[#4FB6A6] animate-ring" />
            <span className="leading-none">
              <span className="display block text-[15px] font-semibold">
                Interview Transcriber Studio
              </span>
              <span className="mt-1 block text-[9px] uppercase tracking-[0.22em] text-[#838C9E]">
                Internal · Operator Console
              </span>
            </span>
          </button>

          <nav className="ml-6 hidden items-center gap-1 text-[11px] md:flex">
            <button
              onClick={() => setCurrentView("candidates")}
              className={`rounded-full px-3 py-2 transition-colors ${
                currentView === "candidates" || currentView === "session"
                  ? "bg-[#4FB6A6]/20 font-semibold text-[#4FB6A6]"
                  : "text-[#838C9E] hover:bg-[#212940]"
              }`}
            >
              Roster
            </button>
            <button
              onClick={() => setCurrentView("questions")}
              className={`rounded-full px-3 py-2 transition-colors ${
                currentView === "questions"
                  ? "bg-[#4FB6A6]/20 font-semibold text-[#4FB6A6]"
                  : "text-[#838C9E] hover:bg-[#212940]"
              }`}
            >
              Bank
            </button>
            <button
              onClick={() => setCurrentView("settings")}
              className={`rounded-full px-3 py-2 transition-colors ${
                currentView === "settings"
                  ? "bg-[#4FB6A6]/20 font-semibold text-[#4FB6A6]"
                  : "text-[#838C9E] hover:bg-[#212940]"
              }`}
            >
              Settings
            </button>
          </nav>

          <div className="ml-auto flex items-center gap-2">
            <button
              onClick={exportExcel}
              className="rounded-full bg-[#4FB6A6] px-3.5 py-2 text-[11px] font-semibold text-[#141821] transition-colors hover:bg-[#58C9B9]"
            >
              Export Excel
            </button>
            <button
              onClick={() => setResetOpen(true)}
              className="rounded-full px-3.5 py-2 text-[11px] text-[#838C9E] ring-1 ring-[#2C3448] transition-colors hover:text-[#E15B5B] hover:ring-[#E15B5B]/40"
            >
              Reset DB
            </button>
            <button
              onClick={logout}
              className="rounded-full px-3.5 py-2 text-[11px] text-[#838C9E] ring-1 ring-[#2C3448] transition-colors hover:text-[#F0F4F8] hover:ring-[#838C9E]/40"
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      {/* Main View Router */}
      {currentView === "candidates" && (
        <main className="mx-auto max-w-[1200px] px-6 py-8">
          <div className="animate-rise mb-4 flex items-end justify-between">
            <div>
              <p className="text-[10px] uppercase tracking-[0.22em] text-[#838C9E]">Roster</p>
              <h1 className="display text-2xl font-semibold text-balance">Candidate Roster</h1>
            </div>
            <div className="flex items-center gap-3">
              <span className="mono text-[11px] text-[#838C9E]">
                {state.candidates.filter((c) => candidateStatus(c) === "In Progress").length} active
              </span>
              <button
                onClick={() => setAddingCandidate((v) => !v)}
                className="rounded-xl px-3 py-2 text-[11px] font-semibold text-[#F0F4F8] ring-1 ring-[#2C3448] transition-colors hover:bg-[#212940]"
              >
                {addingCandidate ? "Close" : "+ Add Candidate"}
              </button>
            </div>
          </div>

          {addingCandidate && (
            <div className="animate-rise mb-4 rounded-2xl bg-[#212940] p-3.5 ring-1 ring-[#2C3448]">
              <p className="mb-2.5 text-[10px] uppercase tracking-[0.2em] text-[#838C9E]">
                + Add Candidate
              </p>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
                <input
                  value={candForm.name}
                  onChange={(e) => setCandForm({ ...candForm, name: e.target.value })}
                  placeholder="Full name"
                  className="rounded-lg bg-[#141821] px-3 py-2 text-[11px] ring-1 ring-[#2C3448] outline-none placeholder:text-[#838C9E]/60 focus:ring-[#4FB6A6]/50"
                />
                <input
                  value={candForm.role}
                  onChange={(e) => setCandForm({ ...candForm, role: e.target.value })}
                  placeholder="Role"
                  className="rounded-lg bg-[#141821] px-3 py-2 text-[11px] ring-1 ring-[#2C3448] outline-none placeholder:text-[#838C9E]/60 focus:ring-[#4FB6A6]/50"
                />
                <input
                  value={candForm.department}
                  onChange={(e) => setCandForm({ ...candForm, department: e.target.value })}
                  placeholder="Department"
                  className="rounded-lg bg-[#141821] px-3 py-2 text-[11px] ring-1 ring-[#2C3448] outline-none placeholder:text-[#838C9E]/60 focus:ring-[#4FB6A6]/50"
                />
                <input
                  value={candForm.email}
                  onChange={(e) => setCandForm({ ...candForm, email: e.target.value })}
                  placeholder="Email"
                  className="rounded-lg bg-[#141821] px-3 py-2 text-[11px] ring-1 ring-[#2C3448] outline-none placeholder:text-[#838C9E]/60 focus:ring-[#4FB6A6]/50"
                />
              </div>
              <div className="mt-2.5 flex gap-2">
                <button
                  onClick={async () => {
                    if (!candForm.name.trim()) return;
                    await addCandidate(candForm);
                    setCandForm({ name: "", role: "", department: "", email: "" });
                    setAddingCandidate(false);
                  }}
                  className="rounded-lg bg-[#4FB6A6] px-4 py-2 text-[11px] font-semibold text-[#141821] transition-colors hover:bg-[#58C9B9]"
                >
                  Save Candidate
                </button>
                <button
                  onClick={() => setAddingCandidate(false)}
                  className="rounded-lg px-3 py-2 text-[11px] text-[#838C9E] ring-1 ring-[#2C3448] transition-colors hover:text-[#F0F4F8]"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {state.candidates.map((c, i) => {
              const status = candidateStatus(c);
              const done = answeredCount(c);
              const pct = Math.round((done / OFFICIAL_COUNT) * 100);

              const pillStyle =
                status === "In Progress"
                  ? "bg-[#E8A33D]/20 text-[#E8A33D] ring-[#E8A33D]/30"
                  : status === "Completed"
                  ? "bg-[#4FB6A6]/20 text-[#4FB6A6] ring-[#4FB6A6]/30"
                  : "text-[#838C9E] ring-[#2C3448]";

              return (
                <article
                  key={c.id}
                  className="animate-rise rounded-2xl bg-[#1B2130] p-4 ring-1 ring-[#2C3448] transition-all duration-200 hover:-translate-y-0.5 hover:ring-[#4FB6A6]/40"
                  style={{ animationDelay: `${i * 60}ms` }}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="display text-[16px] font-semibold">{c.name}</p>
                      <p className="mt-0.5 text-[11px] text-[#838C9E]">
                        {c.role} · {c.department}
                      </p>
                    </div>
                    <span className={`mono shrink-0 rounded-full px-2.5 py-1 text-[10px] font-semibold ring-1 ${pillStyle}`}>
                      {status}
                    </span>
                  </div>

                  <div className="mt-3 flex items-center gap-3">
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[#212940]">
                      {pct > 0 && (
                        <div
                          className="animate-grow h-full rounded-full bg-[#4FB6A6]"
                          style={{ width: `${pct}%` }}
                        />
                      )}
                    </div>
                    <span className="mono whitespace-nowrap text-[10px] text-[#838C9E]">
                      {done} of {OFFICIAL_COUNT}
                    </span>
                  </div>

                  <p className="mono mt-2 text-[10px] text-[#838C9E]">Added {c.dateAdded}</p>

                  <button
                    onClick={() => {
                      setSelectedCandidateId(c.id);
                      setCurrentView("session");
                    }}
                    className={`mt-3 block w-full rounded-xl px-3 py-2 text-center text-[11px] font-semibold transition-colors ${
                      status === "Completed"
                        ? "bg-[#4FB6A6]/20 text-[#4FB6A6] hover:bg-[#4FB6A6] hover:text-[#141821]"
                        : status === "In Progress"
                        ? "bg-[#4FB6A6] text-[#141821] hover:bg-[#58C9B9]"
                        : "text-[#F0F4F8] ring-1 ring-[#2C3448] hover:bg-[#212940]"
                    }`}
                  >
                    {status === "Completed"
                      ? "View Summary"
                      : status === "In Progress"
                      ? "Resume Session"
                      : "Start Session"}
                  </button>
                </article>
              );
            })}
          </div>
        </main>
      )}

      {/* Session View */}
      {currentView === "session" && activeCandidate && (
        <main className="mx-auto max-w-[1200px] px-6 pt-8 pb-28">
          <div className="animate-rise mb-4 flex items-end justify-between gap-4">
            <div>
              <p className="text-[10px] uppercase tracking-[0.22em] text-[#838C9E]">
                Session · {activeCandidate.department}
              </p>
              <h1 className="display text-2xl font-semibold text-balance">{activeCandidate.name}</h1>
              <p className="mt-0.5 text-[11px] text-[#838C9E]">
                {activeCandidate.role} · {activeCandidate.email}
              </p>
            </div>
            <button
              onClick={() => setCurrentView("candidates")}
              className="text-[11px] text-[#838C9E] transition-colors hover:text-[#F0F4F8]"
            >
              ← Back to Candidates
            </button>
          </div>

          <div className="animate-rise rounded-2xl bg-[#1B2130] p-4 ring-1 ring-[#2C3448]">
            <div className="flex items-center justify-between">
              <p className="text-[10px] uppercase tracking-[0.18em] text-[#838C9E]">
                Interview progress
              </p>
              <span className="mono text-[11px] text-[#4FB6A6]">
                {answeredCount(activeCandidate)} of {OFFICIAL_COUNT} questions completed
              </span>
            </div>
            <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-[#212940]">
              <div
                className="animate-grow h-full rounded-full bg-[#4FB6A6]"
                style={{ width: `${Math.round((answeredCount(activeCandidate) / OFFICIAL_COUNT) * 100)}%` }}
              />
            </div>
          </div>

          {/* Continuous Full Interview Recorder */}
          <div className="animate-rise mt-3 rounded-2xl bg-[#1B2130] p-4 ring-1 ring-[#2C3448]">
            <div className="flex flex-wrap items-center gap-4">
              <RecordButton
                size="lg"
                label="🎙️ Start Full Interview Rec"
                status={fullRecStatus === "transcribing" ? "transcribing" : fullRecStatus === "done" ? "done" : "idle"}
                onComplete={async ({ duration, audioUrl, audioBlob }) => {
                  setFullRecStatus("transcribing");
                  await saveFullInterview(activeCandidate.id, duration, audioUrl, audioBlob);
                  setFullRecStatus("done");
                }}
              />
              <div className="min-w-0">
                <p className="mono text-lg leading-none font-semibold">
                  {formatClock(activeCandidate.fullDuration || 0)}
                </p>
                <p className="mt-1.5 text-[10px] uppercase tracking-[0.18em] text-[#838C9E]">
                  {fullRecStatus === "transcribing"
                    ? "Diarizing speakers and mapping answers to questions…"
                    : fullRecStatus === "done"
                    ? "Full interview processed and attached to candidate"
                    : "Idle · captures one continuous take for the whole interview"}
                </p>
              </div>
            </div>
          </div>

          {/* 12-Question Bank Roster */}
          <div className="mt-5 space-y-4">
            {questions.map((q) => {
              const answer = activeCandidate.answers[q.id];
              return (
                <div key={q.id} className="rounded-2xl bg-[#1B2130] p-4 ring-1 ring-[#2C3448]">
                  <div className="flex items-center gap-3">
                    <span className="mono shrink-0 text-[11px] font-semibold text-[#4FB6A6]">
                      {q.n ? `Q${q.n}` : "C"}
                    </span>
                    {answer?.status === "done" && (
                      <span className="mono rounded-full bg-[#4FB6A6]/20 px-2 py-0.5 text-[10px] text-[#4FB6A6]">
                        Saved
                      </span>
                    )}
                    <div className="ml-auto">
                      <RecordButton
                        status={answer?.status || "idle"}
                        onComplete={(payload) => saveTake(activeCandidate.id, q.id, payload)}
                      />
                    </div>
                  </div>

                  <p className="mt-2.5 text-[12px] text-[#F0F4F8]/85">{q.prompt}</p>

                  <div className="mt-3 rounded-xl bg-[#4FB6A6]/10 p-3 ring-1 ring-[#4FB6A6]/20">
                    <p className="mb-1 text-[10px] uppercase tracking-[0.16em] text-[#4FB6A6]">
                      Executive AI Summary
                    </p>
                    <p className="text-[12px] leading-relaxed text-[#F0F4F8]/85">
                      {answer?.summary || NOT_ANSWERED}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Bottom Pinned Custom Question Input */}
          <div className="fixed inset-x-0 bottom-0 z-30 border-t border-[#2C3448] bg-[#141821]/90 backdrop-blur-sm">
            <div className="mx-auto flex max-w-[1200px] items-center gap-2 px-6 py-3">
              <input
                value={customQuestionPrompt}
                onChange={(e) => setCustomQuestionPrompt(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && customQuestionPrompt.trim()) {
                    addCustomQuestion("Spontaneous", customQuestionPrompt.trim());
                    setCustomQuestionPrompt("");
                  }
                }}
                placeholder="Enter a spontaneous custom question…"
                className="flex-1 rounded-xl bg-[#1B2130] px-3 py-2.5 text-[12px] ring-1 ring-[#2C3448] outline-none placeholder:text-[#838C9E]/60 focus:ring-[#4FB6A6]/50"
              />
              <button
                onClick={() => {
                  if (!customQuestionPrompt.trim()) return;
                  addCustomQuestion("Spontaneous", customQuestionPrompt.trim());
                  setCustomQuestionPrompt("");
                }}
                className="shrink-0 rounded-xl bg-[#4FB6A6] px-3.5 py-2.5 text-[11px] font-semibold text-[#141821] transition-colors hover:bg-[#58C9B9]"
              >
                + Add Question
              </button>
            </div>
          </div>
        </main>
      )}

      {/* Questions Bank View */}
      {currentView === "questions" && (
        <main className="mx-auto max-w-[800px] px-6 py-8">
          <div className="animate-rise mb-4">
            <p className="text-[10px] uppercase tracking-[0.22em] text-[#838C9E]">Question Bank</p>
            <h1 className="display text-2xl font-semibold text-balance">Official Interview Bank</h1>
          </div>
          <div className="space-y-3">
            {questions.map((q, idx) => (
              <div key={q.id} className="rounded-xl bg-[#1B2130] p-4 ring-1 ring-[#2C3448]">
                <div className="flex items-center justify-between">
                  <span className="mono text-[10px] uppercase tracking-[0.18em] text-[#4FB6A6]">
                    {q.category} · Q{q.n || idx + 1}
                  </span>
                  {q.custom && (
                    <button
                      onClick={() => removeCustomQuestion(q.id)}
                      className="text-[10px] text-[#E15B5B] hover:underline"
                    >
                      Delete
                    </button>
                  )}
                </div>
                <p className="mt-1.5 text-[13px] font-medium text-[#F0F4F8]">{q.prompt}</p>
                <p className="mt-1 text-[11px] text-[#838C9E]">{q.objective}</p>
              </div>
            ))}
          </div>
        </main>
      )}

      {/* Settings View */}
      {currentView === "settings" && (
        <main className="mx-auto max-w-[640px] px-6 py-8">
          <div className="animate-rise mb-4">
            <p className="text-[10px] uppercase tracking-[0.22em] text-[#838C9E]">Configuration</p>
            <h1 className="display text-2xl font-semibold text-balance">Settings</h1>
            <p className="mt-1 text-[12px] text-[#838C9E]">
              Backend API integrations for Cloudinary, Groq Whisper Large V3, and Google Gemini Flash.
            </p>
          </div>
          <div className="space-y-3 rounded-2xl bg-[#1B2130] p-5 ring-1 ring-[#2C3448]">
            <div>
              <p className="text-[10px] uppercase tracking-[0.18em] text-[#838C9E]">Groq API Key</p>
              <input
                disabled
                value="gsk_5mMzSEwGBwTRenI7x0rm••••••••"
                className="mono mt-1.5 w-full rounded-xl bg-[#141821] px-3 py-2.5 text-[12px] ring-1 ring-[#2C3448] text-[#838C9E]"
              />
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-[0.18em] text-[#838C9E]">Gemini API Key</p>
              <input
                disabled
                value="AQ.Ab8RN6IpITRsa-f2Yt0P••••••••"
                className="mono mt-1.5 w-full rounded-xl bg-[#141821] px-3 py-2.5 text-[12px] ring-1 ring-[#2C3448] text-[#838C9E]"
              />
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-[0.18em] text-[#838C9E]">Cloudinary Cloud Name</p>
              <input
                disabled
                value="neugchyg"
                className="mono mt-1.5 w-full rounded-xl bg-[#141821] px-3 py-2.5 text-[12px] ring-1 ring-[#2C3448] text-[#838C9E]"
              />
            </div>
          </div>
        </main>
      )}

      {/* Database Reset Modal */}
      {resetOpen && (
        <div className="fixed inset-0 z-40 grid place-items-center bg-[#141821]/80 px-6 backdrop-blur-sm">
          <div className="animate-rise w-full max-w-md rounded-2xl bg-[#1B2130] p-5 ring-1 ring-[#2C3448]">
            <p className="text-[10px] uppercase tracking-[0.22em] text-[#E15B5B]">Destructive action</p>
            <h2 className="display mt-1 text-xl font-semibold">Reset database</h2>
            <p className="mt-2 text-[12px] leading-relaxed text-[#838C9E]">
              Are you sure you want to reset the database? All recordings will be cleared and the 12
              official questions re-seeded.
            </p>
            <input
              type="password"
              value={resetPassword}
              onChange={(e) => {
                setResetPassword(e.target.value);
                setResetError(null);
              }}
              placeholder="Admin password"
              className="mono mt-4 w-full rounded-xl bg-[#141821] px-3 py-2.5 text-[12px] ring-1 ring-[#2C3448] outline-none focus:ring-[#4FB6A6]/50"
            />
            {resetError && <p className="mt-2 text-[11px] text-[#E15B5B]">{resetError}</p>}
            <div className="mt-4 flex gap-2">
              <button
                onClick={confirmResetDb}
                className="flex-1 rounded-xl bg-[#E15B5B] px-3 py-2 text-[11px] font-semibold text-[#141821] transition-opacity hover:opacity-90"
              >
                Confirm Reset
              </button>
              <button
                onClick={() => {
                  setResetOpen(false);
                  setResetError(null);
                  setResetPassword("");
                }}
                className="rounded-xl px-3 py-2 text-[11px] text-[#838C9E] ring-1 ring-[#2C3448] transition-colors hover:text-[#F0F4F8]"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
