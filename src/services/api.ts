/**
 * Centralized HTTP client for the Interview Transcribe & Evaluation backend.
 * Base URL: http://localhost:4000/api
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
  recordingsCount: number;
  answeredCount: number;
  answers: QuestionAnswer[];
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
    ? cand.sessions.flatMap((s: any) => s.recordings || [])
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
  const answers: QuestionAnswer[] = defaultQuestions.map((q) => {
    const matchedRec = candidateRecordings.find(
      (r: any) =>
        r.question?.qNumber === q.index ||
        r.question?.id === `q_${q.index}` ||
        r.questionId === `q_${q.index}`
    ) || candidateRecordings[q.index - 1];

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
    recordingsCount: recCount,
    answeredCount,
    answers
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

/* ------------------------------- recordings ------------------------------ */

export interface UploadResult {
  recordingId: string;
  answers: QuestionAnswer[];
}

export const uploadFullSessionRecording = async (candidateId: string, blob: Blob, durationSec: number): Promise<UploadResult> => {
  // Step 1: create (or reuse) a session for this candidate
  let sessionId: string;
  try {
    const sess = await request<any>("/sessions", {
      method: "POST",
      body: JSON.stringify({ candidateId, interviewer: "Lead Interviewer" })
    });
    sessionId = sess.id;
  } catch {
    // Fallback: use candidateId directly (backend will auto-create candidate lookup)
    sessionId = candidateId;
  }

  // Step 2: upload the full recording audio to the session
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

export const uploadRecordingTake = async (candidateId: string, questionIndex: number, blob: Blob): Promise<UploadResult> => {
  const form = new FormData();
  form.append("audio", blob, `take_${candidateId}_q${questionIndex}.webm`);
  form.append("questionIndex", String(questionIndex));

  const data = await request<any>(`/sessions/${candidateId}/full-recording`, {
    method: "POST",
    body: form
  });

  const updatedCand = mapBackendCandidate(data.candidate || data);
  return {
    recordingId: data.id || `rec_${Date.now()}`,
    answers: updatedCand.answers
  };
};

export const saveFeedback = async (
  candidateId: string,
  questionIndex: number,
  payload: { score: number | null; comment: string }
): Promise<QuestionAnswer> => {
  const data = await request<any>(`/recordings/${candidateId}/feedback`, {
    method: "PATCH",
    body: JSON.stringify({ questionIndex, ...payload })
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
