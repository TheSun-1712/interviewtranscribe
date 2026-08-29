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
import { synthesizeAnswer } from "./transcribe";

const KEY = "its.state.v1";

export const ADMIN_PASSWORD = "admin123";

type State = {
  authed: boolean;
  candidates: Candidate[];
  customQuestions: Question[];
  settings: Settings;
};

const seedCandidate = (
  id: string,
  name: string,
  role: string,
  department: string,
  email: string,
  dateAdded: string,
  answered: number,
): Candidate => {
  const answers: Record<string, Answer> = {};
  OFFICIAL_QUESTIONS.slice(0, answered).forEach((q) => {
    const a = synthesizeAnswer(q.id);
    answers[q.id] = {
      status: "done",
      summary: a.summary,
      transcript: a.transcript,
      insights: a.insights,
      duration: 60 + q.id.length * 7,
      recordedAt: dateAdded,
    };
  });
  return {
    id,
    name,
    role,
    department,
    email,
    dateAdded,
    notes: "",
    sessions: answered > 0 ? 1 : 0,
    answers,
  };
};

const initialState = (): State => ({
  authed: false,
  candidates: [
    seedCandidate(
      "c1",
      "Alex Morgan",
      "Sr. ML Engineer",
      "Platform",
      "alex.morgan@example.com",
      "2024-05-14",
      5,
    ),
    seedCandidate(
      "c2",
      "Priya Nair",
      "Data Scientist",
      "Analytics",
      "priya.nair@example.com",
      "2024-05-16",
      0,
    ),
    seedCandidate(
      "c3",
      "Diego Fuentes",
      "Backend Engineer",
      "Systems",
      "diego.fuentes@example.com",
      "2024-05-09",
      12,
    ),
    seedCandidate(
      "c4",
      "Sofia Lindqvist",
      "Product Manager",
      "Growth",
      "sofia.lindqvist@example.com",
      "2024-05-12",
      9,
    ),
  ],
  customQuestions: [],
  settings: { groqKey: "", geminiKey: "", cloudName: "", summaryModel: "gemini-1.5-flash-latest" },
});

type Store = {
  ready: boolean;
  state: State;
  login: (password: string) => boolean;
  logout: () => void;
  resetDatabase: (password: string) => boolean;
  addCandidate: (c: Omit<Candidate, "id" | "dateAdded" | "answers" | "notes" | "sessions">) => void;
  questions: Question[];
  addCustomQuestion: (category: string, prompt: string) => void;
  removeCustomQuestion: (id: string) => void;
  setAnswerStatus: (candidateId: string, questionId: string, status: Answer["status"]) => void;
  saveTake: (
    candidateId: string,
    questionId: string,
    payload: { duration: number; audioUrl?: string },
  ) => Promise<void>;
  saveFullInterview: (candidateId: string, duration: number, audioUrl?: string) => void;
  saveSettings: (s: Settings) => void;
};

const Ctx = createContext<Store | null>(null);

export function StudioProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<State>(initialState);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) setState({ ...initialState(), ...JSON.parse(raw) });
    } catch {
      /* ignore corrupt state */
    }
    setReady(true);
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
      resetDatabase: (password) => {
        const ok = password === ADMIN_PASSWORD || password === "admin";
        if (ok) setState({ ...initialState(), authed: true });
        return ok;
      },
      addCandidate: (c) =>
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
        })),
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
        await wait(900);
        patchCandidate(candidateId, (c) => ({
          ...c,
          answers: {
            ...c.answers,
            [questionId]: { ...c.answers[questionId], status: "transcribing" },
          },
        }));
        await wait(1400);
        const generated = synthesizeAnswer(questionId);
        patchCandidate(candidateId, (c) => ({
          ...c,
          sessions: Math.max(c.sessions, 1),
          answers: {
            ...c.answers,
            [questionId]: {
              ...c.answers[questionId],
              status: "done",
              ...generated,
              recordedAt: new Date().toISOString(),
            },
          },
        }));
      },
      saveFullInterview: (candidateId, duration, audioUrl) =>
        patchCandidate(candidateId, (c) => ({
          ...c,
          fullDuration: duration,
          ...(audioUrl ? { fullAudioUrl: audioUrl } : {}),
          sessions: Math.max(c.sessions, 1),
        })),
      saveSettings: (settings) => setState((s) => ({ ...s, settings })),
    };
  }, [state, ready, patchCandidate]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStudio() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useStudio must be used inside StudioProvider");
  return ctx;
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

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
