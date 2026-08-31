import { useCallback, useEffect, useRef, useState } from "react";

export type RecorderState = "idle" | "recording" | "paused";

const CANDIDATE_MIME_TYPES = [
  "audio/webm;codecs=opus",
  "audio/webm",
  "audio/mp4",
  "audio/aac",
  "audio/ogg;codecs=opus",
  "audio/wav",
];

function getSupportedMimeType(): string {
  if (typeof MediaRecorder === "undefined") return "";
  for (const type of CANDIDATE_MIME_TYPES) {
    try {
      if (MediaRecorder.isTypeSupported(type)) {
        return type;
      }
    } catch {
      // Continue checking next candidate
    }
  }
  return "";
}

/** Check if the current context is secure (HTTPS or localhost) */
export function isSecureContextOrLocal(): boolean {
  if (typeof window === "undefined") return true;
  if (window.isSecureContext) return true;
  const host = window.location.hostname;
  return host === "localhost" || host === "127.0.0.1" || host === "[::1]";
}

/** Legacy getUserMedia resolver for older mobile/webkit webviews */
function getMediaStream(constraints: MediaStreamConstraints): Promise<MediaStream> {
  if (typeof navigator === "undefined") {
    return Promise.reject(new Error("Navigator is not available"));
  }

  if (navigator.mediaDevices && typeof navigator.mediaDevices.getUserMedia === "function") {
    return navigator.mediaDevices.getUserMedia(constraints);
  }

  const legacyGetUserMedia =
    (navigator as any).getUserMedia ||
    (navigator as any).webkitGetUserMedia ||
    (navigator as any).mozGetUserMedia ||
    (navigator as any).msGetUserMedia;

  if (legacyGetUserMedia) {
    return new Promise<MediaStream>((resolve, reject) => {
      legacyGetUserMedia.call(navigator, constraints, resolve, reject);
    });
  }

  return Promise.reject(
    new Error(
      isSecureContextOrLocal()
        ? "Microphone access is not supported by your browser."
        : "Microphone access requires HTTPS on mobile devices. Please access via HTTPS or localhost."
    )
  );
}

export function useAudioRecorder() {
  const [state, setState] = useState<RecorderState>("idle");
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const mimeTypeRef = useRef<string>("audio/webm");

  const clearTimer = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
  };

  const stopActiveStream = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch {}
      });
      streamRef.current = null;
    }
  };

  useEffect(() => () => {
    clearTimer();
    stopActiveStream();
  }, []);

  const start = useCallback(async (): Promise<boolean> => {
    setError(null);
    stopActiveStream();

    if (!isSecureContextOrLocal()) {
      setError(
        "Microphone access requires a secure (HTTPS) connection on mobile devices. Please access the web app using HTTPS (e.g. https://192.168.x.x:5173)."
      );
      return false;
    }

    try {
      const stream = await getMediaStream({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      streamRef.current = stream;

      const chosenMime = getSupportedMimeType();
      mimeTypeRef.current = chosenMime || "audio/webm";

      const options: MediaRecorderOptions = chosenMime ? { mimeType: chosenMime } : {};
      const recorder = new MediaRecorder(stream, options);

      if (recorder.mimeType) {
        mimeTypeRef.current = recorder.mimeType;
      }

      chunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      recorder.start(1000);
      recorderRef.current = recorder;
      setElapsed(0);
      setState("recording");
      timerRef.current = setInterval(() => setElapsed((s) => s + 1), 1000);
      return true;
    } catch (err: any) {
      console.error("Audio recording start error:", err);
      stopActiveStream();

      if (!isSecureContextOrLocal()) {
        setError(
          "Microphone access requires HTTPS on mobile devices. Please connect using https:// or enable insecure origin flags in your browser."
        );
      } else if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
        setError(
          "Microphone permission was denied. Tap the lock or tune icon in your browser address bar to allow microphone access, then try again."
        );
      } else if (err.name === "NotFoundError" || err.name === "DevicesNotFoundError") {
        setError("No microphone was detected on this device. Please connect a microphone and try again.");
      } else if (err.name === "NotReadableError" || err.name === "TrackStartError") {
        setError("Microphone is currently in use by another application or call. Please release it and try again.");
      } else if (err.name === "SecurityError") {
        setError("Microphone access was blocked due to security restrictions. An HTTPS connection is required.");
      } else {
        setError(err.message || "Microphone access could not be started. Check browser permissions and try again.");
      }
      return false;
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
        const finalMime = mimeTypeRef.current || rec.mimeType || "audio/webm";

        rec.onstop = () => {
          const blob = new Blob(chunksRef.current, { type: finalMime });
          stopActiveStream();
          recorderRef.current = null;
          clearTimer();
          setState("idle");
          resolve({ blob, durationSec: duration });
        };

        if (rec.state !== "inactive") {
          rec.stop();
        } else {
          stopActiveStream();
          recorderRef.current = null;
          clearTimer();
          setState("idle");
          resolve(null);
        }
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
