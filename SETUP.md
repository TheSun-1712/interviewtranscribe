# Interview Transcribe & Evaluation Platform — Setup Guide

> **Who this is for:**  
> **Only the one person hosting the backend server** (the team lead / the person whose laptop runs the backend).  
> This entire guide — including API keys, PostgreSQL, and npm install — applies only to them.
>
> **If you are just an interviewer joining a session:**  
> You need none of this. Simply open your browser and go to `http://HOST_LAPTOP_IP:5173`.  
> Ask your host for their laptop's IP address. That's it.

---

## Prerequisites

Install the following on the **host laptop** before starting.

| Tool | Version | Download |
|---|---|---|
| **Node.js** | v18 or newer | https://nodejs.org |
| **Git** | Latest | https://git-scm.com |
| **PostgreSQL** | v14 or newer | https://www.postgresql.org/download |

> **Verify installations** by opening a terminal and running:
> ```bash
> node -v       # should print v18.x.x or higher
> npm -v        # should print 9.x or higher
> git --version # should print git version 2.x
> psql --version # should print psql 14.x or higher
> ```

---

## Step 1 — Clone the Repository

```bash
git clone https://github.com/YOUR_ORG/interview-transcribe.git
cd interview-transcribe
```

> Replace `YOUR_ORG/interview-transcribe` with the actual GitHub repository URL.

---

## Step 2 — Set Up the Database (PostgreSQL)

### 2a. Open the PostgreSQL shell

On Windows, search for **pgAdmin** or open **SQL Shell (psql)** from the Start Menu.  
On Mac/Linux, open a terminal and type `psql -U postgres`.

### 2b. Create the database

```sql
CREATE DATABASE interview_db;
CREATE USER interview_user WITH PASSWORD 'yourpassword';
GRANT ALL PRIVILEGES ON DATABASE interview_db TO interview_user;
\q
```

> You can use any database name, username, and password — just keep note of them for Step 4.

---

## Step 3 — Gather Your API Keys

You need accounts and API keys from the following services. All have free tiers.

### Groq API Key (for Whisper transcription + LLM)
1. Go to https://console.groq.com
2. Sign up / Log in
3. Click **API Keys** → **Create API Key**
4. Copy the key (starts with `gsk_...`)

### Cloudinary Credentials (for audio file storage)
1. Go to https://cloudinary.com
2. Sign up / Log in
3. On the **Dashboard**, you will see your:
   - **Cloud Name**
   - **API Key**
   - **API Secret**
4. Copy all three values

---

## Step 4 — Configure the Backend Environment

```bash
cd backend
```

Create a file called `.env` in the `backend/` folder with the following content:

```env
# PostgreSQL connection string
DATABASE_URL="postgresql://interview_user:yourpassword@localhost:5432/interview_db"

# Cloudinary (audio file storage)
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret

# Groq (transcription + AI analysis)
GROQ_API_KEY=gsk_your_groq_key_here

# Server config
PORT=4000
SESSION_SECRET=any_random_string_here_like_abc123xyz

# Leave these blank unless you have a separate Whisper service
WHISPER_SERVICE_URL=
LLM_BASE_URL=
LLM_API_KEY=
LLM_MODEL=
GEMINI_API_KEY=
```

> WARNING: Never share or commit your `.env` file. It is already listed in `.gitignore`.

---

## Step 5 — Install Backend Dependencies & Run Database Migration

Make sure you are inside the `backend/` folder, then run:

```bash
# Install all backend packages
npm install

# Generate the Prisma database client
npx prisma generate

# Push the database schema to PostgreSQL (creates all tables)
npx prisma db push
```

You should see output like:
```
Generated Prisma Client
Your database is now in sync with your Prisma schema.
```

---

## Step 6 — Install Frontend Dependencies

Open a **new terminal**, go back to the root project folder:

```bash
cd ..          # go back to interview-transcribe root (if you are still in backend/)
npm install
```

---

## Step 7 — Start the Application

You need **two terminals running simultaneously**.

### Terminal 1 — Backend Server
```bash
cd backend
node src/index.js
```

You should see:
```
Backend API running at http://localhost:4000
```

### Terminal 2 — Frontend Dev Server
```bash
# From the project root (interview-transcribe/)
npx vite --host
```

You should see:
```
  VITE v5.4.21  ready in 268 ms

  Local:   http://localhost:5173/
  Network: http://192.168.x.x:5173/    <- share THIS with others on WiFi
```

---

## Step 8 — Log In

Open `http://localhost:5173` in your browser.

On the login screen, enter **any email and password** — the authentication is panel-local (no account creation needed, any credentials work).

> Example: `admin@panel.com` / `password123`

---

## Multi-User Setup (Multiple Interviewers on Same WiFi)

For other interviewers to join **without any setup on their laptops**:

1. Find your laptop's local IP address:
   - **Windows:** Open Command Prompt, type `ipconfig`, look for **IPv4 Address** (e.g. `192.168.1.5`)
   - **Mac/Linux:** Open Terminal, type `ifconfig` or `ip addr`

2. Share this URL with the other interviewers:
   ```
   http://192.168.1.5:5173
   ```
   Replace `192.168.1.5` with your actual IP.

3. They open that URL in their browser, log in, pick a candidate, and start interviewing.

> All API calls, Cloudinary uploads, and AI transcription run on the host laptop only.
> Other interviewers just use the browser — no API keys, no Node.js, nothing to install.

---

## Quick Reference — Daily Usage

| What to do | Command |
|---|---|
| Start backend | `cd backend && node src/index.js` |
| Start frontend | `npx vite --host` (from project root) |
| View the database | `npx prisma studio` (from `backend/`) |
| Re-sync DB after schema changes | `npx prisma db push` (from `backend/`) |

---

## Troubleshooting

### "Cannot connect to database"
- Make sure PostgreSQL is running (search pgAdmin on Windows or run `sudo service postgresql start` on Linux)
- Double-check the `DATABASE_URL` in your `.env` — username, password, and database name must match exactly what you created in Step 2

### "Microphone access blocked"
- Make sure you opened the site via `http://` — microphone access works on localhost without HTTPS
- Check your browser's camera/microphone permissions (click the lock icon in the address bar)

### "Port 4000 already in use"
- Another process is using port 4000. Either stop it, or change `PORT=4001` in your `.env`

### "Excel export is blank"
- The candidate must have a completed interview session (click "Save & End Interview" after recording)
- The AI transcription may still be processing — wait 30 to 60 seconds after saving, then export again

### Frontend shows old UI after changes
- Hard refresh: `Ctrl + Shift + R` (Windows) or `Cmd + Shift + R` (Mac)

---

## Project Structure (for reference)

```
interview-transcribe/
├── backend/                  <- Express + Prisma backend
│   ├── src/
│   │   ├── index.js          <- Main server entry point
│   │   ├── routes/           <- API route handlers
│   │   └── services/         <- Cloudinary, Groq, LLM services
│   ├── prisma/
│   │   └── schema.prisma     <- Database schema
│   ├── uploads/              <- Temporary audio file storage
│   └── .env                  <- Your secret keys (never commit this)
│
├── src/                      <- React frontend (Vite + TanStack Router)
│   ├── components/           <- UI components
│   ├── routes/               <- Page routes
│   ├── services/api.ts       <- Frontend API client
│   └── styles.css            <- Design system
│
├── index.html                <- Frontend entry point
└── package.json              <- Frontend dependencies
```
