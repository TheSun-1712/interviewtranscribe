import React from "react";
import { Mic, FileSpreadsheet, Users, HelpCircle, Play, Settings, LogOut, ShieldCheck } from "lucide-react";

export default function Navbar({
  activeView,
  setActiveView,
  selectedCandidate,
  activeSession,
  onExportExcel,
  totalCandidatesCount,
  totalQuestionsCount,
  currentUser,
  onLogout
}) {
  return (
    <header className="sticky top-0 z-50 px-8 py-4 border-b border-white/10 bg-[#090d16]/90 backdrop-blur-xl">
      <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-6">
        {/* Brand Logo & Title */}
        <div className="flex items-center gap-3 cursor-pointer" onClick={() => setActiveView("candidates")}>
          <div className="h-9 w-9 rounded-xl bg-indigo-600/30 border border-indigo-500/40 flex items-center justify-center">
            <Mic className="h-5 w-5 text-indigo-400" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-white tracking-tight">
              Interview Studio
            </h1>
            <p className="text-[11px] text-slate-400">Multi-User Audio Transcription</p>
          </div>
        </div>

        {/* Central Navigation Tabs with Ample Spacing */}
        {currentUser && (
          <nav className="flex items-center gap-3 bg-slate-900/80 p-1.5 rounded-xl border border-white/10">
            <button
              onClick={() => setActiveView("candidates")}
              className={`flex items-center gap-2.5 px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
                activeView === "candidates"
                  ? "bg-indigo-600 text-white shadow-md shadow-indigo-500/20"
                  : "text-slate-400 hover:text-white hover:bg-white/5"
              }`}
            >
              <Users className="h-4 w-4" />
              <span>Candidates</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/10 text-slate-300 font-mono">
                {totalCandidatesCount}
              </span>
            </button>

            <button
              onClick={() => setActiveView("questions")}
              className={`flex items-center gap-2.5 px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
                activeView === "questions"
                  ? "bg-indigo-600 text-white shadow-md shadow-indigo-500/20"
                  : "text-slate-400 hover:text-white hover:bg-white/5"
              }`}
            >
              <HelpCircle className="h-4 w-4" />
              <span>Question Bank</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/10 text-slate-300 font-mono">
                {totalQuestionsCount}
              </span>
            </button>

            {activeSession && (
              <button
                onClick={() => setActiveView("session")}
                className={`flex items-center gap-2.5 px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
                  activeView === "session"
                    ? "bg-rose-600 text-white shadow-md shadow-rose-600/20"
                    : "text-rose-400 hover:text-white hover:bg-rose-500/10 border border-rose-500/20"
                }`}
              >
                <Play className="h-3.5 w-3.5 fill-current animate-pulse" />
                <span>Active Session</span>
              </button>
            )}

            <button
              onClick={() => setActiveView("settings")}
              className={`flex items-center gap-2.5 px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
                activeView === "settings"
                  ? "bg-indigo-600 text-white shadow-md shadow-indigo-500/20"
                  : "text-slate-400 hover:text-white hover:bg-white/5"
              }`}
            >
              <Settings className="h-4 w-4" />
              <span>Settings</span>
            </button>
          </nav>
        )}

        {/* Right User Controls & Excel Export */}
        <div className="flex items-center gap-4">
          {currentUser && (
            <>
              <button
                onClick={onExportExcel}
                className="btn btn-excel text-xs px-4 py-2 flex items-center gap-2 font-semibold shadow-md"
                title="Export Excel Report"
              >
                <FileSpreadsheet className="h-4 w-4" />
                <span>Export Excel</span>
              </button>

              <div className="h-5 w-[1px] bg-white/10 hidden sm:block" />

              <div className="flex items-center gap-3">
                <span className="text-xs text-slate-300 font-medium hidden sm:inline">
                  {currentUser.name}
                </span>
                <button
                  onClick={onLogout}
                  className="btn btn-secondary text-xs p-2 text-slate-400 hover:text-rose-400 hover:border-rose-500/30"
                  title="Sign Out"
                >
                  <LogOut className="h-4 w-4" />
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
