import React, { useState, useEffect } from "react";
import LoginView from "./components/LoginView";
import CandidateList from "./components/CandidateList";
import SessionView from "./components/SessionView";
import QuestionManager from "./components/QuestionManager";
import SettingsView from "./components/SettingsView";
import { INITIAL_CANDIDATES, INITIAL_QUESTIONS } from "./utils/initialData";
import { exportInterviewToExcel } from "./utils/excelExporter";
import { fetchCandidates, fetchQuestions, createCandidate, createQuestion, createSession, uploadRecordingTake, resetDatabase, getExcelExportUrl } from "./services/api";

export default function App() {
  const [currentUser, setCurrentUser] = useState(() => {
    const saved = localStorage.getItem("interview_user_session");
    return saved ? JSON.parse(saved) : null;
  });

  const [candidates, setCandidates] = useState(INITIAL_CANDIDATES);
  const [questions, setQuestions] = useState(INITIAL_QUESTIONS);
  const [recordingsMap, setRecordingsMap] = useState({});

  const [selectedCandidate, setSelectedCandidate] = useState(null);
  const [activeSession, setActiveSession] = useState(null);
  const [activeView, setActiveView] = useState("candidates"); // candidates | session | questions | settings

  // Load from backend on mount
  useEffect(() => {
    async function loadBackendData() {
      const dbCandidates = await fetchCandidates();
      if (dbCandidates && dbCandidates.length > 0) {
        setCandidates(dbCandidates);
      }

      const dbQuestions = await fetchQuestions();
      if (dbQuestions && dbQuestions.length > 0) {
        setQuestions(dbQuestions);
      }
    }
    loadBackendData();
  }, []);

  const handleLoginSuccess = (userObj) => {
    setCurrentUser(userObj);
    localStorage.setItem("interview_user_session", JSON.stringify(userObj));
    setActiveView("candidates");
  };

  const handleLogout = () => {
    setCurrentUser(null);
    localStorage.removeItem("interview_user_session");
  };

  // Start / Resume session
  const handleStartSession = async (cand) => {
    setSelectedCandidate(cand);

    const sessionPayload = {
      candidateId: cand.id,
      interviewer: currentUser?.name || "Admin Interviewer"
    };

    const createdSess = await createSession(sessionPayload);

    const newSession = createdSess || {
      id: `SESS-${Date.now().toString().slice(-6)}`,
      candidateId: cand.id,
      candidateName: cand.name,
      date: new Date().toLocaleDateString(),
      interviewer: currentUser?.name || "Admin Interviewer",
      status: "in_progress"
    };

    setActiveSession(newSession);

    setCandidates((prev) =>
      prev.map((c) => (c.id === cand.id ? { ...c, status: "in_progress" } : c))
    );

    setActiveView("session");
  };

  // Add Candidate
  const handleAddCandidate = async (newCandData) => {
    const savedCand = await createCandidate(newCandData);
    setCandidates((prev) => [savedCand || { ...newCandData, id: `cand_${Date.now()}` }, ...prev]);
  };

  // Delete Candidate
  const handleDeleteCandidate = (candId) => {
    setCandidates((prev) => prev.filter((c) => c.id !== candId));
  };

  // Add Custom Question
  const handleAddCustomQuestion = async (newQuestionData) => {
    const savedQ = await createQuestion(newQuestionData);
    const newQ = savedQ || { id: `q_custom_${Date.now()}`, ...newQuestionData };

    setQuestions((prev) => [...prev, newQ]);
  };

  // Delete Custom Question
  const handleDeleteQuestion = (qId) => {
    setQuestions((prev) => prev.filter((q) => q.id !== qId));
  };

  // Save Recording Take
  const handleSaveTake = async (questionId, takeData) => {
    let finalTake = { ...takeData };

    if (activeSession) {
      const serverRecording = await uploadRecordingTake({
        sessionId: activeSession.id,
        questionId,
        audioBlob: takeData.audioBlob,
        durationSec: takeData.durationSeconds,
        notes: takeData.notes,
        manualTranscript: takeData.transcript
      });

      if (serverRecording) {
        if (serverRecording.audioUrl) {
          finalTake.audioUrl = serverRecording.audioUrl;
        }
        if (serverRecording.cleanTranscript || serverRecording.rawTranscript) {
          finalTake.transcript = serverRecording.cleanTranscript || serverRecording.rawTranscript;
        }
      }
    }

    setRecordingsMap((prev) => {
      const existingTakes = prev[questionId] || [];
      const updatedTakes = existingTakes.map((t) => ({ ...t, isActive: false }));
      const newTakesList = [...updatedTakes, finalTake];

      // Update candidate counts
      if (selectedCandidate) {
        setCandidates((cPrev) =>
          cPrev.map((c) =>
            c.id === selectedCandidate.id
              ? {
                ...c,
                recordingsCount: (c.recordingsCount || 0) + 1,
                questionsCount: Object.keys({ ...prev, [questionId]: newTakesList }).length
              }
              : c
          )
        );
      }

      return {
        ...prev,
        [questionId]: newTakesList
      };
    });
  };

  // Finish session -> mark Complete and return to Dashboard
  const handleFinishSession = () => {
    if (selectedCandidate) {
      setCandidates((prev) =>
        prev.map((c) => (c.id === selectedCandidate.id ? { ...c, status: "complete" } : c))
      );
    }

    if (activeSession) {
      setActiveSession((prev) => ({ ...prev, status: "complete" }));
    }

    setActiveView("candidates");
  };

  // Excel Export
  const handleExportExcel = (candidateParam) => {
    let exportUrl = getExcelExportUrl();
    let fileName = `Interview_Transcripts_All_Candidates_${Date.now()}.xlsx`;

    if (candidateParam && typeof candidateParam === "object") {
      exportUrl = getExcelExportUrl(candidateParam.id);
      fileName = `Interview_Transcript_${candidateParam.name.replace(/\s+/g, "_")}.xlsx`;
    } else if (selectedCandidate && candidateParam !== "all") {
      exportUrl = getExcelExportUrl(selectedCandidate.id);
      fileName = `Interview_Transcript_${selectedCandidate.name.replace(/\s+/g, "_")}.xlsx`;
    }

    const link = document.createElement("a");
    link.href = exportUrl;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Reset Database
  const handleResetDatabase = async (password) => {
    const res = await resetDatabase(password);
    if (res && res.success) {
      setRecordingsMap({});
      const freshCands = await fetchCandidates();
      setCandidates(freshCands || []);
    }
    return res;
  };

  // If not authenticated, render Login Page
  if (!currentUser) {
    return <LoginView onLoginSuccess={handleLoginSuccess} />;
  }

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text)]">
      {activeView === "candidates" && (
        <CandidateList
          candidates={candidates}
          selectedCandidate={selectedCandidate}
          onSelectCandidate={setSelectedCandidate}
          onStartSession={handleStartSession}
          onAddCandidate={handleAddCandidate}
          onDeleteCandidate={handleDeleteCandidate}
          onExportExcel={handleExportExcel}
          onResetDatabase={handleResetDatabase}
          onLogout={handleLogout}
        />
      )}

      {activeView === "session" && (
        <SessionView
          session={activeSession}
          candidate={selectedCandidate}
          questions={questions}
          recordingsMap={recordingsMap}
          onSaveTake={handleSaveTake}
          onAddCustomQuestion={handleAddCustomQuestion}
          onExportExcel={() => handleExportExcel(selectedCandidate)}
          onFinishSession={handleFinishSession}
          onBackToCandidates={() => setActiveView("candidates")}
          onLogout={handleLogout}
        />
      )}

      {activeView === "questions" && (
        <QuestionManager
          questions={questions}
          onAddCustomQuestion={handleAddCustomQuestion}
          onDeleteQuestion={handleDeleteQuestion}
          onExportExcel={() => handleExportExcel(selectedCandidate)}
          onLogout={handleLogout}
        />
      )}

      {activeView === "settings" && (
        <SettingsView
          onExportExcel={() => handleExportExcel(selectedCandidate)}
          onLogout={handleLogout}
        />
      )}
    </div>
  );
}
