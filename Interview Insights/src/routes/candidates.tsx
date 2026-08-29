import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import Shell from "@/components/Shell";
import { answeredCount, candidateStatus, useStudio } from "@/lib/store";
import { OFFICIAL_COUNT } from "@/lib/questions";
import type { Candidate, CandidateStatus } from "@/lib/types";

export const Route = createFileRoute("/candidates")({
  head: () => ({
    meta: [
      { title: "Candidate Roster — Interview Transcriber Studio" },
      {
        name: "description",
        content:
          "Track every candidate's interview progress across the 12 official questions, add candidates, and export the master Excel workbook.",
      },
      { property: "og:title", content: "Candidate Roster — Interview Transcriber Studio" },
      {
        property: "og:description",
        content: "Interview progress, status pills, and one-click multi-tab Excel export.",
      },
    ],
  }),
  component: CandidateListPage,
});

const PILL: Record<CandidateStatus, string> = {
  "In Progress": "bg-amber-soft text-amber ring-amber/25",
  Completed: "bg-signal-soft text-signal ring-signal/25",
  "Not Started": "text-inkmuted ring-line",
};

function CandidateListPage() {
  const { state, addCandidate } = useStudio();
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ name: "", role: "", department: "", email: "" });

  const save = () => {
    if (!form.name.trim()) return;
    addCandidate(form);
    setForm({ name: "", role: "", department: "", email: "" });
    setAdding(false);
  };

  const active = state.candidates.filter((c) => candidateStatus(c) === "In Progress").length;

  return (
    <Shell>
      <main className="mx-auto max-w-[1200px] px-6 py-8">
        <div className="animate-rise mb-4 flex items-end justify-between">
          <div>
            <p className="text-[10px] uppercase tracking-[0.22em] text-inkmuted">Roster</p>
            <h1 className="display text-2xl font-semibold text-balance">Candidate Roster</h1>
          </div>
          <div className="flex items-center gap-3">
            <span className="mono text-[11px] text-inkmuted">{active} active</span>
            <button
              onClick={() => setAdding((v) => !v)}
              className="rounded-xl px-3 py-2 text-[11px] font-semibold text-ink ring-1 ring-line transition-colors hover:bg-panel2"
            >
              {adding ? "Close" : "+ Add Candidate"}
            </button>
          </div>
        </div>

        {adding && (
          <div className="animate-rise mb-4 rounded-2xl bg-panel2 p-3.5 ring-1 ring-line">
            <p className="mb-2.5 text-[10px] uppercase tracking-[0.2em] text-inkmuted">
              + Add Candidate
            </p>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
              {(
                [
                  ["name", "Full name"],
                  ["role", "Role"],
                  ["department", "Department"],
                  ["email", "Email"],
                ] as const
              ).map(([key, placeholder]) => (
                <input
                  key={key}
                  value={form[key]}
                  onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                  placeholder={placeholder}
                  className="rounded-lg bg-background px-3 py-2 text-[11px] ring-1 ring-line outline-none placeholder:text-inkmuted/60 focus:ring-signal/50"
                />
              ))}
            </div>
            <div className="mt-2.5 flex gap-2">
              <button
                onClick={save}
                className="rounded-lg bg-signal px-4 py-2 text-[11px] font-semibold text-background transition-colors hover:bg-live"
              >
                Save Candidate
              </button>
              <button
                onClick={() => setAdding(false)}
                className="rounded-lg px-3 py-2 text-[11px] text-inkmuted ring-1 ring-line transition-colors hover:text-ink"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {state.candidates.map((c, i) => (
            <CandidateCard key={c.id} candidate={c} index={i} />
          ))}
        </div>
      </main>
    </Shell>
  );
}

function CandidateCard({ candidate: c, index }: { candidate: Candidate; index: number }) {
  const status = candidateStatus(c);
  const done = answeredCount(c);
  const pct = Math.round((done / OFFICIAL_COUNT) * 100);

  return (
    <article
      className="animate-rise rounded-2xl bg-panel p-4 ring-1 ring-line transition-all duration-200 hover:-translate-y-0.5 hover:ring-signal/40"
      style={{ animationDelay: `${index * 60}ms` }}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="display text-[16px] font-semibold">{c.name}</p>
          <p className="mt-0.5 text-[11px] text-inkmuted">
            {c.role} · {c.department}
          </p>
        </div>
        <span
          className={`mono shrink-0 rounded-full px-2.5 py-1 text-[10px] font-semibold ring-1 ${PILL[status]}`}
        >
          {status}
        </span>
      </div>

      <div className="mt-3 flex items-center gap-3">
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-panel2">
          {pct > 0 && (
            <div
              className="animate-grow h-full rounded-full bg-signal"
              style={{ width: `${pct}%` }}
            />
          )}
        </div>
        <span className="mono whitespace-nowrap text-[10px] text-inkmuted">
          {done} of {OFFICIAL_COUNT}
        </span>
      </div>

      <p className="mono mt-2 text-[10px] text-inkmuted">Added {c.dateAdded}</p>

      <Link
        to="/session/$id"
        params={{ id: c.id }}
        className={`mt-3 block rounded-xl px-3 py-2 text-center text-[11px] font-semibold transition-colors ${
          status === "Completed"
            ? "bg-signal-soft text-signal hover:bg-signal hover:text-background"
            : status === "In Progress"
              ? "bg-signal text-background hover:bg-live"
              : "text-ink ring-1 ring-line hover:bg-panel2"
        }`}
      >
        {status === "Completed"
          ? "View Summary"
          : status === "In Progress"
            ? "Resume Session"
            : "Start Session"}
      </Link>
    </article>
  );
}
