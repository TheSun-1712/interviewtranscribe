import { useEffect, useState, useRef, useCallback } from "react";
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
  Pencil,
  Play,
  Save,
  Square,
  Trash2,
  Brain,
  FileText,
  Lock,
  X,
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
import { Label } from "./ui/label";
import { Progress } from "./ui/progress";
import { Textarea } from "./ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "./ui/dialog";
import { formatDuration, useAudioRecorder } from "../hooks/useAudioRecorder";
import { useSocket } from "../hooks/useSocket";
import {
  fetchCandidate,
  fetchClips,
  saveFeedback,
  uploadAudioClip,
  acquireRecordingLock,
  releaseRecordingLock,
  triggerTranscription,
  triggerLLMAnalysis,
  deleteClip,
  createSession,
  updateCandidate,
  getDeviceId,
  API_BASE_URL,
  type QuestionAnswer,
  type AudioClip,
} from "../services/api";

const DEVICE_ID = getDeviceId();

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
  const isFirstRender = useRef(true);
  // isDirty: true while the user has unsaved edits — prevents server sync from
  // overwriting active input and prevents the save effect from firing on resets.
  const isDirty = useRef(false);

  const save = useMutation({
    mutationFn: (payload: { score: number | null; comment: string }) =>
      saveFeedback(candidateId, answer.questionIndex, payload),
    onSuccess: () => {
      // Clear dirty flag so the next server refetch can safely sync
      isDirty.current = false;
      qc.invalidateQueries({ queryKey: ["candidate", candidateId] });
      qc.invalidateQueries({ queryKey: ["candidates"] });
    },
    onError: () => toast.error("Could not save evaluation feedback"),
  });

  // Server sync: only overwrite local state when the user is NOT editing.
  // This prevents the query invalidation after saving Q3 from resetting all
  // other rows' inputs simultaneously.
  useEffect(() => {
    if (!isDirty.current) {
      setScore(answer.score?.toString() ?? "");
      setComment(answer.comment ?? "");
    }
  }, [answer.score, answer.comment]);

  // Auto-save: fires after 700 ms of no further changes.
  // The isDirty guard ensures this effect does NOT fire when the server sync
  // above resets the values (which would cause phantom saves on every row).
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    // Skip if this state change was a server-driven reset, not user input
    if (!isDirty.current) return;

    const numScore = score === "" ? null : Number(score);
    const handle = setTimeout(() => {
      save.mutate({ score: numScore, comment });
    }, 700);
    return () => clearTimeout(handle);
  }, [score, comment]);

  // Mark the row as dirty before updating state so the guards above activate
  const handleScoreChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      isDirty.current = true;
      setScore(e.target.value);
    },
    []
  );

  const handleCommentChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      isDirty.current = true;
      setComment(e.target.value);
    },
    []
  );

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
              onChange={handleScoreChange}
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
              onChange={handleCommentChange}
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

