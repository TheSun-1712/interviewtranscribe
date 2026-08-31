/**
 * Centralized HTTP client for the Interview Transcribe & Evaluation backend.
 * Base URL: http://<host>:4000/api
 */

export type CandidateStatus = "not_started" | "in_progress" | "complete";

export interface QuestionAnswer {
  questionIndex: number;
  category: string;
  question: string;
  summary: string | null;
  transcript: string | null;
  asked: boolean;
  score: number | null;
  comment: string;
}

export interface AudioClip {
  id: string;
  sessionId: string;
  filePath: string;
  audioUrl: string;
  durationSec: number | null;
  transcript: string | null;
  status: "pending" | "transcribing" | "done" | "error";
  recordedAt: string;
}

export interface SessionState {
  id: string;
  recordingLockDevice: string | null;
  lockAcquiredAt: string | null;
  isTranscribing: boolean;
  isAnalyzing: boolean;
  transcriptionStatus: "none" | "done" | "error";
  analysisStatus: "none" | "done" | "error";
  fullTranscript: string | null;
  clips: AudioClip[];
}

export interface Candidate {
  id: string;
  fullName: string;
  branch: string;
  section: string;
  domains: string[];
  aacDomain: string;
  cgpa: number;
  attendance: number;
  status: CandidateStatus;
  isFlagged: boolean;
  recordingsCount: number;
  answeredCount: number;
  answers: QuestionAnswer[];
  sessionState?: SessionState | null;
}

export interface QuestionTemplate {
  index: number;
  category: string;
  prompt: string;
}

export interface SessionUser {
  name: string;
  email: string;
  role: "interviewer" | "panel_lead";
}

export const API_BASE_URL =
  (import.meta.env["VITE_API_BASE_URL"] as string | undefined) ?? "http://localhost:4000/api";

export type ApiMode = "live" | "mock";

let lastMode: ApiMode = "live";
export const getApiMode = () => lastMode;

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const isForm = init?.body instanceof FormData;
  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    ...(isForm ? {} : { headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) } }),
  });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return (await res.json()) as T;
}

