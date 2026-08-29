import React, { useState, useRef, useEffect } from "react";
import { FileSpreadsheet, Mic, Square } from "lucide-react";
import RecordButton from "./RecordButton";
import { uploadFullSessionRecording } from "../services/api";

export default function SessionView({
  session,
  candidate,
  questions,
  recordingsMap,
  onSaveTake,
  onAddCustomQuestion,
  onExportExcel,
  onFinishSession,
  onBackToCandidates,
  onLogout
}) {
  const [customQText, setCustomQText] = useState("");

  // Single full-interview continuous recording state
  const [fullRecStage, setFullRecStage] = useState("idle"); // idle | recording | processing | done
  const [fullRecTime, setFullRecTime] = useState(0);
  const fullMediaRecorderRef = useRef(null);
  const fullAudioChunksRef = useRef([]);
  const fullTimerRef = useRef(null);

  useEffect(() => {
    if (fullRecStage === "recording") {
      fullTimerRef.current = setInterval(() => {
        setFullRecTime((prev) => prev + 1);
      }, 1000);
    } else {
      clearInterval(fullTimerRef.current);
    }
    return () => clearInterval(fullTimerRef.current);
  }, [fullRecStage]);

  const handleStartFullRec = async () => {
    try {
      fullAudioChunksRef.current = [];
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
      fullMediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) fullAudioChunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(fullAudioChunksRef.current, { type: options.mimeType || "audio/webm" });
        stream.getTracks().forEach((t) => t.stop());

        setFullRecStage("processing");
        try {
          await uploadFullSessionRecording({
            sessionId: session.id,
            audioBlob,
            durationSec: fullRecTime
          });
        } catch (e) {
          console.warn("Full session audio processing warning:", e);
        }

        setFullRecStage("done");
        setTimeout(() => setFullRecStage("idle"), 2000);
      };

      mediaRecorder.start(250);
      setFullRecStage("recording");
      setFullRecTime(0);
    } catch (err) {
      alert("Microphone access denied or unavailable.");
    }
  };

  const handleStopFullRec = () => {
    if (fullMediaRecorderRef.current && fullRecStage === "recording") {
      fullMediaRecorderRef.current.stop();
    }
  };

  const formatTimer = (secs) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  const totalRecordingsCount = Object.values(recordingsMap).reduce(
    (acc, takes) => acc + takes.length,
    0
  );

  const handleAddCustomSubmit = (e) => {
    e.preventDefault();
    if (!customQText.trim()) return;

    onAddCustomQuestion({
      text: customQText.trim(),
      category: "Technical",
      description: "Added during session",
      isCustom: true
    });

    setCustomQText("");
  };

  if (!candidate || !session) {
    return (
      <div className="p-12 text-center text-[var(--muted)] font-mono">
        No active session found.
        <br />
        <button onClick={onBackToCandidates} className="btn-primary mt-4 text-xs">
          ← Return to candidates
        </button>
      </div>
    );
  }

  return (
    <div>
      {/* Topbar */}
      <div className="topbar">
        <span className="mark">SIGNAL</span>
        <h1>Session</h1>
        <div className="flex-1" />
        <button onClick={onExportExcel} className="ghost-btn font-mono text-xs">
          <FileSpreadsheet className="h-3.5 w-3.5 inline mr-1 text-[var(--teal)]" />
          Export Excel
        </button>
        <button onClick={onLogout} className="ghost-btn font-mono text-xs">
          Log out
        </button>
      </div>

      {/* Session Body */}
      <div className="p-[22px_28px] max-w-[900px] mx-auto space-y-6">
        {/* Session Header */}
        <div className="flex items-center gap-[12px] flex-wrap justify-between mb-[22px]">
          <div>
            <button
              onClick={onBackToCandidates}
              className="font-mono text-[12px] text-[var(--muted)] hover:text-[var(--text)] transition-colors cursor-pointer bg-transparent border-none p-0"
            >
              ← Back to candidates
            </button>
            <h2 className="m-[8px_0_3px_0] text-[18px] font-semibold text-[var(--text)]">
              {candidate.name} — {candidate.role || "Candidate"}
            </h2>
            <p className="m-0 text-[12.5px] text-[var(--muted)]">
              Session started {session.date || "Today"} · {totalRecordingsCount} recordings so far
            </p>
          </div>

          <div className="flex items-center gap-3">
            {/* Single Full Interview Recording Button */}
            {fullRecStage === "idle" && (
              <button
                onClick={handleStartFullRec}
                className="btn-amber font-mono text-xs"
                title="Record full continuous interview audio. Groq AI will auto-categorize all answers."
              >
                <Mic className="h-4 w-4" /> Start Full Interview Rec
              </button>
            )}

            {fullRecStage === "recording" && (
              <button
                onClick={handleStopFullRec}
                className="record-btn recording font-mono text-xs"
              >
                <Square className="h-3.5 w-3.5 text-white" /> Stop Full Rec ({formatTimer(fullRecTime)})
              </button>
            )}

            {fullRecStage === "processing" && (
              <button disabled className="record-btn busy font-mono text-xs">
                Groq AI Auto-Categorizing Interview...
              </button>
            )}

            {fullRecStage === "done" && (
              <button disabled className="record-btn text-[var(--teal)] border-[var(--teal)] bg-[var(--teal-bg)] font-mono text-xs">
                ✓ Full Interview Saved
              </button>
            )}

            <button onClick={onFinishSession} className="finish-btn">
              Finish interview &amp; save
            </button>
          </div>
        </div>

        {/* Questions List */}
        <div className="space-y-[10px]">
          {questions.map((q) => {
            const takes = recordingsMap[q.id] || [];
            const categoryClass =
              q.category?.toLowerCase() === "behavioral"
                ? "behavioral"
                : q.category?.toLowerCase() === "technical"
                ? "technical"
                : "general";

            return (
              <div key={q.id} className="panel-card">
                <div className="flex items-center gap-[10px] flex-wrap sm:flex-nowrap">
                  <span className={`q-cat ${categoryClass}`}>{q.category || "General"}</span>
                  <span className="flex-1 text-[13.5px] font-medium text-[var(--text)]">
                    {q.text}
                  </span>
                  <span className="font-mono text-[11.5px] text-[var(--muted)] whitespace-nowrap">
                    {takes.length} take{takes.length !== 1 ? "s" : ""}
                  </span>

                  <RecordButton
                    questionId={q.id}
                    onSaveTake={(takeData) => onSaveTake(q.id, takeData)}
                  />
                </div>

                {/* Takes History with Executive AI Answer Summary */}
                {takes.length > 0 && (
                  <div className="mt-[10px] pt-[10px] border-t border-dashed border-[var(--line)] flex flex-col gap-[6px]">
                    {takes.map((take) => (
                      <div
                        key={take.id}
                        className="flex items-start gap-[10px] font-mono text-[11.5px] text-[var(--muted)] flex-wrap"
                      >
                        <span className="text-[var(--text)] font-semibold whitespace-nowrap">
                          Take {take.takeNumber} ({take.durationSeconds || 0}s):
                        </span>
                        {take.audioUrl && (
                          <a
                            href={take.audioUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[var(--teal)] hover:underline whitespace-nowrap"
                          >
                            audio
                          </a>
                        )}
                        <span className="text-[var(--amber)] italic flex-1">
                          "AI Summary: {take.aiSummary || take.transcript || "[No summary]"}"
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Add Custom Question Row */}
        <form onSubmit={handleAddCustomSubmit} className="flex gap-[8px] mt-[16px]">
          <input
            type="text"
            placeholder="Add a custom question for this session..."
            value={customQText}
            onChange={(e) => setCustomQText(e.target.value)}
            className="flex-1 bg-[var(--panel-2)] border border-[var(--line)] text-[var(--text)] p-[9px_12px] rounded-md text-[13px] outline-none focus:border-[var(--teal)]"
          />
          <button type="submit" className="ghost-btn">
            + Add
          </button>
        </form>
      </div>
    </div>
  );
}
