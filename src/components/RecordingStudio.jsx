import React, { useState, useEffect, useRef } from "react";
import { Mic, Square, Pause, Play, RotateCcw, Save, Sparkles, AlertCircle, Volume2, CheckCircle2 } from "lucide-react";

export default function RecordingStudio({
  activeQuestion,
  questionIndex,
  totalQuestions,
  onSaveTake,
  existingTakesCount
}) {
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [transcript, setTranscript] = useState("");
  const [audioUrl, setAudioUrl] = useState(null);
  const [audioBlob, setAudioBlob] = useState(null);
  const [notes, setNotes] = useState("");
  const [isSpeechSupported, setIsSpeechSupported] = useState(true);
  const [isListening, setIsListening] = useState(false);

  // Refs for audio media recording & speech recognition
  const timerRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const recognitionRef = useRef(null);
  const canvasRef = useRef(null);
  const animationFrameRef = useRef(null);
  const audioContextRef = useRef(null);

  // Reset studio when question changes
  useEffect(() => {
    stopRecording();
    setTranscript("");
    setAudioUrl(null);
    setAudioBlob(null);
    setNotes("");
    setRecordingTime(0);
  }, [activeQuestion?.id]);

  // Setup Web Speech Recognition API if available
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = "en-US";

      recognition.onresult = (event) => {
        let currentTranscript = "";
        for (let i = 0; i < event.results.length; i++) {
          currentTranscript += event.results[i][0].transcript + " ";
        }
        setTranscript(currentTranscript.trim());
      };

      recognition.onerror = (err) => {
        console.warn("Speech recognition error:", err);
      };

      recognitionRef.current = recognition;
      setIsSpeechSupported(true);
    } else {
      setIsSpeechSupported(false);
    }

    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch (e) {}
      }
    };
  }, []);

  // Timer tick
  useEffect(() => {
    if (isRecording && !isPaused) {
      timerRef.current = setInterval(() => {
        setRecordingTime((prev) => prev + 1);
      }, 1000);
    } else {
      clearInterval(timerRef.current);
    }
    return () => clearInterval(timerRef.current);
  }, [isRecording, isPaused]);

  // Start Mic & Visualizer & Speech Recognition
  const startRecording = async () => {
    try {
      audioChunksRef.current = [];
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      // AudioContext visualizer
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      audioContextRef.current = audioCtx;
      const analyser = audioCtx.createAnalyser();
      const source = audioCtx.createMediaStreamSource(stream);
      source.connect(analyser);
      analyser.fftSize = 64;
      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      // Canvas draw loop
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext("2d");
        const drawWave = () => {
          animationFrameRef.current = requestAnimationFrame(drawWave);
          analyser.getByteFrequencyData(dataArray);

          ctx.clearRect(0, 0, canvas.width, canvas.height);
          const barWidth = (canvas.width / bufferLength) * 2;
          let x = 0;

          for (let i = 0; i < bufferLength; i++) {
            const barHeight = (dataArray[i] / 255) * canvas.height;
            const gradient = ctx.createLinearGradient(0, canvas.height, 0, 0);
            gradient.addColorStop(0, "#06b6d4");
            gradient.addColorStop(1, "#f43f5e");

            ctx.fillStyle = gradient;
            ctx.fillRect(x, canvas.height - barHeight, barWidth - 2, barHeight);
            x += barWidth;
          }
        };
        drawWave();
      }

      // MediaRecorder setup
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        const url = URL.createObjectURL(blob);
        setAudioBlob(blob);
        setAudioUrl(url);

        // Stop stream tracks
        stream.getTracks().forEach((track) => track.stop());
        if (audioContextRef.current) {
          audioContextRef.current.close();
        }
        if (animationFrameRef.current) {
          cancelAnimationFrame(animationFrameRef.current);
        }
      };

      mediaRecorder.start();
      setIsRecording(true);
      setIsPaused(false);
      setRecordingTime(0);

      // Start Speech Recognition
      if (recognitionRef.current) {
        try {
          recognitionRef.current.start();
          setIsListening(true);
        } catch (e) {
          console.warn("Speech recognition already active");
        }
      }
    } catch (err) {
      console.error("Microphone access error:", err);
      alert("Microphone permission denied or unavailable. You can still type live transcripts manually.");
      setIsRecording(true);
      setRecordingTime(0);
    }
  };

  const pauseRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      if (isPaused) {
        mediaRecorderRef.current.resume();
        setIsPaused(false);
        if (recognitionRef.current) {
          try { recognitionRef.current.start(); } catch(e) {}
        }
      } else {
        mediaRecorderRef.current.pause();
        setIsPaused(true);
        if (recognitionRef.current) {
          try { recognitionRef.current.stop(); } catch(e) {}
        }
      }
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
    }
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch(e) {}
    }
    setIsRecording(false);
    setIsPaused(false);
    setIsListening(false);
  };

  const handleSave = () => {
    const takeNumber = existingTakesCount + 1;
    onSaveTake({
      id: `take_${Date.now()}`,
      takeNumber,
      audioUrl,
      audioBlob,
      durationSeconds: recordingTime || 15,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
      transcript: transcript.trim() || "[No verbal transcript recorded]",
      notes: notes.trim(),
      isActive: true
    });

    // Reset studio state for next take
    setAudioUrl(null);
    setAudioBlob(null);
    setTranscript("");
    setNotes("");
    setRecordingTime(0);
  };

  const formatTimer = (secs) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  if (!activeQuestion) return null;

  return (
    <div className="glass-panel p-6 space-y-6 bg-slate-900/80 border-indigo-500/20 shadow-2xl">
      {/* Question Header Banner */}
      <div className="flex items-start justify-between gap-4 pb-4 border-b border-white/10">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="badge badge-category">
              Question {questionIndex + 1} of {totalQuestions}
            </span>
            <span className="text-xs text-indigo-400 font-semibold">{activeQuestion.category}</span>
            {existingTakesCount > 0 && (
              <span className="badge bg-emerald-500/10 text-emerald-300 border border-emerald-500/30">
                {existingTakesCount} Take{existingTakesCount > 1 ? "s" : ""} Recorded
              </span>
            )}
          </div>
          <h3 className="text-xl font-bold text-white tracking-tight leading-snug">
            {activeQuestion.text}
          </h3>
          {activeQuestion.description && (
            <p className="text-xs text-slate-400 mt-1">{activeQuestion.description}</p>
          )}
        </div>
      </div>

      {/* Recording Studio Center Visualizer */}
      <div className="glass-panel p-6 bg-[#0c1220] border-white/5 flex flex-col items-center justify-center text-center space-y-4">
        {/* Visual Wave Canvas */}
        <div className="w-full max-w-lg h-24 relative flex items-center justify-center bg-slate-950/60 rounded-xl overflow-hidden border border-white/5">
          <canvas ref={canvasRef} width="400" height="96" className="w-full h-full" />

          {!isRecording && !audioUrl && (
            <div className="absolute inset-0 flex items-center justify-center text-slate-500 text-xs gap-2">
              <Volume2 className="h-4 w-4" /> Ready to capture audio response
            </div>
          )}
        </div>

        {/* Timer Display */}
        <div className="flex items-center gap-3">
          {isRecording && <span className="h-3 w-3 rounded-full bg-rose-500 animate-ping" />}
          <span className="font-mono text-3xl font-extrabold tracking-wider text-white">
            {formatTimer(recordingTime)}
          </span>
          {isRecording && (
            <span className="text-xs text-rose-400 uppercase tracking-wider font-semibold animate-pulse">
              {isPaused ? "PAUSED" : "REC"}
            </span>
          )}
        </div>

        {/* Audio Recording Controls */}
        <div className="flex items-center gap-4 pt-2">
          {!isRecording && !audioUrl && (
            <button
              onClick={startRecording}
              className="btn btn-record text-sm px-6 py-3 flex items-center gap-2 animate-pulse-recording"
            >
              <Mic className="h-5 w-5" />
              <span>Start Recording</span>
            </button>
          )}

          {isRecording && (
            <>
              <button
                onClick={pauseRecording}
                className="btn btn-secondary text-sm px-4 py-2.5 flex items-center gap-2"
              >
                {isPaused ? <Play className="h-4 w-4 fill-current" /> : <Pause className="h-4 w-4" />}
                <span>{isPaused ? "Resume" : "Pause"}</span>
              </button>

              <button
                onClick={stopRecording}
                className="btn bg-rose-600 hover:bg-rose-700 text-white text-sm px-6 py-2.5 flex items-center gap-2 shadow-lg shadow-rose-600/30"
              >
                <Square className="h-4 w-4 fill-current" />
                <span>Stop Recording</span>
              </button>
            </>
          )}

          {audioUrl && !isRecording && (
            <div className="flex items-center gap-3">
              <button
                onClick={startRecording}
                className="btn btn-secondary text-xs px-3 py-2 flex items-center gap-1.5"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                <span>Record New Take</span>
              </button>
            </div>
          )}
        </div>

        {/* Audio Player Preview */}
        {audioUrl && !isRecording && (
          <div className="w-full max-w-md pt-3">
            <p className="text-xs text-emerald-400 font-semibold mb-1 flex items-center justify-center gap-1">
              <CheckCircle2 className="h-3.5 w-3.5" /> Audio Captured Successfully
            </p>
            <audio src={audioUrl} controls className="w-full h-10 rounded-lg bg-slate-950" />
          </div>
        )}
      </div>

      {/* Transcript Textarea & Notes */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Live Speech Transcript */}
        <div className="md:col-span-2 space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-2">
              <Sparkles className="h-3.5 w-3.5 text-indigo-400" />
              <span>Live Speech-to-Text Transcript</span>
              {isListening && (
                <span className="text-[10px] text-cyan-400 font-mono animate-pulse">● Listening...</span>
              )}
            </label>
            {!isSpeechSupported && (
              <span className="text-[10px] text-amber-400 flex items-center gap-1">
                <AlertCircle className="h-3 w-3" /> Type transcript manually
              </span>
            )}
          </div>
          <textarea
            rows="4"
            placeholder="Live spoken response will appear here automatically. You can also edit or refine text freely..."
            value={transcript}
            onChange={(e) => setTranscript(e.target.value)}
            className="form-textarea font-mono text-sm leading-relaxed"
          />
        </div>

        {/* Interviewer Notes */}
        <div className="space-y-2">
          <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
            Interviewer Notes / Key Takeaways
          </label>
          <textarea
            rows="4"
            placeholder="Body language, key strengths, technical clarity..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="form-textarea text-xs"
          />
        </div>
      </div>

      {/* Save Take Action Bar */}
      {(audioUrl || transcript.trim().length > 0) && (
        <div className="flex items-center justify-between pt-4 border-t border-white/10">
          <p className="text-xs text-slate-400">
            Clicking Save will record this as <strong className="text-indigo-300">Take {existingTakesCount + 1}</strong>. Multiple takes are supported per question.
          </p>
          <button
            onClick={handleSave}
            className="btn btn-primary text-sm px-6 py-2.5 flex items-center gap-2 shadow-xl"
          >
            <Save className="h-4 w-4" />
            <span>Save Take {existingTakesCount + 1}</span>
          </button>
        </div>
      )}
    </div>
  );
}
