# Interview Transcribe & Evaluation Platform — 100% Local Setup

> **Fully Local Architecture:**
> - **LLM Analysis & Summaries:** Ollama (`qwen3.5:4b`) running on `localhost:11434`
> - **Speech Transcription:** `faster-whisper` Python FastAPI service running on `localhost:9000`
> - **Audio Storage:** Local disk storage served directly by Express (`backend/uploads/`)
> - **Database:** Local PostgreSQL (`localhost:5432`)
> - **Frontend:** React + Vite (`localhost:5173`)
> - **No 3rd-party APIs, no Groq keys, no Cloudinary account required!**

---

## Prerequisites

| Component | Status / Command |
|---|---|
| **Node.js** (v18+) | `node -v` |
| **PostgreSQL** | Running on port 5432 (`interview_db` created) |
| **Ollama** | Running with `qwen3.5:4b` |
| **Python** (3.10+) | For the local whisper service |

---

## How to Run the Application

You can run the full system using **3 terminals**:

### Terminal 1 — Ollama & Local Whisper (AI Services)

```bash
# Make sure Ollama is running (it usually starts automatically)
ollama run qwen3.5:4b

# In a separate terminal or background, start the faster-whisper service:
cd whisper-service
python main.py
```
> The whisper service will start on `http://localhost:9000`.

### Terminal 2 — Backend Server

```bash
cd backend
node src/index.js
```
> You will see:
> `Backend API running at http://localhost:4000`

### Terminal 3 — Frontend UI

```bash
# From the root directory:
npm run dev
```
> Or to share on the local network with other interviewers:
> `npx vite --host`

---

## Access the App

Open **`http://localhost:5173`** in your browser.

- **Login:** Enter any email & password (e.g. `admin@aac.com` / `password123`).
- **Candidates:** Choose a candidate, select a question, and record audio.
- **Transcripts & AI Summaries:** Processed 100% locally via faster-whisper and Ollama `qwen3.5:4b`.
- **Export:** Click Export to generate the complete Excel assessment spreadsheet.
