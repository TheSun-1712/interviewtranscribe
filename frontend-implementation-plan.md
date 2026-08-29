# Frontend Implementation Plan & UI Architecture Blueprint

Companion setup and design specification for the **Interview Transcriber Studio** React frontend. It details the complete file structure, screen-by-screen component hierarchy, exact UI elements (buttons, modals, inputs, indicators), visual design tokens, and a developer setup prompt.

---

## 1. User Experience (UX) Flow & Route Hierarchy

```
  /login  ───── [ Password Auth ] ─────▶  /candidates (Roster Dashboard)
                                                  │
                                                  ├──▶ Start / Resume Session ──▶ /session/:id
                                                  ├──▶ Export All Candidates Excel (Multi-Tab)
                                                  ├──▶ Reset Database Modal (Admin Password)
                                                  └──▶ + Add Candidate Inline Form
```

### Screen Breakdown:

1. **Login Screen (`/login`)**:
   * Shared admin password input (default: `admin123`).
   * Animated audio waveform visualizer header (`SIGNAL / ADMIN ACCESS`).
   * Inline error message display (no browser popup alerts).

2. **Candidates Dashboard Screen (`/candidates`)**:
   * Top navigation bar with logo, active tab links, **"Export All Candidates Excel"** button, **"Reset Database"** button, and **"Logout"** button.
   * Roster cards displaying candidate name, role, department, status pill (`Not Started`, `In Progress`, `Completed`), questions completed counter (`x of 12`), and context-sensitive action button (`Start Session` / `Resume Session` / `View Summary`).
   * Inline **"+ Add Candidate"** expandable form with name, role, department, and email inputs.
   * **Password-Protected Database Reset Modal**: Confirmation dialog requiring admin password to wipe test database and re-seed 12 official questions.

3. **Interview Session Screen (`/session/:id`)**:
   * Header bar with candidate metadata, department, back button, and interview progress bar (`x of 12 questions`).
   * **Continuous Full-Interview Recorder Bar**: Prominent `"🎙️ Start Full Interview Rec"` button with live timer and status (`Idle → Recording → Uploading → Transcribing → Done`).
   * **Question Roster (Questions 1 to 12)**: List of official interview questions grouped by category.
   * **Per-Question Record Button**: Individual question audio recorder.
   * **Executive AI Summary Card**: 1-2 sentence AI summary of candidate's answer with interviewer questions stripped out.
   * **Expandable Spoken Transcript Panel**: View full clean candidate answer.
   * **Pinned Custom Question Bar**: Bottom input bar to insert spontaneous questions on-the-fly.

4. **Question Bank Administrator Screen (`/questions`)**:
   * View and manage all pre-decided questions grouped across 11 categories.
   * Add custom question form and delete custom question buttons.

5. **Settings Screen (`/settings`)**:
   * Groq API Key input, Gemini API Key input, Cloudinary Cloud Name input, and Save button.

---

## 2. Visual Design System & CSS Tokens

Carried across the application in `src/index.css`:

| CSS Token | Hex Value | Application UI Element |
|---|---|---|
| `--bg` | `#141821` | Overall app background |
| `--panel` | `#1B2130` | Cards, topbar, modal popups, headers |
| `--panel-2` | `#212940` | Inputs, nested cards, inner containers |
| `--line` | `#2C3448` | Borders, dividers, table grid lines |
| `--amber` | `#E8A33D` | Primary brand accent, `In Progress` status pill |
| `--teal` | `#4FB6A6` | Primary action buttons (`Export Excel`), `Completed` status pill |
| `--red` | `#E15B5B` | Active recording pulse ring, `Reset Database` danger button |
| `--muted` | `#838C9E` | Subtitles, captions, timestamps, secondary labels |

### Typography:
* **UI & Body Text**: `IBM Plex Sans`
* **Data, Timestamps, Status Pills, Code**: `JetBrains Mono`

---

## 3. React File & Directory Structure

```
src/
├── index.css                          # Visual design tokens & base typography resets
├── main.jsx                           # Application entry point
├── App.jsx                            # View router, active state, modal handlers
├── components/
│   ├── LoginView.jsx                  # Shared password login panel & audio equalizer
│   ├── CandidateList.jsx              # Roster dashboard, topbar, Reset DB modal, Add form
│   ├── SessionView.jsx                # Interview recording studio, full recorder, Q1-Q12 bank
│   ├── RecordButton.jsx               # Audio recorder button state machine (Idle -> Saved)
│   ├── QuestionManager.jsx            # Category question list administrator
│   └── SettingsView.jsx               # API key & Cloudinary configuration
├── services/
│   └── api.js                         # Axios/Fetch API client wrapper for Express backend
└── utils/
    ├── initialData.js                 # Seed data for 12 official questions & starter candidates
    └── excelExporter.js               # Client-side Excel export fallback helper
```

