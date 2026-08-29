export type TakeStatus = "idle" | "recording" | "uploading" | "transcribing" | "done";

export type Answer = {
  status: TakeStatus;
  summary?: string;
  transcript?: string;
  insights?: string;
  duration?: number;
  audioUrl?: string;
  recordedAt?: string;
};

export type Candidate = {
  id: string;
  name: string;
  role: string;
  department: string;
  email: string;
  dateAdded: string;
  notes: string;
  sessions: number;
  fullAudioUrl?: string;
  fullDuration?: number;
  answers: Record<string, Answer>;
};

export type Settings = {
  groqKey: string;
  geminiKey: string;
  cloudName: string;
  summaryModel: string;
};

export type CandidateStatus = "Not Started" | "In Progress" | "Completed";
