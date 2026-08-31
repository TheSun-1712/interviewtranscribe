import { useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import {
  Download,
  FileSpreadsheet,
  Flag,
  Loader2,
  Plus,
  RefreshCcw,
  ShieldAlert,
  Upload,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import { useSocket } from "../hooks/useSocket";
import {
  createCandidate,
  fetchCandidates,
  flagCandidate,
  getExcelExportUrl,
  importCandidatesExcel,
  resetDatabase,
  type Candidate,
  type CandidateStatus,
} from "../services/api";

function StatusBadge({ status }: { status: CandidateStatus }) {
  if (status === "complete") {
    return (
      <Badge className="border border-success/40 bg-success/15 text-success">Complete</Badge>
    );
  }
  if (status === "in_progress") {
    return (
      <Badge className="border border-warning/40 bg-warning/15 text-warning">In progress</Badge>
    );
  }
  return <Badge variant="secondary">Not started</Badge>;
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border/50 bg-secondary/50 p-2.5">
      <span className="block text-[10px] uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      <span className="block truncate font-mono text-xs font-semibold text-foreground">
        {value}
      </span>
    </div>
  );
}

function CandidateCard({
  candidate,
  onFlag,
}: {
  candidate: Candidate;
  onFlag: (id: string) => void;
}) {
  const cta =
    candidate.status === "complete"
      ? "View summary"
      : candidate.status === "in_progress"
        ? "Resume session"
        : "Start session";

  const isLocked = !!(candidate.sessionState?.recordingLockDevice);
  const isTranscribing = candidate.sessionState?.isTranscribing;
  const isAnalyzing = candidate.sessionState?.isAnalyzing;

  return (
    <article
      className={`glass-panel flex flex-col gap-4 p-5 transition-shadow hover:glow-ring relative ${
        candidate.isFlagged ? "border border-orange-500/50 bg-orange-500/5" : ""
      }`}
    >
      {/* Flag indicator strip */}
      {candidate.isFlagged && (
        <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-orange-500 to-amber-400 rounded-t-xl" />
      )}

      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-2 flex-1 min-w-0">
          {/* Flag button — always clearly visible */}
          <button
            onClick={(e) => {
              e.preventDefault();
              onFlag(candidate.id);
            }}
            className={`mt-0.5 shrink-0 flex items-center justify-center h-8 w-8 rounded-lg border transition-all ${
              candidate.isFlagged
                ? "border-orange-500/60 bg-orange-500/15 text-orange-400 hover:bg-orange-500/25"
                : "border-border bg-secondary/60 text-muted-foreground hover:border-orange-400/60 hover:bg-orange-500/10 hover:text-orange-400"
            }`}
            title={candidate.isFlagged ? "Remove flag" : "Flag this candidate"}
            aria-label={candidate.isFlagged ? "Remove flag" : "Flag this candidate"}
          >
            <Flag
              className={`h-4 w-4 ${candidate.isFlagged ? "fill-orange-400" : ""}`}
            />
          </button>
          <div className="min-w-0">
            <h3 className="text-lg font-semibold tracking-tight">{candidate.fullName}</h3>
            <p className="text-xs text-muted-foreground">
              {candidate.branch} • Section {candidate.section} • ID {candidate.id}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {isLocked && (
            <Badge className="border border-destructive/40 bg-destructive/10 text-destructive text-[10px] py-0">
              🎙 Recording
            </Badge>
          )}
          {isTranscribing && (
            <Badge className="border border-warning/40 bg-warning/10 text-warning text-[10px] py-0">
              ⟳ Transcribing
            </Badge>
          )}
          {isAnalyzing && (
            <Badge className="border border-primary/40 bg-primary/10 text-primary text-[10px] py-0">
              ⟳ Analyzing
            </Badge>
          )}
          <StatusBadge status={candidate.status} />
        </div>
      </header>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Metric label="AAC domain" value={candidate.aacDomain} />
        <Metric label="Domains" value={candidate.domains.join(", ") || "—"} />
        <Metric label="CGPA" value={candidate.cgpa.toFixed(2)} />
        <Metric label="Attendance" value={`${candidate.attendance}%`} />
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span>
          {candidate.sessionState?.clips?.length ?? 0} clip(s) recorded
        </span>
        <span>{candidate.answeredCount}/12 questions answered</span>
        {candidate.sessionState?.transcriptionStatus === "done" && (
          <span className="text-success">✓ Transcribed</span>
        )}
        {candidate.sessionState?.analysisStatus === "done" && (
          <span className="text-primary">✓ LLM processed</span>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        <Button asChild size="sm">
          <Link to="/session/$id" params={{ id: candidate.id }}>
            {cta}
          </Link>
        </Button>
        <Button asChild size="sm" variant="outline">
          <a href={getExcelExportUrl(candidate.id)} target="_blank" rel="noreferrer">
            <Download className="mr-1.5 h-3.5 w-3.5" /> Export Excel
          </a>
        </Button>
      </div>
    </article>
  );
}

export function CandidateList() {
  const qc = useQueryClient();
  const [addOpen, setAddOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [resetPassword, setResetPassword] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const { data: candidates = [], isLoading } = useQuery({
    queryKey: ["candidates"],
    queryFn: fetchCandidates,
    refetchInterval: 4000,
  });

  // Socket.IO: real-time updates for candidate roster (flags, status, analysis)
  useSocket({
    joinRoster: true,
    on: {
      candidate_updated: () => {
        qc.invalidateQueries({ queryKey: ["candidates"] });
      },
    },
  });

  const groups = useMemo(
    () => ({
      remaining: candidates.filter((c) => c.status !== "complete"),
      completed: candidates.filter((c) => c.status === "complete"),
      flagged: candidates.filter((c) => c.isFlagged),
      all: candidates,
    }),
    [candidates],
  );

  const flagMutation = useMutation({
    mutationFn: (id: string) => flagCandidate(id),
    onSuccess: (updated) => {
      toast.success(
        updated.isFlagged
          ? `${updated.fullName} flagged`
          : `${updated.fullName} unflagged`
      );
      qc.invalidateQueries({ queryKey: ["candidates"] });
    },
    onError: () => toast.error("Could not update flag"),
  });

  const importMutation = useMutation({
    mutationFn: ({ clearExisting }: { clearExisting: boolean }) => {
      if (!file) throw new Error("No file selected");
      return importCandidatesExcel(file, clearExisting);
    },
    onSuccess: (res) => {
      toast.success(`Imported ${res.imported} candidate(s) from Excel`);
      setImportOpen(false);
      setFile(null);
      if (fileRef.current) fileRef.current.value = "";
      qc.invalidateQueries({ queryKey: ["candidates"] });
    },
    onError: () => toast.error("Could not import Excel file"),
  });

  const resetMutation = useMutation({
    mutationFn: () => resetDatabase(resetPassword),
    onSuccess: () => {
      toast.success("Database cleared");
      setResetOpen(false);
      setResetPassword("");
      qc.invalidateQueries({ queryKey: ["candidates"] });
    },
    onError: () => toast.error("Invalid admin password"),
  });

  const addMutation = useMutation({
    mutationFn: (form: HTMLFormElement) => {
      const fd = new FormData(form);
      return createCandidate({
        fullName: String(fd.get("fullName") ?? ""),
        branch: String(fd.get("branch") ?? ""),
        section: String(fd.get("section") ?? ""),
        domains: String(fd.get("domains") ?? "")
          .split(",")
          .map((d) => d.trim())
          .filter(Boolean),
        aacDomain: String(fd.get("aacDomain") ?? ""),
        cgpa: Number(fd.get("cgpa") ?? 0),
        attendance: Number(fd.get("attendance") ?? 0),
      });
    },
    onSuccess: (c) => {
      toast.success(`${c.fullName} added to the roster`);
      setAddOpen(false);
      qc.invalidateQueries({ queryKey: ["candidates"] });
    },
    onError: () => toast.error("Could not create candidate"),
  });

  const tabKeys = ["remaining", "completed", "flagged", "all"] as const;

  return (
    <div className="space-y-8">
      <section className="glass-panel gradient-hero flex flex-wrap items-end justify-between gap-4 p-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Candidate roster</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Live-synced every 4 seconds across all interviewer devices.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" size="sm" onClick={() => setAddOpen(true)}>
            <Plus className="mr-1.5 h-3.5 w-3.5" /> Add candidate
          </Button>
          <Button variant="secondary" size="sm" onClick={() => setImportOpen(true)}>
            <Upload className="mr-1.5 h-3.5 w-3.5" /> Import Excel
          </Button>
          <Button asChild variant="secondary" size="sm">
            <a href={getExcelExportUrl()} target="_blank" rel="noreferrer">
              <FileSpreadsheet className="mr-1.5 h-3.5 w-3.5" /> Master export
            </a>
          </Button>
          <Button variant="destructive" size="sm" onClick={() => setResetOpen(true)}>
            <ShieldAlert className="mr-1.5 h-3.5 w-3.5" /> Reset database
          </Button>
        </div>
      </section>

      <Tabs defaultValue="remaining">
        <TabsList>
          <TabsTrigger value="remaining">Remaining ({groups.remaining.length})</TabsTrigger>
          <TabsTrigger value="completed">Completed ({groups.completed.length})</TabsTrigger>
          <TabsTrigger value="flagged" className="relative">
            <Flag className="mr-1 h-3 w-3 text-orange-400" />
            Flagged ({groups.flagged.length})
            {groups.flagged.length > 0 && (
              <span className="ml-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-orange-500 text-[10px] font-bold text-white">
                {groups.flagged.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="all">All ({groups.all.length})</TabsTrigger>
        </TabsList>

        {tabKeys.map((key) => (
          <TabsContent key={key} value={key} className="mt-6">
            {/* Flagged tab header */}
            {key === "flagged" && groups.flagged.length > 0 && (
              <div className="mb-4 flex items-center gap-2 rounded-xl border border-orange-500/30 bg-orange-500/5 px-4 py-2.5">
                <Flag className="h-4 w-4 text-orange-400 fill-orange-400" />
                <p className="text-sm text-orange-300">
                  <strong>{groups.flagged.length}</strong> candidate(s) flagged for follow-up
                </p>
              </div>
            )}
            {isLoading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading roster…
              </div>
            ) : groups[key].length === 0 ? (
              <div className="glass-panel p-10 text-center text-sm text-muted-foreground">
                {key === "flagged"
                  ? "No flagged candidates yet. Click the 🚩 icon on a candidate card to flag them."
                  : "No candidates in this list yet."}
              </div>
            ) : (
              <div className="grid gap-4 lg:grid-cols-2">
                {groups[key].map((c) => (
                  <CandidateCard
                    key={c.id}
                    candidate={c}
                    onFlag={(id) => flagMutation.mutate(id)}
                  />
                ))}
              </div>
            )}
          </TabsContent>
        ))}
      </Tabs>

      {/* Import modal */}
      <Dialog open={importOpen} onOpenChange={setImportOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Bulk import candidates</DialogTitle>
            <DialogDescription>
              Upload an .xlsx, .xls or .csv roster, then choose how to merge it.
            </DialogDescription>
          </DialogHeader>
          <Input
            ref={fileRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
          {file ? <p className="text-xs text-muted-foreground">Selected: {file.name}</p> : null}
          <DialogFooter className="gap-2 sm:justify-start">
            <Button
              variant="destructive"
              disabled={!file || importMutation.isPending}
              onClick={() => importMutation.mutate({ clearExisting: true })}
            >
              Clear old candidates &amp; recordings
            </Button>
            <Button
              disabled={!file || importMutation.isPending}
              onClick={() => importMutation.mutate({ clearExisting: false })}
            >
              Keep existing &amp; append
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reset modal */}
      <Dialog open={resetOpen} onOpenChange={setResetOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reset the database</DialogTitle>
            <DialogDescription>
              This permanently deletes all candidates, recordings and evaluations.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="admin-password">Admin password</Label>
            <Input
              id="admin-password"
              type="password"
              value={resetPassword}
              onChange={(e) => setResetPassword(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button
              variant="destructive"
              disabled={!resetPassword || resetMutation.isPending}
              onClick={() => resetMutation.mutate()}
            >
              <RefreshCcw className="mr-1.5 h-3.5 w-3.5" /> Confirm reset
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add candidate modal */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add a candidate</DialogTitle>
            <DialogDescription>All six roster parameters are captured here.</DialogDescription>
          </DialogHeader>
          <form
            className="grid gap-4 sm:grid-cols-2"
            onSubmit={(e) => {
              e.preventDefault();
              addMutation.mutate(e.currentTarget);
            }}
          >
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="fullName">Full name</Label>
              <Input id="fullName" name="fullName" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="branch">Branch</Label>
              <Input id="branch" name="branch" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="section">Section</Label>
              <Input id="section" name="section" required />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="domains">Domains applied for (comma separated)</Label>
              <Input id="domains" name="domains" placeholder="Technical, Design" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="aacDomain">AAC domain</Label>
              <Input id="aacDomain" name="aacDomain" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cgpa">CGPA</Label>
              <Input id="cgpa" name="cgpa" type="number" step="0.01" min="0" max="10" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="attendance">Attendance (%)</Label>
              <Input id="attendance" name="attendance" type="number" min="0" max="100" />
            </div>
            <div className="sm:col-span-2">
              <Button type="submit" className="w-full" disabled={addMutation.isPending}>
                Add to roster
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