/* Helper to map backend candidate DB schema to frontend Candidate model */
function mapBackendCandidate(cand: any): Candidate {
  const branchAndSec = cand.branchAndSection || cand.department || "CSE - A";
  const parts = branchAndSec.split("-").map((s: string) => s.trim());
  const branch = parts[0] || "CSE";
  const section = parts[1] || "A";

  const rawDomains = cand.domainsAppliedFor || cand.role || "Software Engineering";
  const domains = typeof rawDomains === "string"
    ? rawDomains.split(",").map((d: string) => d.trim()).filter(Boolean)
    : Array.isArray(rawDomains) ? rawDomains : [String(rawDomains)];

  const candidateRecordings = Array.isArray(cand.sessions)
    ? cand.sessions
        .flatMap((s: any) => s.recordings || [])
        // Sort by question createdAt or recording recordedAt
        .sort((a: any, b: any) => {
          const aTime = a.question?.createdAt ? new Date(a.question.createdAt).getTime() : (a.recordedAt ? new Date(a.recordedAt).getTime() : 0);
          const bTime = b.question?.createdAt ? new Date(b.question.createdAt).getTime() : (b.recordedAt ? new Date(b.recordedAt).getTime() : 0);
          return aTime - bTime;
        })
    : [];

  const recCount = candidateRecordings.length || cand.recordingsCount || 0;

  // Build 1 to 12 QuestionAnswers array
  const defaultQuestions = [
    { index: 1, category: "Background & Overview", prompt: "Name, introduce yourself, and academic background." },
    { index: 2, category: "Project & Strategy", prompt: "What is your problem statement and aim?" },
    { index: 3, category: "Project & Strategy", prompt: "What is your approach/implementation plan?" },
    { index: 4, category: "Domain Technical", prompt: "Basic questions on your domain concepts." },
    { index: 5, category: "Data Structures & Ideation", prompt: "DSA question and basic problem solving." },
    { index: 6, category: "Training & Development", prompt: "What did you understand about training and development?" },
    { index: 7, category: "Career Vision & Tech Role", prompt: "What do you think YOU will do in tech?" },
    { index: 8, category: "AAC Focus Area", prompt: "What area in AAC are you interested in?" },
    { index: 9, category: "Domain Spontaneity", prompt: "Spontaneous question based on your domain." },
    { index: 10, category: "Logistics & Availability", prompt: "Are you able to stay after hours for project work?" },
    { index: 11, category: "Mentorship & Leadership", prompt: "Are you interested in becoming a mentor?" },
    { index: 12, category: "Behavioral & Soft Skills", prompt: "Behavioural question: Describe a challenge navigated." }
  ];

  let answeredCount = 0;
  const answers: QuestionAnswer[] = defaultQuestions.map((q, idx) => {
    const matchedRec = candidateRecordings.find(
      (r: any) =>
        r.question?.qNumber === q.index ||
        r.question?.id === `q_${q.index}` ||
        r.questionId === `q_${q.index}` ||
        (r.question?.text && q.prompt && (
          r.question.text.toLowerCase().trim() === q.prompt.toLowerCase().trim() ||
          r.question.text.toLowerCase().includes(q.prompt.toLowerCase().slice(0, 15)) ||
          q.prompt.toLowerCase().includes(r.question.text.toLowerCase().slice(0, 15))
        )) ||
        (r.question?.category && r.question.category === q.category)
    ) ?? candidateRecordings[idx] ?? null;

    const rawAns = matchedRec?.cleanTranscript || matchedRec?.rawTranscript;
    const rawSum = matchedRec?.aiSummary;

    const isAsked = Boolean(
      matchedRec &&
      rawAns &&
      !rawAns.includes("Not answered") &&
      !rawAns.includes("not asked")
    );

    if (isAsked) answeredCount++;

    return {
      questionIndex: q.index,
      category: matchedRec?.question?.category || q.category,
      question: matchedRec?.question?.text || q.prompt,
      summary: isAsked ? (rawSum || "Candidate response recorded.") : null,
      transcript: isAsked ? rawAns : null,
      asked: isAsked,
      score: matchedRec?.score !== undefined && matchedRec?.score !== null ? Number(matchedRec.score) : null,
      comment: matchedRec?.comments || ""
    };
  });

  const normStatus = (cand.status || "not_started").toLowerCase();
  let finalStatus: CandidateStatus = "not_started";
  if (normStatus === "complete" || normStatus === "completed") {
    finalStatus = "complete";
  } else if (normStatus === "in_progress" || recCount > 0 || answeredCount > 0) {
    finalStatus = "in_progress";
  }

  // Get the latest session state (clips, lock, transcription status)
  const latestSession = Array.isArray(cand.sessions) && cand.sessions.length > 0
    ? cand.sessions[cand.sessions.length - 1]
    : null;

  const sessionState: SessionState | null = latestSession
    ? {
        id: latestSession.id,
        recordingLockDevice: latestSession.recordingLockDevice || null,
        lockAcquiredAt: latestSession.lockAcquiredAt || null,
        isTranscribing: latestSession.isTranscribing || false,
        isAnalyzing: latestSession.isAnalyzing || false,
        transcriptionStatus: latestSession.transcriptionStatus || "none",
        analysisStatus: latestSession.analysisStatus || "none",
        fullTranscript: latestSession.fullTranscript || null,
        clips: latestSession.audioClips || []
      }
    : null;

  return {
    id: cand.id,
    fullName: cand.name || cand.fullName || "Candidate",
    branch,
    section,
    domains,
    aacDomain: cand.domainInAAC || cand.aacDomain || "Computer Vision / AI",
    cgpa: parseFloat(cand.cgpa) || 8.5,
    attendance: parseFloat(cand.currentAttendance) || 85,
    status: finalStatus,
    isFlagged: cand.isFlagged || false,
    recordingsCount: recCount,
    answeredCount,
    answers,
    sessionState
  };
}

/* ---------------------------------- auth --------------------------------- */

export const login = async (email: string, password: string): Promise<SessionUser> => {
  return {
    name: email.split("@")[0]?.replace(/[._]/g, " ") || "Interviewer",
    email,
    role: email.includes("lead") ? "panel_lead" : "interviewer",
  };
};

/* ------------------------------- candidates ------------------------------ */

export const fetchCandidates = async (): Promise<Candidate[]> => {
  try {
    const data = await request<any[]>("/candidates");
    return Array.isArray(data) ? data.map(mapBackendCandidate) : [];
  } catch (err) {
    console.warn("Backend API offline or error fetching candidates:", err);
    return [];
  }
};

export const fetchCandidate = async (id: string): Promise<Candidate> => {
  const data = await request<any>(`/candidates/${id}`);
  return mapBackendCandidate(data);
};

export type CandidateInput = {
  fullName: string;
  branch: string;
  section: string;
  domains: string[];
  aacDomain: string;
  cgpa: number;
  attendance: number;
};

export const createCandidate = async (input: CandidateInput): Promise<Candidate> => {
  const payload = {
    name: input.fullName,
    branchAndSection: `${input.branch} - ${input.section}`,
    domainsAppliedFor: input.domains.join(", "),
    domainInAAC: input.aacDomain,
    cgpa: String(input.cgpa),
    currentAttendance: `${input.attendance}%`,
    status: "not_started"
  };
  const data = await request<any>("/candidates", {
    method: "POST",
    body: JSON.stringify(payload)
  });
  return mapBackendCandidate(data);
};

