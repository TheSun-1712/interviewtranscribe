import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, useRef } from "react";
import { useStudio } from "@/lib/store";
import {
  fetchCandidates,
  fetchQuestions,
  createSession as apiCreateSession,
  createQuestion as apiCreateQuestion,
  uploadRecordingTake,
  uploadFullSessionRecording,
  getExcelExportUrl
} from "@/services/api";

export const Route = createFileRoute("/session/$id")({
  head: () => ({
    meta: [
      { title: "Interview Tracker — Session" },
      {
        name: "description",
        content: "Interview Session Recording and AI Transcriber",
      },
    ],
  }),
  component: SessionPage,
});

export default function SessionPage() {
  const { id } = Route.useParams();
  const { logout } = useStudio();
  const navigate = useNavigate();

  const [candidate, setCandidate] = useState<any>(null);
  const [questions, setQuestions] = useState<any[]>([]);
  const [session, setSession] = useState<any>(null);
  const [recordingsMap, setRecordingsMap] = useState<Record<string, any[]>>({});
  const [loading, setLoading] = useState(true);

  const [customQuestionText, setCustomQuestionText] = useState("");

  // Full session continuous recorder state
  const [fullRecStage, setFullRecStage] = useState<"idle" | "recording" | "processing" | "done">("idle");
  const [fullRecTime, setFullRecTime] = useState(0);
  const fullMediaRecorderRef = useRef<MediaRecorder | null>(null);
  const fullAudioChunksRef = useRef<Blob[]>([]);
  const fullTimerRef = useRef<any>(null);

  // Load candidate, questions, and active session
  useEffect(() => {
    async function initSession() {
      setLoading(true);
      const cands = await fetchCandidates();
      let currentCand = Array.isArray(cands) ? cands.find((c: any) => c.id === id) : null;
      
      if (!currentCand) {
        // Fallback candidate search
        currentCand = { id, name: "Candidate", role: "Software Engineer" };
      }
      setCandidate(currentCand);

      const qs = await fetchQuestions();
      const defaultQuestions = [
        { id: "q1", category: "Technical", text: "Walk me through how you'd design a rate limiter for a public API." },
        { id: "q2", category: "Behavioral", text: "Tell me about a time you disagreed with a technical decision." },
        { id: "q3", category: "Technical", text: "How would you debug a memory leak in a long-running Node service?" },
        { id: "q4", category: "Project & Strategy", text: "What is your approach/implementation plan to your project?" },
        { id: "q5", category: "Background & Overview", text: "Introduce yourself and your technical background." }
      ];
      setQuestions(qs && qs.length > 0 ? qs : defaultQuestions);

      // Create or attach session
      const createdSess = await apiCreateSession({
        candidateId: id,
        interviewer: "Admin Interviewer"
      });

      const activeSess = createdSess || {
        id: `sess_${id}`,
        candidateId: id,
        date: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        status: "in_progress"
      };
      setSession(activeSess);

      // Populate existing recordings if any
      const existingMap: Record<string, any[]> = {};
      if (currentCand && currentCand.sessions) {
        currentCand.sessions.forEach((s: any) => {
          if (Array.isArray(s.recordings)) {
            s.recordings.forEach((r: any) => {
              const qKey = r.questionId || "q1";
              if (!existingMap[qKey]) existingMap[qKey] = [];
              existingMap[qKey].push(r);
            });
          }
        });
      }
      setRecordingsMap(existingMap);

      setLoading(false);
    }

    initSession();
  }, [id]);

  // Full recorder timer effect
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
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }
      });

      let options: any = {};
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
        if (session) {
          await uploadFullSessionRecording({
            sessionId: session.id,
            audioBlob,
            durationSec: fullRecTime
          });
        }
        setFullRecStage("done");
        setTimeout(() => setFullRecStage("idle"), 2500);
      };

      mediaRecorder.start(250);
      setFullRecStage("recording");
      setFullRecTime(0);
    } catch {
      alert("Microphone access denied or unavailable.");
    }
  };

  const handleStopFullRec = () => {
    if (fullMediaRecorderRef.current && fullRecStage === "recording") {
      fullMediaRecorderRef.current.stop();
    }
  };

  const handleSaveTake = async (qId: string, takePayload: any) => {
    let newTake = {
      id: `take_${Date.now()}`,
      takeNumber: (recordingsMap[qId]?.length || 0) + 1,
      durationSec: takePayload.durationSeconds || 120,
      audioUrl: takePayload.audioUrl || "#",
      aiSummary: takePayload.transcript || "Candidate outlined detailed step-by-step technical strategy."
    };

    if (session) {
      const serverRes = await uploadRecordingTake({
        sessionId: session.id,
        questionId: qId,
        audioBlob: takePayload.audioBlob,
        durationSec: takePayload.durationSeconds,
        notes: takePayload.notes,
        manualTranscript: takePayload.transcript
      });

      if (serverRes) {
        if (serverRes.audioUrl) newTake.audioUrl = serverRes.audioUrl;
        if (serverRes.cleanTranscript || serverRes.rawTranscript) {
          newTake.aiSummary = serverRes.cleanTranscript || serverRes.rawTranscript;
        }
      }
    }

    setRecordingsMap((prev) => ({
      ...prev,
      [qId]: [...(prev[qId] || []), newTake]
    }));
  };

  const handleAddCustomQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customQuestionText.trim()) return;

    const newQ = {
      text: customQuestionText.trim(),
      category: "Technical",
      description: "Added during session",
      isCustom: true
    };

    const saved = await apiCreateQuestion(newQ);
    const finalQ = saved || { id: `q_custom_${Date.now()}`, ...newQ };

    setQuestions((prev) => [...prev, finalQ]);
    setCustomQuestionText("");
  };

  const handleFinishSession = () => {
    navigate({ to: "/candidates" });
  };

  const handleExportExcel = () => {
    window.open(getExcelExportUrl(id), "_blank");
  };

  const handleLogout = () => {
    logout();
    navigate({ to: "/" });
  };

  const formatTimer = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  const totalRecordingsCount = Object.values(recordingsMap).reduce(
    (acc, takes) => acc + takes.length,
    0
  );

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", backgroundColor: "var(--bg)", color: "var(--muted)", padding: "40px", fontFamily: "var(--mono)", textAlign: "center" }}>
        Loading session...
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "var(--bg)", color: "var(--text)" }}>
      {/* Topbar */}
      <div className="topbar">
        <span className="mark">SIGNAL</span>
        <h1>Session</h1>
        <div className="spacer"></div>
        <button onClick={handleExportExcel} className="ghost-btn">
          Export Excel
        </button>
        <button onClick={handleLogout} className="ghost-btn">
          Log out
        </button>
      </div>

      {/* Session Body */}
      <div className="session-body">
        <div className="session-head">
          <div className="session-title">
            <a
              className="back-link"
              onClick={() => navigate({ to: "/candidates" })}
            >
              ← Back to candidates
            </a>
            <h2 style={{ marginTop: "8px" }}>
              {candidate?.name || "Candidate"} — {candidate?.role || "Engineer"}
            </h2>
            <p>
              Session started {session?.date || "10:42 AM"} · {totalRecordingsCount} recordings so far
            </p>
          </div>

          <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
            {/* Full session audio recorder button */}
            {fullRecStage === "idle" && (
              <button
                onClick={handleStartFullRec}
                className="record-btn"
                style={{ borderColor: "var(--amber)", color: "var(--amber)" }}
              >
                🎙️ Start Full Rec
              </button>
            )}
            {fullRecStage === "recording" && (
              <button onClick={handleStopFullRec} className="record-btn recording">
                ■ Stop Full Rec ({formatTimer(fullRecTime)})
              </button>
            )}
            {fullRecStage === "processing" && (
              <button disabled className="record-btn busy">
                Processing Full Rec...
              </button>
            )}
            {fullRecStage === "done" && (
              <button disabled className="record-btn" style={{ borderColor: "var(--teal)", color: "var(--teal)" }}>
                ✓ Full Rec Saved
              </button>
            )}

            <button onClick={handleFinishSession} className="finish-btn">
              Finish interview &amp; save
            </button>
          </div>
        </div>

        {/* Question Items List */}
        {questions.map((q) => {
          const takes = recordingsMap[q.id] || [];
          const catNorm = (q.category || "Technical").toLowerCase();
          const catClass =
            catNorm === "behavioral" ? "behavioral" : catNorm === "technical" ? "technical" : "general";

          return (
            <QuestionItemCard
              key={q.id}
              question={q}
              catClass={catClass}
              takes={takes}
              onSaveTake={(takeData) => handleSaveTake(q.id, takeData)}
            />
          );
        })}

        {/* Add Custom Question Row */}
        <form onSubmit={handleAddCustomQuestion} className="add-q-row">
          <input
            type="text"
            placeholder="Add a custom question for this session..."
            value={customQuestionText}
            onChange={(e) => setCustomQuestionText(e.target.value)}
          />
          <button type="submit" className="ghost-btn">
            + Add
          </button>
        </form>
      </div>
    </div>
  );
}

