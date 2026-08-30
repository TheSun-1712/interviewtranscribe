const API_BASE = "http://localhost:4000/api";

export async function fetchCandidates() {
  try {
    const res = await fetch(`${API_BASE}/candidates`);
    if (!res.ok) throw new Error("Failed to fetch candidates");
    return await res.json();
  } catch (err) {
    console.warn("Backend API offline, using local fallback data:", err.message);
    return null;
  }
}

export async function createCandidate(candData) {
  try {
    const res = await fetch(`${API_BASE}/candidates`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(candData)
    });
    return await res.json();
  } catch (err) {
    console.error("Create candidate error:", err);
    return candData;
  }
}

export async function importCandidatesExcel(file, clearExisting = false) {
  try {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("clearExisting", String(clearExisting));

    const url = `${API_BASE}/candidates/import?clearExisting=${Boolean(clearExisting)}`;
    const res = await fetch(url, {
      method: "POST",
      body: formData
    });
    return await res.json();
  } catch (err) {
    console.error("Import candidates Excel error:", err);
    return { error: err.message };
  }
}

export async function fetchQuestions() {
  try {
    const res = await fetch(`${API_BASE}/questions`);
    if (!res.ok) throw new Error("Failed to fetch questions");
    return await res.json();
  } catch (err) {
    console.warn("Backend API offline, using local question bank:", err.message);
    return null;
  }
}

export async function createQuestion(qData) {
  try {
    const res = await fetch(`${API_BASE}/questions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(qData)
    });
    return await res.json();
  } catch (err) {
    console.error("Create question error:", err);
    return qData;
  }
}

export async function createSession(sessionData) {
  try {
    const res = await fetch(`${API_BASE}/sessions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(sessionData)
    });
    return await res.json();
  } catch (err) {
    console.error("Create session error:", err);
    return sessionData;
  }
}

export async function uploadRecordingTake({ sessionId, questionId, audioBlob, durationSec, notes, manualTranscript }) {
  try {
    const formData = new FormData();
    formData.append("sessionId", sessionId);
    formData.append("questionId", questionId);
    formData.append("durationSec", durationSec || 0);
    formData.append("notes", notes || "");
    formData.append("manualTranscript", manualTranscript || "");

    if (audioBlob) {
      formData.append("audio", audioBlob, `take_${Date.now()}.webm`);
    }

    const res = await fetch(`${API_BASE}/recordings`, {
      method: "POST",
      body: formData
    });
    return await res.json();
  } catch (err) {
    console.error("Upload recording error:", err);
    return null;
  }
}

export async function uploadFullSessionRecording({ sessionId, audioBlob, durationSec }) {
  try {
    const formData = new FormData();
    formData.append("durationSec", durationSec || 0);
    if (audioBlob) {
      formData.append("audio", audioBlob, `full_interview_${Date.now()}.webm`);
    }

    const res = await fetch(`${API_BASE}/sessions/${sessionId}/full-recording`, {
      method: "POST",
      body: formData
    });
    return await res.json();
  } catch (err) {
    console.error("Upload full session recording error:", err);
    return null;
  }
}

export async function resetDatabase(password) {
  try {
    const res = await fetch(`${API_BASE}/settings/reset-database`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password })
    });
    return await res.json();
  } catch (err) {
    console.error("Reset database error:", err);
    return { error: err.message };
  }
}

export function getExcelExportUrl(candidateId) {
  return `${API_BASE}/export.xlsx${candidateId ? `?candidateId=${candidateId}` : ""}`;
}
