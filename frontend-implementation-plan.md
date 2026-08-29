# Frontend Implementation Plan — Interview Tracker

Companion to `implementation-plan.md` (backend/DB). This covers the React
frontend: UX flow, file structure, and a setup prompt you can hand to a
coding assistant to scaffold it.

Open `ui-mockup.html` alongside this — it's a clickable prototype of the
three screens described below (use the "MOCKUP VIEW" buttons at the top
to jump between them).

---

## 1. UX flow

```
 /login  ──sign in──▶  /candidates  ──select──▶  /session/:id  ──finish──▶  /candidates
                          ▲                                                    │
                          └────────────────────────────────────────────────────┘
```

- **Login** — single shared password, no username. Failed attempts show
  an inline error under the field, never a browser alert.
- **Candidates (dashboard)** — the default landing page after login.
  Every candidate is a card: name, role, status pill (Not started / In
  progress / Complete), a one-line meta ("5 of 8 questions · 6
  recordings"), and one action button whose label matches the state
  (Start session / Resume session / View summary). "+ Add candidate"
  opens a small inline form, not a separate page.
- **Session** — the working view during an interview. Header shows the
  candidate, a running recording count, and a prominent "Finish interview
  & save" button (top right, always visible, no scrolling to find it).
  Below: the question list, each showing category, take count, an inline
  "Record" toggle, and an expandable take history. A pinned input at the
  bottom adds a custom question to the shared bank without leaving the
  page.
- **Finish & save** sets the session status to Complete and routes back
  to the dashboard, where that candidate's card now shows the updated
  status immediately — no refresh needed.

## 2. Visual language

Carried over from the earlier transcriber build for consistency across
the whole product:

| Token | Value | Use |
|---|---|---|
| `--bg` | `#141821` | page background |
| `--panel` | `#1B2130` | cards, top bar |
| `--panel-2` | `#212940` | inputs, nested surfaces |
| `--line` | `#2C3448` | borders/dividers |
| `--amber` | `#E8A33D` | primary brand accent, "in progress" state |
| `--teal` | `#4FB6A6` | success / complete / primary actions |
| `--red` | `#E15B5B` | recording indicator |
| `--muted` | `#838C9E` | secondary text |

Type: `IBM Plex Sans` for UI text, `JetBrains Mono` for labels, statuses,
timestamps, and anything data-like — keeps the "console" feel from the
original transcriber tool.

## 3. React file structure

```
frontend/
├── index.html
├── vite.config.js
├── src/
│   ├── main.jsx
│   ├── App.jsx                    # router setup
│   ├── api/
│   │   ├── client.js               # fetch wrapper, attaches session cookie
│   │   ├── candidates.js
│   │   ├── questions.js
│   │   ├── sessions.js
│   │   └── recordings.js
│   ├── auth/
│   │   ├── AuthContext.jsx         # holds logged-in state
│   │   └── RequireAuth.jsx         # route guard, redirects to /login
│   ├── pages/
│   │   ├── Login.jsx
│   │   ├── Dashboard.jsx           # candidates list
│   │   └── Session.jsx             # single candidate's active session
│   ├── components/
│   │   ├── CandidateCard.jsx
│   │   ├── StatusPill.jsx
│   │   ├── QuestionItem.jsx        # question row + takes + record button
│   │   ├── RecordButton.jsx        # MediaRecorder wrapper + stage status
│   │   └── AddCandidateForm.jsx
│   ├── styles/
│   │   └── tokens.css              # the palette table above, as CSS vars
│   └── hooks/
│       └── useRecorder.js          # mic capture + upload logic
└── package.json
```

## 4. Routing & auth

- `react-router-dom` with three routes: `/login`, `/candidates`,
  `/session/:sessionId`.
- `RequireAuth` wraps `/candidates` and `/session/:id` — checks a
  `GET /api/auth/me` call on mount; redirects to `/login` on 401.
- Session cookie is `httpOnly`, so the frontend never touches the
  password after login — it just relies on the cookie being sent
  automatically by the browser on every request.

## 5. Recording UX detail

`RecordButton` cycles through four visible states so a slow local
Whisper pass never looks broken: **Idle → Recording → Uploading →
Transcribing → Done**. Each state swaps the button label and disables
re-clicking mid-flight. On completion, the new take appears in that
question's take list without a page reload (optimistic UI: add it
immediately, replace with the real transcript when the backend
responds).

---

## 6. Setup prompt

Paste this into Claude Code (or any coding agent) once you're ready to
start generating the actual project:

```
Build a self-hosted interview tracking web app with a Node.js/Express
backend and a React (Vite) frontend, following the plans below exactly.

BACKEND
- Express + Prisma ORM + SQLite
- Shared-password auth: one password (from Settings table, hashed),
  session cookie (httpOnly) gates every route except /api/auth/login
- Prisma schema: Settings, Candidate, Question, Session, Recording
  (see implementation-plan.md section 4 for exact fields)
- Routes: candidates, questions, sessions, recordings (multipart audio
  upload), settings, and GET /api/export.xlsx
- Recording upload pipeline: save audio to Cloudinary (cloudinary npm
  package, credentials from .env), send the same audio to a
  configurable transcription service URL (Settings table) for a raw
  transcript, then send that transcript to a configurable
  OpenAI-compatible LLM endpoint (base URL + API key + model, all from
  Settings table, not hardcoded) asking it to clean up punctuation and
  grammar without changing meaning. Save audioUrl, rawTranscript, and
  cleanTranscript on the Recording row.
- Excel export via exceljs: Summary sheet (one row per candidate),
  Transcripts sheet (one row per recording, including a clickable
  Cloudinary link column), and one sheet per candidate.

TRANSCRIPTION SERVICE
- Separate Python FastAPI service using faster-whisper (model size
  configurable via env var, default "small"), one POST /transcribe
  endpoint accepting an audio file and returning raw text.

FRONTEND
- React + Vite, react-router-dom
- Pages: Login, Dashboard (candidates list), Session (question bank +
  recording UI for one candidate)
- Use the file structure and visual design tokens below exactly.
- Recording button cycles through Idle / Recording / Uploading /
  Transcribing / Done states with optimistic UI updates.

[paste the "React file structure" and "Visual language" sections from
frontend-implementation-plan.md here, plus the Database schema section
from implementation-plan.md]

Build the backend and database first, verify the transcription service
works standalone via curl, then build the frontend against the working
API.
```

Fill in the two bracketed sections by pasting the relevant tables from
this file and `implementation-plan.md` — that gives the agent the exact
schema and design tokens instead of re-deriving them.