---

## 4. Component & UI Element Specification

### 1. `LoginView.jsx`
* **UI Elements**:
  * Centered `#1B2130` panel card with subtle border.
  * Audio Waveform Equalizer graphic (animated audio meters).
  * Password Input (`type="password"`).
  * "Sign In" Button (`bg-[var(--amber)]`).
  * Inline Error Alert Banner (`"Invalid admin password"`).

### 2. `CandidateList.jsx`
* **Topbar Header**:
  * App Title: `INTERVIEW TRANSCRIBER STUDIO`.
  * **"Export All Candidates Excel" Button**: Calls `onExportExcel("all")` to download multi-tab workbook.
  * **"Reset Database" Button**: Red button opening password modal.
  * **"Logout" Button**: Clears user session.
* **Candidate Roster Grid**:
  * Grid of Candidate Cards showing Name, Role, Department, Date Added.
  * Status Pill (`Not Started` outline, `In Progress` amber, `Completed` teal).
  * Questions Counter (`"x of 12 questions completed"`).
  * Action Button: `"Start Session"` / `"Resume Session"` / `"View Summary"`.
* **Inline Add Candidate Form**:
  * Expandable card with `Name`, `Role`, `Department`, `Email` inputs.
  * `"Save Candidate"` and `"Cancel"` buttons.
* **Database Reset Modal**:
  * Backdrop overlay.
  * Warning Text: `"Are you sure you want to reset the database? All recordings will be cleared."`
  * Admin Password Input.
  * `"Confirm Reset"` (Red button) and `"Cancel"` buttons.

### 3. `SessionView.jsx`
* **Session Header Card**:
  * Candidate Name, Role, Department.
  * Back Button (`"← Back to Candidates"`).
  * Interview Progress Bar (`x of 12 completed`).
* **Continuous Full-Interview Bar**:
  * `"🎙️ Start Full Interview Rec"` Button.
  * Live recording duration timer (`00:00`).
  * Status message (`"Recording full interview..."` / `"Transcribing with Groq & Gemini..."`).
* **Question Roster List (Questions 1 to 12)**:
  * Category Header Badge.
  * Question Text (e.g. *Q1: Name, introduce yourself*, *Q2: What is your problem statement*).
  * Embedded `RecordButton`.
  * Executive AI Summary Box (1-2 sentence AI summary of candidate's answer).
  * Clean Spoken Transcript toggle.
* **Pinned Bottom Custom Question Input**:
  * Input field: `"Enter spontaneous custom question..."`.
  * `"+ Add Question"` button.

### 4. `RecordButton.jsx`
* **State Machine**:
  * `idle`: Button displays `"● Record"`.
  * `recording`: Button displays `"● Recording (MM:SS)"` with pulsing red indicator ring.
  * `uploading`: Button displays `"Uploading to Cloudinary..."` (Disabled).
  * `transcribing`: Button displays `"Transcribing with AI..."` (Disabled).
  * `done`: Button displays `"✓ Saved"` (Teal accent).

---

## 5. Developer Setup & Prompt Guide

Hand the following prompt to any developer or AI assistant to scaffold the frontend:

```text
Build the React frontend for the Interview Transcriber Studio using Vite and Vanilla CSS design tokens.

Requirements:
1. Implement the UX flow: Login -> Candidates Dashboard -> Session View -> Question Manager -> Settings.
2. Use the CSS color palette: --bg (#141821), --panel (#1B2130), --panel-2 (#212940), --amber (#E8A33D), --teal (#4FB6A6), --red (#E15B5B).
3. Use IBM Plex Sans for body text and JetBrains Mono for data/status pills.
4. Candidates Dashboard must include:
   - "Export All Candidates Excel" button generating multi-tab Excel workbooks.
   - Red "Reset Database" button with password modal confirmation.
   - Candidate roster grid with status pills (Not Started / In Progress / Completed).
   - Inline "+ Add Candidate" form.
5. Session View must include:
   - Header with Candidate progress bar (x of 12 questions).
   - Continuous Full-Interview Recorder ("🎙️ Start Full Interview Rec") with noise suppression and 128kbps audio capture.
   - Question list covering all 12 official interview questions.
   - Executive AI Summary cards displaying 1-2 sentence summaries of candidate answers.
   - RecordButton cycling through Idle -> Recording -> Uploading -> Transcribing -> Done.
6. Connect all API endpoints to Express backend running at http://localhost:4000.
```