/** Display a single saved audio clip */
function ClipCard({
  clip,
  index,
  onDelete,
}: {
  clip: AudioClip;
  index: number;
  onDelete: (id: string) => void;
}) {
  const statusColor =
    clip.status === "done"
      ? "text-success"
      : clip.status === "transcribing"
        ? "text-warning animate-pulse"
        : clip.status === "error"
          ? "text-destructive"
          : "text-muted-foreground";

  const statusLabel =
    clip.status === "done"
      ? "Transcribed"
      : clip.status === "transcribing"
        ? "Transcribing…"
        : clip.status === "error"
          ? "Error"
          : "Pending";

  return (
    <div className="glass-panel flex items-center gap-3 p-3 border border-border/50">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-sm font-bold text-primary">
        {index + 1}
      </div>
      <div className="flex-1 min-w-0">
        <audio
          src={clip.audioUrl}
          controls
          className="h-8 w-full max-w-xs"
          preload="none"
        />
        <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
          {clip.durationSec != null && (
            <span>{formatDuration(clip.durationSec)}</span>
          )}
          <span className={statusColor}>{statusLabel}</span>
        </div>
        {clip.transcript && clip.status === "done" && (
          <p className="mt-1 text-xs text-foreground/70 line-clamp-2 italic">
            "{clip.transcript.slice(0, 120)}{clip.transcript.length > 120 ? "…" : ""}"
          </p>
        )}
      </div>
      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7 text-destructive/70 hover:text-destructive"
        onClick={() => onDelete(clip.id)}
      >
        <Trash2 className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}

/** Edit candidate info dialog */
function EditCandidateDialog({
  open,
  onOpenChange,
  candidate,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  candidate: {
    id: string;
    fullName: string;
    branch: string;
    section: string;
    domains: string[];
    aacDomain: string;
    cgpa: number;
    attendance: number;
  };
  onSaved: () => void;
}) {
  const [form, setForm] = useState({
    fullName: candidate.fullName,
    branch: candidate.branch,
    section: candidate.section,
    domains: candidate.domains.join(", "),
    aacDomain: candidate.aacDomain,
    cgpa: String(candidate.cgpa),
    attendance: String(candidate.attendance),
  });
  const [saving, setSaving] = useState(false);

  // Reset form when dialog opens
  useEffect(() => {
    if (open) {
      setForm({
        fullName: candidate.fullName,
        branch: candidate.branch,
        section: candidate.section,
        domains: candidate.domains.join(", "),
        aacDomain: candidate.aacDomain,
        cgpa: String(candidate.cgpa),
        attendance: String(candidate.attendance),
      });
    }
  }, [open]);

  const set = (field: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((prev) => ({ ...prev, [field]: e.target.value }));

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateCandidate(candidate.id, {
        fullName: form.fullName,
        branch: form.branch,
        section: form.section,
        domains: form.domains.split(",").map((d) => d.trim()).filter(Boolean),
        aacDomain: form.aacDomain,
        cgpa: parseFloat(form.cgpa) || 0,
        attendance: parseFloat(form.attendance) || 0,
      });
      toast.success("Candidate info updated");
      onSaved();
      onOpenChange(false);
    } catch {
      toast.error("Could not update candidate info");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit candidate info</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="edit-fullName">Full name</Label>
            <Input id="edit-fullName" value={form.fullName} onChange={set("fullName")} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="edit-branch">Branch</Label>
            <Input id="edit-branch" value={form.branch} onChange={set("branch")} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="edit-section">Section</Label>
            <Input id="edit-section" value={form.section} onChange={set("section")} />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="edit-domains">Domains applied for (comma separated)</Label>
            <Input
              id="edit-domains"
              value={form.domains}
              onChange={set("domains")}
              placeholder="Technical, Design"
            />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="edit-aacDomain">AAC domain</Label>
            <Input id="edit-aacDomain" value={form.aacDomain} onChange={set("aacDomain")} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="edit-cgpa">CGPA</Label>
            <Input id="edit-cgpa" type="number" step="0.01" min="0" max="10" value={form.cgpa} onChange={set("cgpa")} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="edit-attendance">Attendance (%)</Label>
            <Input id="edit-attendance" type="number" min="0" max="100" value={form.attendance} onChange={set("attendance")} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? <><Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> Saving…</> : <><Save className="mr-1.5 h-3.5 w-3.5" /> Save changes</>}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function SessionView({ candidateId }: { candidateId: string }) {
  const qc = useQueryClient();
  const recorder = useAudioRecorder();

  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sessionInitialized, setSessionInitialized] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [lockStatus, setLockStatus] = useState<"free" | "mine" | "other">("free");
  const [editOpen, setEditOpen] = useState(false);

  // Local clip list (augmented by socket events)
  const [localClips, setLocalClips] = useState<AudioClip[]>([]);

  const { data: candidate, isLoading } = useQuery({
    queryKey: ["candidate", candidateId],
    queryFn: () => fetchCandidate(candidateId),
    refetchInterval: 5000,
  });

  // Initialize session and load clips from backend
  useEffect(() => {
    if (!candidate) return;

    (async () => {
      let sid = candidate.sessionState?.id ?? null;

      if (!sid) {
        try {
          const sess = await createSession(candidateId);
          sid = sess.id;
        } catch (e) {
          console.error("Could not create session:", e);
          return;
        }
      }

      setSessionId(sid);

      // Load existing clips
      try {
        const clips = await fetchClips(sid);
        setLocalClips(clips);
      } catch (e) {}

      // Set initial lock state
      const lock = candidate.sessionState?.recordingLockDevice;
      if (!lock) {
        setLockStatus("free");
      } else if (lock === DEVICE_ID) {
        setLockStatus("mine");
      } else {
        setLockStatus("other");
      }

      setSessionInitialized(true);
    })();
  }, [candidate?.id]);

  // Socket.IO real-time sync
  useSocket({
    sessionId: sessionId ?? undefined,
    on: {
      recording_started: ({ deviceId }) => {
        if (deviceId !== DEVICE_ID) {
          setLockStatus("other");
          toast.warning("Another device started recording for this candidate.");
        }
      },
      lock_released: () => {
        if (lockStatus !== "mine") {
          setLockStatus("free");
        }
      },
      clip_saved: ({ clip }) => {
        setLocalClips((prev) => {
          if (prev.find((c) => c.id === clip.id)) return prev;
          return [...prev, clip];
        });
      },
      clip_deleted: ({ clipId }) => {
        setLocalClips((prev) => prev.filter((c) => c.id !== clipId));
      },
      clip_transcribing: ({ clipId }) => {
        setLocalClips((prev) =>
          prev.map((c) => (c.id === clipId ? { ...c, status: "transcribing" } : c))
        );
      },
      clip_transcribed: ({ clipId, transcript }) => {
        setLocalClips((prev) =>
          prev.map((c) =>
            c.id === clipId ? { ...c, status: "done", transcript } : c
          )
        );
      },
      transcription_done: () => {
        qc.invalidateQueries({ queryKey: ["candidate", candidateId] });
        toast.success("Transcription complete! You can now process with LLM.");
      },
      transcription_error: ({ error }) => {
        toast.error("Transcription failed: " + error);
        qc.invalidateQueries({ queryKey: ["candidate", candidateId] });
      },
      analysis_done: () => {
        qc.invalidateQueries({ queryKey: ["candidate", candidateId] });
        qc.invalidateQueries({ queryKey: ["candidates"] });
        toast.success("LLM analysis complete! Interview answers are ready.");
      },
      analysis_error: ({ error }) => {
        toast.error("LLM analysis failed: " + error);
        qc.invalidateQueries({ queryKey: ["candidate", candidateId] });
      },
    },
  });

  // Start recording — acquire lock first
  const handleStart = async () => {
    if (!sessionId || !sessionInitialized) {
      toast.error("Session not initialized. Please wait a moment.");
      return;
    }
    try {
      const result = await acquireRecordingLock(sessionId, DEVICE_ID);
      if (!result.acquired) {
        toast.error("Another device is currently recording for this candidate.");
        return;
      }
    } catch (err: any) {
      toast.error("Could not acquire recording lock: " + (err?.message ?? "Unknown error"));
      return;
    }
    setLockStatus("mine");
    await recorder.start();
  };

  // Stop recording — upload clip immediately to disk
  const handleStop = async () => {
    if (!sessionId) return;
    const result = await recorder.stop();
    if (!result) {
      await releaseRecordingLock(sessionId);
      setLockStatus("free");
      return;
    }

    setUploading(true);
    try {
      const clip = await uploadAudioClip(sessionId, result.blob, result.durationSec, DEVICE_ID);
      setLocalClips((prev) => {
        if (prev.find((c) => c.id === clip.id)) return prev;
        return [...prev, clip];
      });
      setLockStatus("free");
      toast.success("Audio clip saved to disk.");
    } catch (err: any) {
      toast.error("Failed to save clip: " + (err?.message ?? "Unknown error"));
      try { await releaseRecordingLock(sessionId); } catch (e) {}
      setLockStatus("free");
    } finally {
      setUploading(false);
    }
  };

  // Delete a clip
  const handleDeleteClip = async (clipId: string) => {
    try {
      await deleteClip(clipId);
      setLocalClips((prev) => prev.filter((c) => c.id !== clipId));
      toast.success("Clip deleted.");
    } catch (err: any) {
      toast.error("Failed to delete clip.");
    }
  };

  // Trigger transcription (always re-triggerable)
  const handleTranscribe = async () => {
    if (!sessionId) return;
    try {
      await triggerTranscription(sessionId);
      qc.invalidateQueries({ queryKey: ["candidate", candidateId] });
      toast.info("Transcription started… this may take a minute.");
    } catch (err: any) {
      toast.error("Could not start transcription: " + (err?.message ?? "Unknown error"));
    }
  };

  // Trigger LLM analysis (always re-triggerable)
  const handleAnalyze = async () => {
    if (!sessionId) return;
    try {
      await triggerLLMAnalysis(sessionId);
      qc.invalidateQueries({ queryKey: ["candidate", candidateId] });
      toast.info("LLM analysis started… answers will appear shortly.");
    } catch (err: any) {
      toast.error("Could not start analysis: " + (err?.message ?? "Unknown error"));
    }
  };

  if (isLoading || !candidate) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading session…
      </div>
    );
  }

  const sessionState = candidate.sessionState;
  const isTranscribing = sessionState?.isTranscribing ?? false;
  const isAnalyzing = sessionState?.isAnalyzing ?? false;
  const transcriptionDone = sessionState?.transcriptionStatus === "done";
  const analysisDone = sessionState?.analysisStatus === "done";

  const clips = localClips;
  const hasClips = clips.length > 0;

  const answered = candidate.answers.filter((a) => a.asked).length;
  const exportUrl = `${API_BASE_URL}/export.xlsx?candidateId=${candidate.id}`;

  const isRecording = recorder.state === "recording" || recorder.state === "paused";
  const canRecord = !!sessionId && sessionInitialized && lockStatus !== "other" && !uploading && !isTranscribing && !isAnalyzing;

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
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{candidate.fullName}</h1>
              <button
                onClick={() => setEditOpen(true)}
                className="rounded-lg p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
                title="Edit candidate info"
              >
                <Pencil className="h-4 w-4" />
              </button>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              {candidate.branch} • Section {candidate.section} • ID {candidate.id}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm" onClick={() => setEditOpen(true)}>
              <Pencil className="mr-1.5 h-3.5 w-3.5" /> Edit info
            </Button>
            <Button asChild variant="secondary" size="sm">
              <a href={exportUrl} target="_blank" rel="noreferrer">
                <Download className="mr-1.5 h-3.5 w-3.5" /> Export Excel
              </a>
            </Button>
          </div>
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
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-lg font-semibold tracking-tight">Recording</h2>
          {lockStatus === "other" && (
            <span className="flex items-center gap-1.5 text-xs text-warning bg-warning/10 border border-warning/30 rounded-lg px-2.5 py-1">
              <Lock className="h-3 w-3" /> Recording locked by another device
            </span>
          )}
          {lockStatus === "mine" && isRecording && (
            <span className="flex items-center gap-1.5 text-xs text-destructive bg-destructive/10 border border-destructive/30 rounded-lg px-2.5 py-1">
              <Circle className="h-2.5 w-2.5 rec-pulse fill-destructive text-destructive" /> Recording on this device
            </span>
          )}
        </div>

        {/* Timer + Buttons */}
        <div className="flex flex-wrap items-center gap-5">
          <div className="flex items-center gap-3">
            <span
              className={`flex h-12 w-12 items-center justify-center rounded-2xl ${
                recorder.state === "recording"
                  ? "bg-destructive/20"
                  : analysisDone
                    ? "bg-success/20"
                    : hasClips
                      ? "bg-primary/20"
                      : "bg-secondary"
              }`}
            >
              {recorder.state === "recording" ? (
                <Circle className="h-4 w-4 rec-pulse fill-destructive text-destructive" />
              ) : analysisDone ? (
                <CheckCircle2 className="h-5 w-5 text-success" />
              ) : hasClips ? (
                <FileText className="h-5 w-5 text-primary" />
              ) : (
                <Mic className="h-5 w-5 text-primary" />
              )}
            </span>
            <div>
              <div className="font-mono text-2xl tabular-nums">
                {formatDuration(recorder.elapsed)}
              </div>
              <div className="text-xs text-muted-foreground">
                {recorder.state === "recording"
                  ? "Recording…"
                  : recorder.state === "paused"
                    ? "Paused"
                    : uploading
                      ? "Saving clip to disk…"
                      : !sessionInitialized
                        ? "Initializing session…"
                        : isTranscribing
                          ? "Transcribing…"
                          : isAnalyzing
                            ? "Processing with LLM…"
                            : analysisDone
                              ? "Analysis complete"
                              : hasClips
                                ? `${clips.length} clip(s) saved`
                                : "Ready to record"}
              </div>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex flex-wrap gap-2">
            {/* Session still initializing */}
            {!sessionInitialized && !isRecording && (
              <span className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Initializing session…
              </span>
            )}
            {/* IDLE — show Start Recording */}
            {recorder.state === "idle" && !uploading && canRecord && (
              <Button onClick={handleStart}>
                <Mic className="mr-1.5 h-3.5 w-3.5" />
                {hasClips ? "Record Another Clip" : "Start Recording"}
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
                  <Square className="mr-1.5 h-3.5 w-3.5" /> Stop & Save Clip
                </Button>
              </>
            )}

            {/* Uploading */}
            {uploading && (
              <span className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Saving clip…
              </span>
            )}
          </div>

          {recorder.error && (
            <p className="text-sm text-destructive">{recorder.error}</p>
          )}
        </div>

        {/* Saved clips list */}
        {hasClips && (
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Saved Audio Clips
            </p>
            <div className="space-y-2">
              {clips.map((clip, i) => (
                <ClipCard
                  key={clip.id}
                  clip={clip}
                  index={i}
                  onDelete={handleDeleteClip}
                />
              ))}
            </div>
          </div>
        )}

        {/* Transcribe + LLM buttons — always visible when clips exist, always re-triggerable */}
        {hasClips && (
          <div className="flex flex-wrap items-center gap-3 border-t border-border/40 pt-4">
            <Button
              onClick={handleTranscribe}
              disabled={isTranscribing || isAnalyzing}
              variant={transcriptionDone ? "secondary" : "default"}
            >
              {isTranscribing ? (
                <><Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> Transcribing…</>
              ) : transcriptionDone ? (
                <><CheckCircle2 className="mr-1.5 h-3.5 w-3.5 text-success" /> Transcribed (Re-run)</>
              ) : (
                <><FileText className="mr-1.5 h-3.5 w-3.5" /> Transcribe Audio</>
              )}
            </Button>

            {/* Process with LLM — always shown when clips exist */}
            <Button
              onClick={handleAnalyze}
              disabled={!transcriptionDone || isAnalyzing || isTranscribing}
              className={
                analysisDone
                  ? "border-success/50 bg-success/20 text-success hover:bg-success/30"
                  : "border-primary/50 bg-primary/10 text-primary hover:bg-primary/20"
              }
              variant="outline"
            >
              {isAnalyzing ? (
                <><Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> Analyzing…</>
              ) : analysisDone ? (
                <><CheckCircle2 className="mr-1.5 h-3.5 w-3.5" /> Processed (Re-run)</>
              ) : (
                <><Brain className="mr-1.5 h-3.5 w-3.5" /> Process with LLM</>
              )}
            </Button>

            {!transcriptionDone && !isTranscribing && (
              <p className="text-xs text-muted-foreground">
                Transcribe audio first to enable LLM processing.
              </p>
            )}
            {transcriptionDone && !analysisDone && !isAnalyzing && (
              <p className="text-xs text-muted-foreground">
                Transcription done. Click "Process with LLM" to generate answer summaries.
              </p>
            )}
          </div>
        )}
      </section>

      {/* Progress bar — always shown if any answers exist */}
      {answered > 0 && (
        <section className="glass-panel px-6 py-4">
          <div className="mb-1 flex justify-between text-xs text-muted-foreground">
            <span>Questions covered</span>
            <span>{answered}/12</span>
          </div>
          <Progress value={(answered / 12) * 100} />
        </section>
      )}

      {/* Answer matrix — ALWAYS VISIBLE */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold tracking-tight">Answer matrix</h2>
          {analysisDone && (
            <Badge className="border border-success/40 bg-success/15 text-success">
              <CheckCircle2 className="mr-1 h-3 w-3" /> LLM processed
            </Badge>
          )}
        </div>

        {!analysisDone && (
          <div className="glass-panel px-5 py-3 border border-border/40 rounded-xl text-sm text-muted-foreground flex flex-wrap items-center gap-2">
            {!hasClips && <span>📼 Record interview audio above to get started.</span>}
            {hasClips && !transcriptionDone && <span>📝 Click <strong>Transcribe Audio</strong> to process clips.</span>}
            {transcriptionDone && !analysisDone && <span>🧠 Click <strong>Process with LLM</strong> to populate answers.</span>}
            <span className="text-[11px]">You can still add scores &amp; comments below at any time.</span>
          </div>
        )}

        <Accordion type="multiple" className="space-y-3">
          {candidate.answers.map((a) => (
            <AnswerRow key={a.questionIndex} candidateId={candidate.id} answer={a} />
          ))}
        </Accordion>
      </section>

      {/* Edit candidate dialog */}
      <EditCandidateDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        candidate={candidate}
        onSaved={() => {
          qc.invalidateQueries({ queryKey: ["candidate", candidateId] });
          qc.invalidateQueries({ queryKey: ["candidates"] });
        }}
      />
    </div>
  );
}