export const importCandidatesExcel = async (file: File, clearExisting: boolean): Promise<{ imported: number }> => {
  const form = new FormData();
  form.append("file", file);
  form.append("clearExisting", String(clearExisting));

  const data = await request<any>(`/candidates/import?clearExisting=${Boolean(clearExisting)}`, {
    method: "POST",
    body: form
  });

  return { imported: data.count || data.imported || 0 };
};

export const updateCandidateStatus = async (id: string, status: CandidateStatus): Promise<Candidate> => {
  const data = await request<any>(`/candidates/${id}/status`, {
    method: "PATCH",
    body: JSON.stringify({ status })
  });
  return mapBackendCandidate(data);
};

export const flagCandidate = async (id: string): Promise<Candidate> => {
  const data = await request<any>(`/candidates/${id}/flag`, {
    method: "PATCH"
  });
  return mapBackendCandidate(data);
};

/* ------------------------------- sessions -------------------------------- */

export const createSession = async (candidateId: string): Promise<{ id: string }> => {
  const data = await request<any>("/sessions", {
    method: "POST",
    body: JSON.stringify({ candidateId, interviewer: "Lead Interviewer" })
  });
  return { id: data.id };
};

export const fetchSession = async (sessionId: string): Promise<any> => {
  return request<any>(`/sessions/${sessionId}`);
};

/* ------------------------------- clips ----------------------------------- */

