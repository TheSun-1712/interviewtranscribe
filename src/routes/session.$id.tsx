import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import Shell from "@/components/Shell";
import RecordButton from "@/components/RecordButton";
import { answeredCount, formatClock, useStudio } from "@/lib/store";
import { OFFICIAL_COUNT, type Question } from "@/lib/questions";
import { NOT_ANSWERED } from "@/lib/transcribe";

export const Route = createFileRoute("/session/$id")({
  head: () => ({
    meta: [
      { title: "Interview Session — Interview Transcriber Studio" },
      {
        name: "description",
        content:
          "Record a full interview or answer-by-answer takes, read executive AI summaries, and expand clean candidate transcripts.",
      },
      { property: "og:title", content: "Interview Session — Interview Transcriber Studio" },
      {
        property: "og:description",
        content: "Continuous recorder, 12-question bank, AI summaries, and clean transcripts.",
      },
    ],
  }),
  component: SessionView,
});

function SessionView() {
  const { id } = Route.useParams();
  const { state, questions, saveTake, saveFullInterview, addCustomQuestion } = useStudio();
  const candidate = state.candidates.find((c) => c.id === id);
  const [custom, setCustom] = useState("");
  const [fullStatus, setFullStatus] = useState<"idle" | "recording" | "transcribing" | "done">(
    "idle",
  );

  const grouped = useMemo(() => {
    const map = new Map<string, Question[]>();
    questions.forEach((q) => map.set(q.category, [...(map.get(q.category) ?? []), q]));
    return [...map.entries()];
  }, [questions]);

  if (!candidate) {
    return (
      <Shell>
        <main className="mx-auto max-w-[1200px] px-6 py-16 text-center">
          <h1 className="display text-2xl font-semibold">Candidate not found</h1>
          <Link to="/candidates" className="mono mt-3 inline-block text-[11px] text-signal">
            ← Back to Candidates
          </Link>
        </main>
      </Shell>
    );
  }

  const done = answeredCount(candidate);
  const pct = Math.round((done / OFFICIAL_COUNT) * 100);

  return (
    <Shell>
      <main className="mx-auto max-w-[1200px] px-6 pt-8 pb-28">
        <div className="animate-rise mb-4 flex items-end justify-between gap-4">
          <div>
            <p className="text-[10px] uppercase tracking-[0.22em] text-inkmuted">
              Session · {candidate.department}
            </p>
            <h1 className="display text-2xl font-semibold text-balance">{candidate.name}</h1>
            <p className="mt-0.5 text-[11px] text-inkmuted">
              {candidate.role} · {candidate.email}
            </p>
          </div>
          <Link
            to="/candidates"
            className="text-[11px] text-inkmuted transition-colors hover:text-ink"
          >
            ← Back to Candidates
          </Link>
        </div>

        <div className="animate-rise rounded-2xl bg-panel p-4 ring-1 ring-line">
          <div className="flex items-center justify-between">
            <p className="text-[10px] uppercase tracking-[0.18em] text-inkmuted">
              Interview progress
            </p>
            <span className="mono text-[11px] text-signal">
              {done} of {OFFICIAL_COUNT} questions completed
            </span>
          </div>
          <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-panel2">
            {pct > 0 && (
              <div
                className="animate-grow h-full rounded-full bg-signal"
                style={{ width: `${pct}%` }}
              />
            )}
          </div>
        </div>

        <FullRecorder
          status={fullStatus}
          savedDuration={candidate.fullDuration}
          onStart={() => setFullStatus("recording")}
          onFinish={async (duration, url, blob) => {
            setFullStatus("transcribing");
            await saveFullInterview(candidate.id, duration, url, blob);
            setFullStatus("done");
          }}
        />

        <div className="mt-5 space-y-4">
          {grouped.map(([cat, items]) => (
            <section key={cat} className="space-y-2.5">
              <p className="text-[10px] uppercase tracking-[0.2em] text-inkmuted">{cat}</p>
              {items.map((q) => {
                const answer = candidate.answers[q.id];
                return (
                  <QuestionTake
                    key={q.id}
                    question={q}
                    summary={answer?.summary}
                    transcript={answer?.transcript}
                    duration={answer?.duration}
                    status={answer?.status ?? "idle"}
                    onComplete={(payload) => saveTake(candidate.id, q.id, payload)}
                  />
                );
              })}
            </section>
          ))}
        </div>
      </main>

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-background/90 backdrop-blur-sm">
        <div className="mx-auto flex max-w-[1200px] items-center gap-2 px-6 py-3">
          <input
            value={custom}
            onChange={(e) => setCustom(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && custom.trim()) {
                addCustomQuestion("Spontaneous", custom.trim());
                setCustom("");
              }
            }}
            placeholder="Enter a spontaneous custom question…"
            className="flex-1 rounded-xl bg-panel px-3 py-2.5 text-[12px] ring-1 ring-line outline-none placeholder:text-inkmuted/60 focus:ring-signal/50"
          />
          <button
            onClick={() => {
              if (!custom.trim()) return;
              addCustomQuestion("Spontaneous", custom.trim());
              setCustom("");
            }}
            className="shrink-0 rounded-xl bg-signal px-3.5 py-2.5 text-[11px] font-semibold text-background transition-colors hover:bg-live"
          >
            + Add Question
          </button>
        </div>
      </div>
    </Shell>
  );
}

