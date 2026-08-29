import { useEffect, useRef, useState } from "react";
import { formatClock } from "@/lib/store";
import type { TakeStatus } from "@/lib/types";

type Props = {
  status: TakeStatus;
  onComplete: (payload: { duration: number; audioUrl?: string }) => void;
  size?: "sm" | "lg";
  label?: string;
};

export default function RecordButton({ status, onComplete, size = "sm", label }: Props) {
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startedRef = useRef(0);

  useEffect(() => {
    if (!recording) return;
    const id = setInterval(() => setElapsed((Date.now() - startedRef.current) / 1000), 250);
    return () => clearInterval(id);
  }, [recording]);

  const stop = () => {
    const duration = Math.round((Date.now() - startedRef.current) / 1000);
    setRecording(false);
    setElapsed(0);
    const rec = recorderRef.current;
    if (rec && rec.state !== "inactive") {
      rec.onstop = () => {
        rec.stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        onComplete({ duration, audioUrl: URL.createObjectURL(blob), audioBlob: blob } as any);
      };
      rec.stop();
    } else {
      onComplete({ duration });
    }
    recorderRef.current = null;
  };

  const start = async () => {
    setError(null);
    startedRef.current = Date.now();
    chunksRef.current = [];
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { noiseSuppression: true, echoCancellation: true, autoGainControl: true },
      });
      const rec = new MediaRecorder(stream, { audioBitsPerSecond: 128000 });
      rec.ondataavailable = (e) => e.data.size && chunksRef.current.push(e.data);
      rec.start(1000);
      recorderRef.current = rec;
    } catch {
      setError("No mic access — capturing a silent take");
    }
    setRecording(true);
  };

  const busy = status === "uploading" || status === "transcribing";
  const pad = size === "lg" ? "px-4 py-2.5 text-[12px]" : "px-3 py-1.5 text-[11px]";
  const base = `shrink-0 flex items-center gap-2 rounded-xl font-semibold transition-colors ${pad}`;

  if (busy) {
    return (
      <span className={`${base} bg-panel2 text-inkmuted`}>
        <span className="size-2 rounded-full bg-amber animate-ring" />
        {status === "uploading" ? "Uploading…" : "Transcribing with AI…"}
      </span>
    );
  }

  if (recording) {
    return (
      <button onClick={stop} className={`${base} bg-danger text-background animate-ring`}>
        <span className="size-2 rounded-full bg-background/90" />
        Stop · {formatClock(elapsed)}
      </button>
    );
  }

  if (status === "done") {
    return (
      <button
        onClick={start}
        className={`${base} bg-signal-soft text-signal hover:bg-signal hover:text-background`}
        title="Re-record this answer"
      >
        ✓ Saved
      </button>
    );
  }

  return (
    <button
      onClick={start}
      className={`${base} ring-1 ring-line text-ink hover:bg-panel2`}
      title={error ?? undefined}
    >
      <span className="size-2 rounded-full bg-danger/70" />
      {label ?? "Record"}
    </button>
  );
}