/** Generate a stable device ID stored in sessionStorage */
export const getDeviceId = (): string => {
  let id = sessionStorage.getItem("interview_device_id");
  if (!id) {
    id = `device_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    sessionStorage.setItem("interview_device_id", id);
  }
  return id;
};

/** Try to acquire the recording lock for a session */
export const acquireRecordingLock = async (
  sessionId: string,
  deviceId: string
): Promise<{ acquired: boolean; lockedBy?: string }> => {
  try {
    await request<any>(`/sessions/${sessionId}/acquire-lock`, {
      method: "POST",
      body: JSON.stringify({ deviceId })
    });
    return { acquired: true };
  } catch (err: any) {
    if (err.message?.startsWith("409")) {
      return { acquired: false, lockedBy: "another device" };
    }
    throw err;
  }
};

/** Release the recording lock */
export const releaseRecordingLock = async (sessionId: string): Promise<void> => {
  await request<any>(`/sessions/${sessionId}/release-lock`, { method: "POST" });
};

/** Upload a single audio clip to the server (saves to disk immediately) */
export const uploadAudioClip = async (
  sessionId: string,
  blob: Blob,
  durationSec: number,
  deviceId: string
): Promise<AudioClip> => {
  const form = new FormData();
  form.append("audio", blob, `clip_${sessionId}_${Date.now()}.webm`);
  form.append("sessionId", sessionId);
  form.append("deviceId", deviceId);
  form.append("durationSec", String(durationSec));

  return request<AudioClip>("/clips", {
    method: "POST",
    body: form
  });
};

/** Fetch all clips for a session */
export const fetchClips = async (sessionId: string): Promise<AudioClip[]> => {
  return request<AudioClip[]>(`/clips?sessionId=${sessionId}`);
};

/** Delete a specific clip */
export const deleteClip = async (clipId: string): Promise<void> => {
  await request<any>(`/clips/${clipId}`, { method: "DELETE" });
};

/** Trigger transcription (runs Whisper on all pending clips asynchronously) */
export const triggerTranscription = async (sessionId: string): Promise<void> => {
  await request<any>(`/sessions/${sessionId}/transcribe`, { method: "POST" });
};

/** Trigger LLM analysis (runs after transcription is done) */
export const triggerLLMAnalysis = async (sessionId: string): Promise<void> => {
  await request<any>(`/sessions/${sessionId}/analyze`, { method: "POST" });
};

/* ------------------------------- recordings ------------------------------ */

export interface UploadResult {
  recordingId: string;
  answers: QuestionAnswer[];
}

export const saveFeedback = async (
  candidateId: string,
  questionIndex: number,
  payload: { score: number | null; comment: string }
): Promise<QuestionAnswer> => {
  const data = await request<any>(`/candidates/${candidateId}/feedback`, {
    method: "PATCH",
    body: JSON.stringify({ questionIndex, score: payload.score, comment: payload.comment })
  });

  return {
    questionIndex,
    category: data.question?.category || "Evaluation",
    question: data.question?.text || "Question prompt",
    summary: data.aiSummary || null,
    transcript: data.cleanTranscript || data.rawTranscript || null,
    asked: true,
    score: payload.score,
    comment: payload.comment
  };
};


/* ------------------------------- questions ------------------------------- */

export type CandidateUpdateInput = {
  fullName?: string;
  branch?: string;
  section?: string;
  domains?: string[];
  aacDomain?: string;
  cgpa?: number;
  attendance?: number;
};

export const updateCandidate = async (id: string, input: CandidateUpdateInput): Promise<Candidate> => {
  const payload: Record<string, string> = {};
  if (input.fullName !== undefined) payload.name = input.fullName;
  if (input.branch !== undefined || input.section !== undefined) {
    // We need both for branchAndSection — fetch current if only one provided
    payload.branchAndSection = `${input.branch ?? ""} - ${input.section ?? ""}`;
  }
  if (input.domains !== undefined) payload.domainsAppliedFor = input.domains.join(", ");
  if (input.aacDomain !== undefined) payload.domainInAAC = input.aacDomain;
  if (input.cgpa !== undefined) payload.cgpa = String(input.cgpa);
  if (input.attendance !== undefined) payload.currentAttendance = `${input.attendance}%`;

  const data = await request<any>(`/candidates/${id}`, {
    method: "PATCH",
    body: JSON.stringify(payload)
  });
  return mapBackendCandidate(data);
};


export const fetchQuestions = async (): Promise<QuestionTemplate[]> => {
  try {
    const data = await request<any[]>("/questions");
    if (Array.isArray(data) && data.length > 0) {
      return data.map((q, i) => ({
        index: q.qNumber || i + 1,
        category: q.category || "General",
        prompt: q.text || q.prompt || ""
      }));
    }
  } catch (err) {
    console.warn("Using default question bank:", err);
  }

  return [
    { index: 1, category: "Background & Overview", prompt: "Name, introduce yourself, and academic background." },
    { index: 2, category: "Project & Strategy", prompt: "What is your problem statement and aim?" },
    { index: 3, category: "Project & Strategy", prompt: "What is your approach/implementation plan?" },
    { index: 4, category: "Domain Technical", prompt: "Basic questions on your domain concepts." },
    { index: 5, category: "Data Structures & Ideation", prompt: "DSA question and basic problem solving." },
    { index: 6, category: "Training & Development", prompt: "What did you understand about training and development?" },
    { index: 7, category: "Career Vision & Tech Role", prompt: "What do you think YOU will do in tech?" },
    { index: 8, category: "AAC Focus Area", prompt: "What area in AAC are you interested in?" },
    { index: 9, category: "Domain Spontaneity", prompt: "Spontaneous question based on your domain." },
    { index: 10, category: "Logistics & Availability", prompt: "Are you able to stay after hours for project work?" },
    { index: 11, category: "Mentorship & Leadership", prompt: "Are you interested in becoming a mentor?" },
    { index: 12, category: "Behavioral & Soft Skills", prompt: "Behavioural question: Describe a challenge navigated." }
  ];
};

export const upsertQuestion = async (question: QuestionTemplate): Promise<QuestionTemplate> => {
  const data = await request<any>("/questions", {
    method: "POST",
    body: JSON.stringify({
      qNumber: question.index,
      category: question.category,
      text: question.prompt
    })
  });
  return {
    index: data.qNumber || question.index,
    category: data.category || question.category,
    prompt: data.text || question.prompt
  };
};

/* --------------------------------- admin --------------------------------- */

export const getExcelExportUrl = (candidateId?: string) =>
  `${API_BASE_URL}/export.xlsx${candidateId ? `?candidateId=${candidateId}` : ""}`;

export const resetDatabase = async (password: string): Promise<{ ok: boolean }> => {
  const data = await request<any>("/settings/reset-database", {
    method: "POST",
    body: JSON.stringify({ password })
  });
  return { ok: Boolean(data.success) };
};

// Keep legacy export for backward compat
export const uploadFullSessionRecording = async (
  candidateId: string,
  blob: Blob,
  durationSec: number
): Promise<UploadResult> => {
  let sessionId: string;
  try {
    const sess = await request<any>("/sessions", {
      method: "POST",
      body: JSON.stringify({ candidateId, interviewer: "Lead Interviewer" })
    });
    sessionId = sess.id;
  } catch {
    sessionId = candidateId;
  }

  const form = new FormData();
  form.append("audio", blob, `full_interview_${candidateId}_${Date.now()}.webm`);
  form.append("durationSec", String(durationSec));
  form.append("candidateId", candidateId);

  const data = await request<any>(`/sessions/${sessionId}/full-recording`, {
    method: "POST",
    body: form
  });

  const updatedCand = mapBackendCandidate(data.candidate || data);
  return {
    recordingId: data.id || `rec_${Date.now()}`,
    answers: updatedCand.answers
  };
};