function FullRecorder({
  status,
  savedDuration,
  onStart,
  onFinish,
}: {
  status: "idle" | "recording" | "transcribing" | "done";
  savedDuration?: number | undefined;
  onStart: () => void;
  onFinish: (duration: number, url?: string, blob?: Blob) => void;
}) {
  const message =
    status === "recording"
      ? "● Recording full interview · 128kbps Opus · noise suppression on"
      : status === "transcribing"
        ? "Diarizing speakers and mapping answers to questions…"
        : status === "done"
          ? "Full interview processed and attached to this candidate"
          : "Idle · captures one continuous take for the whole interview";

  return (
    <div
      className={`animate-rise mt-3 rounded-2xl bg-panel p-4 ring-1 ${
        status === "recording" ? "ring-live/40" : "ring-line"
      }`}
    >
      <div className="flex flex-wrap items-center gap-4">
        <RecordButton
          size="lg"
          label="🎙️ Start Full Interview Rec"
          status={status === "transcribing" ? "transcribing" : status === "done" ? "done" : "idle"}
          onComplete={({ duration, audioUrl, audioBlob }: any) => onFinish(duration, audioUrl, audioBlob)}
        />
        <div className="min-w-0">
          <p className="mono text-lg leading-none font-semibold">
            {formatClock(savedDuration ?? 0)}
          </p>
          <p
            className={`mt-1.5 text-[10px] uppercase tracking-[0.18em] ${
              status === "recording" ? "text-danger" : "text-inkmuted"
            }`}
          >
            {message}
          </p>
        </div>
        <div className="ml-auto flex h-6 items-end gap-1.5" aria-hidden="true">
          {[0.5, 0.85, 0.4, 0.7, 0.55].map((h, i) => (
            <span
              key={i}
              className={`w-1 rounded-full bg-live/70 ${status === "recording" ? "animate-meter" : ""}`}
              style={{ height: `${h * 24}px`, animationDelay: `${i * 0.1}s` }}
            />
          ))}
        </div>
      </div>
      {status === "idle" && (
        <button
          onClick={onStart}
          className="mono mt-3 text-[10px] text-inkmuted transition-colors hover:text-ink"
        >
          Tip · per-question takes below can be recorded independently
        </button>
      )}
    </div>
  );
}

function QuestionTake({
  question,
  status,
  summary,
  transcript,
  duration,
  onComplete,
}: {
  question: Question;
  status: "idle" | "recording" | "uploading" | "transcribing" | "done";
  summary?: string | undefined;
  transcript?: string | undefined;
  duration?: number | undefined;
  onComplete: (payload: { duration: number; audioUrl?: string }) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div
      className={`rounded-2xl bg-panel p-4 ring-1 ${
        status === "done" ? "ring-line" : "ring-line"
      }`}
    >
      <div className="flex items-center gap-3">
        <span
          className={`mono shrink-0 text-[11px] font-semibold ${
            status === "done" ? "text-signal" : "text-inkmuted"
          }`}
        >
          {question.n ? `Q${question.n}` : "C"}
        </span>
        {status === "done" && (
          <span className="mono rounded-full bg-signal-soft px-2 py-0.5 text-[10px] text-signal">
            Saved
          </span>
        )}
        {typeof duration === "number" && status === "done" && (
          <span className="mono text-[10px] text-inkmuted">{formatClock(duration)}</span>
        )}
        <div className="ml-auto">
          <RecordButton status={status} onComplete={onComplete} />
        </div>
      </div>

      <p className="mt-2.5 text-[12px] text-ink/85">{question.prompt}</p>

      <div className="mt-3 rounded-xl bg-signal-soft/60 p-3 ring-1 ring-signal/15">
        <p className="mb-1 text-[10px] uppercase tracking-[0.16em] text-signal">
          Executive AI Summary
        </p>
        <p
          className={`text-[12px] leading-relaxed text-pretty ${
            summary ? "text-ink/85" : "text-inkmuted"
          }`}
        >
          {summary ?? NOT_ANSWERED}
        </p>
      </div>

      {transcript && (
        <>
          <button
            onClick={() => setOpen((v) => !v)}
            className="mt-2.5 text-[11px] text-inkmuted transition-colors hover:text-ink"
          >
            {open ? "Hide transcript ▴" : "View transcript ▾"}
          </button>
          {open && (
            <p className="mt-2 border-l-2 border-line pl-3 text-[12px] leading-relaxed text-pretty text-ink/70">
              {transcript}
            </p>
          )}
        </>
      )}
    </div>
  );
}
