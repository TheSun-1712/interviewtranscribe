import { useCallback, useEffect, useRef, useState } from "react";

export type RecorderState = "idle" | "recording" | "paused";

const MIME = "audio/webm;codecs=opus";

export function useAudioRecorder() {
  const [state, setState] = useState<RecorderState>("idle");
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const clearTimer = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
  };

  useEffect(() => () => {
    clearTimer();
    streamRef.current?.getTracks().forEach((t) => t.stop());
  }, []);

  const start = useCallback(async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const supported = typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(MIME);
      const recorder = new MediaRecorder(stream, supported ? { mimeType: MIME } : undefined);
      chunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.start(1000);
      recorderRef.current = recorder;
      setElapsed(0);
      setState("recording");
      timerRef.current = setInterval(() => setElapsed((s) => s + 1), 1000);
    } catch {
      setError("Microphone access was blocked. Enable it in the browser and try again.");
    }
  }, []);

  const togglePause = useCallback(() => {
    const rec = recorderRef.current;
    if (!rec) return;
    if (rec.state === "recording") {
      rec.pause();
      clearTimer();
      setState("paused");
    } else if (rec.state === "paused") {
      rec.resume();
      timerRef.current = setInterval(() => setElapsed((s) => s + 1), 1000);
      setState("recording");
    }
  }, []);

  const stop = useCallback(
    () =>
      new Promise<{ blob: Blob; durationSec: number } | null>((resolve) => {
        const rec = recorderRef.current;
        if (!rec) return resolve(null);
        const duration = elapsed;
        rec.onstop = () => {
          const blob = new Blob(chunksRef.current, { type: MIME });
          streamRef.current?.getTracks().forEach((t) => t.stop());
          streamRef.current = null;
          recorderRef.current = null;
          clearTimer();
          setState("idle");
          resolve({ blob, durationSec: duration });
        };
        rec.stop();
      }),
    [elapsed],
  );

  return { state, elapsed, error, start, stop, togglePause };
}

export const formatDuration = (totalSeconds: number) => {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${pad(h)}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
};
