import { useEffect, useState, useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import {
  ArrowLeft,
  CheckCircle2,
  Circle,
  Download,
  Loader2,
  Mic,
  Pause,
  Play,
  Save,
  Square,
} from "lucide-react";
import { toast } from "sonner";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "./ui/accordion";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Progress } from "./ui/progress";
import { Textarea } from "./ui/textarea";
import { formatDuration, useAudioRecorder } from "../hooks/useAudioRecorder";
import {
  fetchCandidate,
  saveFeedback,
  uploadFullSessionRecording,
  API_BASE_URL,
  type QuestionAnswer,
} from "../services/api";

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border/60 bg-secondary/40 p-3">
      <span className="block text-[11px] uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      <span className="block truncate font-mono text-sm font-semibold text-foreground">
        {value}
      </span>
    </div>
  );
}

function AnswerRow({
  candidateId,
  answer,
}: {
  candidateId: string;
  answer: QuestionAnswer;
}) {
  const qc = useQueryClient();
  const [score, setScore] = useState<string>(answer.score?.toString() ?? "");
  const [comment, setComment] = useState<string>(answer.comment ?? "");

  useEffect(() => {
    setScore(answer.score?.toString() ?? "");
    setComment(answer.comment ?? "");
  }, [answer.score, answer.comment]);

  const save = useMutation({
    mutationFn: (payload: { score: number | null; comment: string }) =>
      saveFeedback(candidateId, answer.questionIndex, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["candidate", candidateId] });
      qc.invalidateQueries({ queryKey: ["candidates"] });
    },
    onError: () => toast.error("Could not save evaluation feedback"),
  });

  useEffect(() => {
    const numScore = score === "" ? null : Number(score);
    if (numScore === answer.score && comment === answer.comment) return;
    const handle = setTimeout(() => {
      save.mutate({ score: numScore, comment });
    }, 600);
    return () => clearTimeout(handle);
  }, [score, comment]);

  return (
    <AccordionItem
      value={`q-${answer.questionIndex}`}
      className="glass-panel px-5 py-1 border border-border/50"
    >
      <AccordionTrigger className="hover:no-underline">
        <span className="flex items-center gap-3 text-left">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-secondary text-xs font-semibold">
            {answer.questionIndex}
          </span>
          <span className="font-medium text-foreground">{answer.question}</span>
        </span>
        <span className="ml-auto flex items-center gap-2 pr-2">
          {answer.score !== null ? (
            <Badge variant="outline" className="font-mono border-primary/50 text-primary">
              Score: {answer.score}/10
            </Badge>
          ) : null}
          <Badge
            className={
              answer.asked
                ? "border border-success/40 bg-success/15 text-success"
                : "border border-border bg-secondary text-muted-foreground"
            }
          >
            {answer.asked ? "Answered" : "Not asked"}
          </Badge>
        </span>
      </AccordionTrigger>
      <AccordionContent className="space-y-4 pb-5">
        <div>
          <h4 className="text-xs font-semibold uppercase tracking-wide text-primary">
            AI answer summary
          </h4>
          <p className="mt-1 text-sm text-muted-foreground">
            {answer.asked
              ? (answer.summary ?? "[Not answered in this session]")
              : "Question not asked in session"}
          </p>
        </div>
        <div>
          <h4 className="text-xs font-semibold uppercase tracking-wide text-accent">
            Candidate spoken answer
          </h4>
          <p className="mt-1 text-sm leading-relaxed text-foreground/90">
            {answer.asked
              ? (answer.transcript ?? "[Not answered in this session]")
              : "Question not asked in session"}
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-[140px_1fr]">
          <div className="space-y-1.5">
            <label className="text-xs font-medium" htmlFor={`score-${answer.questionIndex}`}>
              Score (0–10)
            </label>
            <Input
              id={`score-${answer.questionIndex}`}
              type="number"
              min={0}
              max={10}
              value={score}
              onChange={(e) => setScore(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium" htmlFor={`comment-${answer.questionIndex}`}>
              Interviewer comments
            </label>
            <Textarea
              id={`comment-${answer.questionIndex}`}
              rows={2}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Evaluator notes…"
            />
          </div>
        </div>
        <p className="text-[11px] text-muted-foreground">
          {save.isPending ? "Saving…" : "Feedback auto-saves as you type."}
        </p>
      </AccordionContent>
    </AccordionItem>
  );
}

type RecordState = "idle" | "recording" | "paused" | "stopped";

export function SessionView({ candidateId }: { candidateId: string }) {
  const qc = useQueryClient();
  const recorder = useAudioRecorder();

  // Pending recording blob waiting to be saved
  const [pendingBlob, setPendingBlob] = useState<Blob | null>(null);
  const [pendingDuration, setPendingDuration] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [saved, setSaved] = useState(false);

  const { data: candidate, isLoading } = useQuery({
    queryKey: ["candidate", candidateId],
    queryFn: () => fetchCandidate(candidateId),
    refetchInterval: saved ? 5000 : 3000,
  });

  /** Stop recording — keep blob in memory, show Save button */
  const handleStop = async () => {
    const result = await recorder.stop();
    if (!result) return;
    setPendingBlob(result.blob);
    setPendingDuration(result.durationSec);
    toast.info("Recording stopped. Click 'Save & End Interview' to transcribe and save.");
  };

  /** Upload blob → Whisper → LLM divide → DB */
  const handleSave = async () => {
    if (!pendingBlob) return;
    setUploading(true);
    try {
      await uploadFullSessionRecording(candidateId, pendingBlob, pendingDuration);
      setPendingBlob(null);
      setPendingDuration(0);
      setSaved(true);
      toast.success("Interview saved! Transcript processed and answers recorded.");
      qc.invalidateQueries({ queryKey: ["candidate", candidateId] });
      qc.invalidateQueries({ queryKey: ["candidates"] });
    } catch (err: any) {
      toast.error("Upload failed: " + (err?.message ?? "Unknown error"));
    } finally {
      setUploading(false);
    }
  };

  /** Discard the pending recording */
  const handleDiscard = () => {
    setPendingBlob(null);
    setPendingDuration(0);
    toast.warning("Recording discarded.");
  };

  if (isLoading || !candidate) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading session…
      </div>
    );
  }

  const answered = candidate.answers.filter((a) => a.asked).length;
  const exportUrl = `${API_BASE_URL}/export.xlsx?candidateId=${candidate.id}`;

  return (
    <div className="space-y-8">
      <Button asChild variant="ghost" size="sm">
        <Link to="/">
          <ArrowLeft className="mr-1.5 h-3.5 w-3.5" /> Back to roster
        </Link>
      </Button>

      {/* Candidate profile header */}
      <section className="glass-panel gradient-hero space-y-4 p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{candidate.fullName}</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {candidate.branch} • Section {candidate.section} • ID {candidate.id}
            </p>
          </div>
          <Button asChild variant="secondary" size="sm">
            <a href={exportUrl} target="_blank" rel="noreferrer">
              <Download className="mr-1.5 h-3.5 w-3.5" /> Export Excel
            </a>
          </Button>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Stat label="CGPA" value={candidate.cgpa.toFixed(2)} />
          <Stat label="Attendance" value={`${candidate.attendance}%`} />
          <Stat label="AAC domain" value={candidate.aacDomain} />
          <Stat label="Domains" value={candidate.domains.join(", ") || "—"} />
        </div>
      </section>

      {/* Recording controls */}
      <section className="glass-panel space-y-5 p-6">
        <div className="flex flex-wrap items-center gap-5">
          {/* Status icon + timer */}
          <div className="flex items-center gap-3">
            <span
              className={`flex h-12 w-12 items-center justify-center rounded-2xl ${
                recorder.state === "recording"
                  ? "bg-destructive/20"
                  : saved
                    ? "bg-success/20"
                    : pendingBlob
                      ? "bg-warning/20"
                      : "bg-secondary"
              }`}
            >
              {recorder.state === "recording" ? (
                <Circle className="h-4 w-4 rec-pulse fill-destructive text-destructive" />
              ) : saved ? (
                <CheckCircle2 className="h-5 w-5 text-success" />
              ) : (
                <Mic className="h-5 w-5 text-primary" />
              )}
            </span>
            <div>
              <div className="font-mono text-2xl tabular-nums">
                {formatDuration(pendingBlob ? pendingDuration : recorder.elapsed)}
              </div>
              <div className="text-xs text-muted-foreground">
                {recorder.state === "recording"
                  ? "Recording full interview…"
                  : recorder.state === "paused"
                    ? "Paused"
                    : pendingBlob
                      ? "Recording ready to save"
                      : saved
                        ? "Interview saved & transcribed"
                        : "Ready to record"}
              </div>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex flex-wrap gap-2">
            {/* IDLE — no pending blob, not saved */}
            {recorder.state === "idle" && !pendingBlob && !saved && (
              <Button onClick={recorder.start} disabled={uploading}>
                <Mic className="mr-1.5 h-3.5 w-3.5" /> Start Recording
              </Button>
            )}

            {/* ACTIVE recording */}
            {(recorder.state === "recording" || recorder.state === "paused") && (
              <>
                <Button variant="secondary" onClick={recorder.togglePause}>
                  {recorder.state === "paused" ? (
                    <><Play className="mr-1.5 h-3.5 w-3.5" /> Resume</>
                  ) : (
                    <><Pause className="mr-1.5 h-3.5 w-3.5" /> Pause</>
                  )}
                </Button>
                <Button variant="destructive" onClick={handleStop}>
                  <Square className="mr-1.5 h-3.5 w-3.5" /> Stop Recording
                </Button>
              </>
            )}

            {/* STOPPED — pending blob, waiting for save */}
            {pendingBlob && !uploading && (
              <>
                <Button
                  onClick={handleSave}
                  className="border-success/50 bg-success/20 text-success hover:bg-success/30"
                >
                  <Save className="mr-1.5 h-3.5 w-3.5" /> Save &amp; End Interview
                </Button>
                <Button variant="ghost" size="sm" onClick={handleDiscard}>
                  Discard
                </Button>
              </>
            )}

            {/* Re-record if already saved */}
            {saved && (
              <Button
                variant="secondary"
                onClick={() => {
                  setSaved(false);
                  recorder.start();
                }}
              >
                <Mic className="mr-1.5 h-3.5 w-3.5" /> Record Again
              </Button>
            )}
          </div>

          {/* Upload spinner */}
          {uploading && (
            <span className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Uploading and transcribing — this may take a minute…
            </span>
          )}

          {recorder.error && (
            <p className="text-sm text-destructive">{recorder.error}</p>
          )}
        </div>

        {/* Progress bar */}
        <div>
          <div className="mb-1 flex justify-between text-xs text-muted-foreground">
            <span>Questions covered</span>
            <span>{answered}/12</span>
          </div>
          <Progress value={(answered / 12) * 100} />
        </div>
      </section>

      {/* Answer matrix */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold tracking-tight">Answer matrix</h2>
        {answered === 0 && !saved && (
          <p className="text-sm text-muted-foreground">
            Answers will appear here after you save the interview recording.
          </p>
        )}
        <Accordion type="multiple" className="space-y-3">
          {candidate.answers.map((a) => (
            <AnswerRow key={a.questionIndex} candidateId={candidate.id} answer={a} />
          ))}
        </Accordion>
      </section>
    </div>
  );
}
