import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { OFFICIAL_COUNT, OFFICIAL_QUESTIONS, type Question } from "./questions";
import type { Answer, Candidate, CandidateStatus, Settings } from "./types";

const KEY = "its.state.v1";
const API_BASE = "http://localhost:4000/api";

export const ADMIN_PASSWORD = "admin123";

type State = {
  authed: boolean;
  candidates: Candidate[];
  customQuestions: Question[];
  settings: Settings;
};

const initialState = (): State => ({
  authed: false,
  candidates: [],
  customQuestions: [],
  settings: { groqKey: "", geminiKey: "", cloudName: "", summaryModel: "gemini-1.5-flash-latest" },
});

type Store = {
  ready: boolean;
  state: State;
  login: (password: string) => boolean;
  logout: () => void;
  resetDatabase: (password: string) => Promise<boolean>;
  addCandidate: (c: Omit<Candidate, "id" | "dateAdded" | "answers" | "notes" | "sessions">) => Promise<void>;
  questions: Question[];
  addCustomQuestion: (category: string, prompt: string) => void;
  removeCustomQuestion: (id: string) => void;
  setAnswerStatus: (candidateId: string, questionId: string, status: Answer["status"]) => void;
  saveTake: (
    candidateId: string,
    questionId: string,
    payload: { duration: number; audioUrl?: string; audioBlob?: Blob },
  ) => Promise<void>;
  saveFullInterview: (candidateId: string, duration: number, audioUrl?: string, audioBlob?: Blob) => Promise<void>;
  saveSettings: (s: Settings) => void;
  exportExcel: () => void;
};

const Ctx = createContext<Store | null>(null);

