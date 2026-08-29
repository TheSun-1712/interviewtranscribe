import React, { useState, useRef, useEffect } from "react";

export default function RecordButton({ questionId, onSaveTake }) {
  // States: idle | recording | uploading | transcribing | done
  const [stage, setStage] = useState("idle");
  const [recordingTime, setRecordingTime] = useState(0);

  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const timerRef = useRef(null);

  useEffect(() => {
    if (stage === "recording") {
      timerRef.current = setInterval(() => {
        setRecordingTime((prev) => prev + 1);
      }, 1000);
    } else {
      clearInterval(timerRef.current);
    }
    return () => clearInterval(timerRef.current);
  }, [stage]);

  const handleStartRecord = async () => {
    try {
      audioChunksRef.current = [];
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });

      let options = {};
      if (MediaRecorder.isTypeSupported("audio/webm;codecs=opus")) {
        options = { mimeType: "audio/webm;codecs=opus", audioBitsPerSecond: 128000 };
      }

      const mediaRecorder = new MediaRecorder(stream, options);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: options.mimeType || "audio/webm" });
        const audioUrl = URL.createObjectURL(audioBlob);

        // Stop mic tracks
        stream.getTracks().forEach((track) => track.stop());

        setStage("uploading");
        setTimeout(() => setStage("transcribing"), 1000);

        try {
          await onSaveTake({
            id: `take_${Date.now()}`,
            audioBlob,
            audioUrl,
            durationSeconds: recordingTime || 10,
            timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
            transcript: "",
            isActive: true
          });
        } catch (e) {
          console.warn("Take save error:", e);
        }

        setStage("done");
        setTimeout(() => {
          setStage("idle");
          setRecordingTime(0);
        }, 1500);
      };

      mediaRecorder.start(250); // Collect audio slice every 250ms for smooth recording
      setStage("recording");
      setRecordingTime(0);
    } catch (err) {
      console.warn("Mic error:", err);
      alert("Microphone access denied or unavailable.");
    }
  };

  const handleStopRecord = () => {
    if (mediaRecorderRef.current && stage === "recording") {
      mediaRecorderRef.current.stop();
    }
  };

  const handleClick = () => {
    if (stage === "idle") {
      handleStartRecord();
    } else if (stage === "recording") {
      handleStopRecord();
    }
  };

  const formatTimer = (secs) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  if (stage === "recording") {
    return (
      <button onClick={handleClick} className="record-btn recording">
        <span className="h-2 w-2 rounded-full bg-[var(--red)] animate-ping" />
        ● Recording ({formatTimer(recordingTime)})
      </button>
    );
  }

  if (stage === "uploading") {
    return (
      <button disabled className="record-btn busy">
        Uploading...
      </button>
    );
  }

  if (stage === "transcribing") {
    return (
      <button disabled className="record-btn busy">
        Transcribing...
      </button>
    );
  }

  if (stage === "done") {
    return (
      <button disabled className="record-btn text-[var(--teal)] border-[var(--teal)] bg-[var(--teal-bg)]">
        ✓ Saved
      </button>
    );
  }

  return (
    <button onClick={handleClick} className="record-btn">
      ● Record
    </button>
  );
}