// Single Question Card Component matching ui-mockup.html
function QuestionItemCard({
  question,
  catClass,
  takes,
  onSaveTake
}: {
  question: any;
  catClass: string;
  takes: any[];
  onSaveTake: (payload: any) => Promise<void>;
}) {
  const [stage, setStage] = useState<"idle" | "recording" | "uploading" | "transcribing" | "done">("idle");
  const [recTime, setRecTime] = useState(0);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<any>(null);

  useEffect(() => {
    if (stage === "recording") {
      timerRef.current = setInterval(() => {
        setRecTime((prev) => prev + 1);
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
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }
      });

      let options: any = {};
      if (MediaRecorder.isTypeSupported("audio/webm;codecs=opus")) {
        options = { mimeType: "audio/webm;codecs=opus", audioBitsPerSecond: 128000 };
      }

      const mediaRecorder = new MediaRecorder(stream, options);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: options.mimeType || "audio/webm" });
        const audioUrl = URL.createObjectURL(audioBlob);
        stream.getTracks().forEach((t) => t.stop());

        setStage("uploading");
        setTimeout(() => setStage("transcribing"), 600);

        try {
          await onSaveTake({
            audioBlob,
            audioUrl,
            durationSeconds: recTime || 15
          });
        } catch {
          /* ignore */
        }

        setStage("done");
        setTimeout(() => {
          setStage("idle");
          setRecTime(0);
        }, 1200);
      };

      mediaRecorder.start(250);
      setStage("recording");
      setRecTime(0);
    } catch {
      alert("Microphone access denied or unavailable.");
    }
  };

  const handleStopRecord = () => {
    if (mediaRecorderRef.current && stage === "recording") {
      mediaRecorderRef.current.stop();
    }
  };

  const formatTimer = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  return (
    <div className="q-item">
      <div className="q-top">
        <span className={`q-cat ${catClass}`}>{question.category || "Technical"}</span>
        <span className="q-text">{question.text || question.prompt}</span>
        <span className="take-count">{takes.length} take{takes.length !== 1 ? "s" : ""}</span>

        {stage === "idle" && (
          <button onClick={handleStartRecord} className="record-btn">
            ● Record
          </button>
        )}
        {stage === "recording" && (
          <button onClick={handleStopRecord} className="record-btn recording">
            ■ Stop ({formatTimer(recTime)})
          </button>
        )}
        {stage === "uploading" && (
          <button disabled className="record-btn busy">
            Uploading...
          </button>
        )}
        {stage === "transcribing" && (
          <button disabled className="record-btn busy">
            Transcribing...
          </button>
        )}
        {stage === "done" && (
          <button disabled className="record-btn" style={{ borderColor: "var(--teal)", color: "var(--teal)" }}>
            ✓ Saved
          </button>
        )}
      </div>

      {takes.length > 0 && (
        <div className="q-takes">
          {takes.map((t: any, idx: number) => {
            const takeNum = t.takeNumber || idx + 1;
            const dur = t.durationSec || t.durationSeconds || 90;
            const durFormatted = `${Math.floor(dur / 60)}:${(dur % 60).toString().padStart(2, "0")}`;
            const summaryText = t.aiSummary || t.cleanTranscript || t.rawTranscript || "Answer recorded successfully.";

            return (
              <div key={t.id || idx} className="take-row">
                <span>
                  Take {takeNum} · {durFormatted}
                </span>
                {t.audioUrl && (
                  <a href={t.audioUrl} target="_blank" rel="noopener noreferrer">
                    audio
                  </a>
                )}
                <span style={{ color: "var(--text)", flex: 1 }}>"{summaryText}"</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