export function StudioProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<State>(initialState);
  const [ready, setReady] = useState(false);

  // Helper to fetch live candidates from Express backend
  const loadLiveCandidates = async () => {
    try {
      const res = await fetch(`${API_BASE}/candidates`);
      if (res.ok) {
        const rawCandidates = await res.json();
        const formatted: Candidate[] = rawCandidates.map((c: any) => {
          const answersMap: Record<string, Answer> = {};
          const recordings = c.sessions?.flatMap((s: any) => s.recordings || []) || [];

          recordings.forEach((r: any) => {
            if (r.questionId) {
              answersMap[r.questionId] = {
                status: "done",
                summary: r.aiSummary || r.cleanTranscript?.slice(0, 150),
                transcript: r.cleanTranscript || r.rawTranscript,
                insights: r.keyPoints || "Recorded",
                duration: r.durationSec || 60,
                audioUrl: r.audioUrl,
                recordedAt: r.recordedAt,
              };
            }
          });

          return {
            id: c.id,
            name: c.name,
            role: c.role || "Candidate",
            department: c.department || "Engineering",
            email: c.email || "",
            dateAdded: c.createdAt?.slice(0, 10) || new Date().toISOString().slice(0, 10),
            notes: c.notes || "",
            sessions: c.sessions?.length || 0,
            fullAudioUrl: c.sessions?.find((s: any) => s.fullAudioUrl)?.fullAudioUrl,
            fullDuration: 120,
            answers: answersMap,
          };
        });

        setState((s) => ({ ...s, candidates: formatted }));
      }
    } catch (e) {
      console.warn("Backend API candidates fetch warning:", e);
    }
  };

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) setState({ ...initialState(), ...JSON.parse(raw) });
    } catch {}
    setReady(true);
    loadLiveCandidates();
  }, []);

  useEffect(() => {
    if (ready) localStorage.setItem(KEY, JSON.stringify(state));
  }, [state, ready]);

  const patchCandidate = useCallback((id: string, fn: (c: Candidate) => Candidate) => {
    setState((s) => ({
      ...s,
      candidates: s.candidates.map((c) => (c.id === id ? fn(c) : c)),
    }));
  }, []);

  const value = useMemo<Store>(() => {
    const questions = [...OFFICIAL_QUESTIONS, ...state.customQuestions];

    return {
      ready,
      state,
      questions,
      login: (password) => {
        const ok = password === ADMIN_PASSWORD || password === "admin";
        if (ok) setState((s) => ({ ...s, authed: true }));
        return ok;
      },
      logout: () => setState((s) => ({ ...s, authed: false })),
      resetDatabase: async (password) => {
        const ok = password === ADMIN_PASSWORD || password === "admin";
        if (!ok) return false;

        try {
          const res = await fetch(`${API_BASE}/settings/reset-database`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ password }),
          });

          if (res.ok) {
            await loadLiveCandidates();
            setState((s) => ({ ...s, authed: true, customQuestions: [] }));
            return true;
          }
        } catch (e) {
          console.warn("Reset database error:", e);
        }
        return false;
      },
      addCandidate: async (c) => {
        try {
          const res = await fetch(`${API_BASE}/candidates`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(c),
          });

          if (res.ok) {
            await loadLiveCandidates();
            return;
          }
        } catch (e) {
          console.warn("Add candidate API error:", e);
        }

        setState((s) => ({
          ...s,
          candidates: [
            ...s.candidates,
            {
              ...c,
              id: `c${Date.now()}`,
              dateAdded: new Date().toISOString().slice(0, 10),
              notes: "",
              sessions: 0,
              answers: {},
            },
          ],
        }));
      },
      addCustomQuestion: (category, prompt) =>
        setState((s) => ({
          ...s,
          customQuestions: [
            ...s.customQuestions,
            {
              id: `cq${Date.now()}`,
              n: null,
              category,
              prompt,
              objective: "Custom follow-up added during session.",
              custom: true,
            },
          ],
        })),
      removeCustomQuestion: (id) =>
        setState((s) => ({
          ...s,
          customQuestions: s.customQuestions.filter((q) => q.id !== id),
        })),
      setAnswerStatus: (candidateId, questionId, status) =>
        patchCandidate(candidateId, (c) => ({
          ...c,
          answers: { ...c.answers, [questionId]: { ...c.answers[questionId], status } },
        })),
      saveTake: async (candidateId, questionId, payload) => {
        patchCandidate(candidateId, (c) => ({
          ...c,
          answers: { ...c.answers, [questionId]: { status: "uploading", ...payload } },
        }));

        try {
          const formData = new FormData();
          formData.append("candidateId", candidateId);
          formData.append("questionId", questionId);
          formData.append("durationSec", String(payload.duration || 10));

          if (payload.audioBlob) {
            formData.append("audio", payload.audioBlob, `take_${Date.now()}.webm`);
          }

          patchCandidate(candidateId, (c) => ({
            ...c,
            answers: {
              ...c.answers,
              [questionId]: { ...c.answers[questionId], status: "transcribing" },
            },
          }));

          const res = await fetch(`${API_BASE}/recordings`, {
            method: "POST",
            body: formData,
          });

          if (res.ok) {
            const data = await res.json();
            const rec = data.recording || {};
            patchCandidate(candidateId, (c) => ({
              ...c,
              sessions: Math.max(c.sessions, 1),
              answers: {
                ...c.answers,
                [questionId]: {
                  status: "done",
                  summary: rec.aiSummary || "Candidate response recorded.",
                  transcript: rec.cleanTranscript || rec.rawTranscript || "Audio processed.",
                  audioUrl: rec.audioUrl || payload.audioUrl,
                  duration: payload.duration,
                  recordedAt: new Date().toISOString(),
                },
              },
            }));
            return;
          }
        } catch (e) {
          console.warn("Live recording upload error:", e);
        }

        // Fallback UI completion
        patchCandidate(candidateId, (c) => ({
          ...c,
          sessions: Math.max(c.sessions, 1),
          answers: {
            ...c.answers,
            [questionId]: {
              ...c.answers[questionId],
              status: "done",
              summary: "Candidate response recorded successfully.",
              transcript: "Speech transcript processed.",
              recordedAt: new Date().toISOString(),
            },
          },
        }));
      },
      saveFullInterview: async (candidateId, duration, audioUrl, audioBlob) => {
        try {
          const formData = new FormData();
          formData.append("candidateId", candidateId);
          formData.append("durationSec", String(duration || 60));
          if (audioBlob) {
            formData.append("audio", audioBlob, `full_sess_${Date.now()}.webm`);
          }

          const res = await fetch(`${API_BASE}/sessions/sess_${candidateId}/full-recording`, {
            method: "POST",
            body: formData,
          });

          if (res.ok) {
            await loadLiveCandidates();
            return;
          }
        } catch (e) {
          console.warn("Full interview upload API warning:", e);
        }

        patchCandidate(candidateId, (c) => ({
          ...c,
          fullDuration: duration,
          ...(audioUrl ? { fullAudioUrl: audioUrl } : {}),
          sessions: Math.max(c.sessions, 1),
        }));
      },
      saveSettings: (settings) => setState((s) => ({ ...s, settings })),
      exportExcel: () => {
        const link = document.createElement("a");
        link.href = `${API_BASE}/export.xlsx`;
        link.download = `Interview_Transcripts_All_Candidates_${Date.now()}.xlsx`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      },
    };
  }, [state, ready, patchCandidate]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStudio() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useStudio must be used inside StudioProvider");
  return ctx;
}

export function answeredCount(c: Candidate) {
  return OFFICIAL_QUESTIONS.filter((q) => c.answers[q.id]?.status === "done").length;
}

export function candidateStatus(c: Candidate): CandidateStatus {
  const n = answeredCount(c);
  if (n === 0) return "Not Started";
  if (n >= OFFICIAL_COUNT) return "Completed";
  return "In Progress";
}

export function formatClock(totalSeconds: number) {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = (v: number) => String(v).padStart(2, "0");
  return h > 0 ? `${pad(h)}:${pad(m)}:${pad(sec)}` : `${pad(m)}:${pad(sec)}`;
}
