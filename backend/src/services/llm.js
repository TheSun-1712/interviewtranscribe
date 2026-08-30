const fetch = require("node-fetch");
const { stripFillerWords, smartClassifyTranscript } = require("./heuristicClassifier");

/**
 * Universal LLM Request Helper with Fast Failover & Timeouts
 * Tier 1: Groq Cloud GPT-OSS (openai/gpt-oss-20b) — Lightning fast (~400ms)
 * Tier 2: Google Gemini 3.6 Flash (gemini-3.6-flash) — Fallback with 6s timeout
 * Tier 3: Smart Local Heuristic Search Classifier (0ms offline safety net)
 */
async function callLLM(systemPrompt, userPrompt, settings = {}, temperature = 0.1) {
  const geminiKey = settings.geminiApiKey || process.env.GEMINI_API_KEY || "";
  const groqKey = settings.groqApiKey || process.env.GROQ_API_KEY || "";

  // -------------------------------------------------------------
  // TIER 1: GROQ CLOUD OPENAI/GPT-OSS-20B (FAST: ~400ms)
  // -------------------------------------------------------------
  if (groqKey && groqKey.startsWith("gsk_")) {
    try {
      console.log("[LLM Service] Tier 1: Calling Groq (openai/gpt-oss-20b)...");
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${groqKey}`
        },
        body: JSON.stringify({
          model: "openai/gpt-oss-20b",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt }
          ],
          temperature: temperature
        }),
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      if (response.ok) {
        const data = await response.json();
        const text = data.choices?.[0]?.message?.content?.trim();
        if (text) {
          console.log("[Groq GPT-OSS-20B Success] Fast summary generated.");
          return stripFillerWords(text);
        }
      } else {
        const errTxt = await response.text();
        console.warn(`[Groq GPT-OSS Error ${response.status}]:`, errTxt);
      }
    } catch (err) {
      console.warn("[Groq Exception/Timeout]:", err.message);
    }
  }

  // -------------------------------------------------------------
  // TIER 2: GOOGLE GEMINI 3.6 FLASH (6s TIMEOUT FALLBACK)
  // -------------------------------------------------------------
  if (geminiKey) {
    try {
      console.log("[LLM Service] Tier 2: Calling Google Gemini Flash (gemini-3.6-flash)...");
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 6000);

      const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${geminiKey}`;

      const response = await fetch(geminiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              role: "user",
              parts: [{ text: `${systemPrompt}\n\n${userPrompt}` }]
            }
          ],
          generationConfig: {
            temperature: temperature
          }
        }),
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      if (response.ok) {
        const data = await response.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
        if (text) {
          console.log("[Gemini Flash Success] Output generated cleanly.");
          return stripFillerWords(text);
        }
      } else {
        const errTxt = await response.text();
        console.warn(`[Gemini API Error ${response.status}]:`, errTxt);
      }
    } catch (err) {
      console.warn("[Gemini API Exception/Timeout]:", err.message);
    }
  }

  return null;
}

/**
 * PASS 1: Speaker Diarization ([INTERVIEWER] vs [CANDIDATE])
 */
async function diarizeAndCleanTranscript(rawTranscript, settings = {}) {
  if (!rawTranscript || !rawTranscript.trim()) return "";
  const cleanedInput = stripFillerWords(rawTranscript);

  const systemPrompt = `You are an expert interview speaker diarization AI.
You are given a raw continuous transcript of an interview containing two speakers: the Interviewer (asking questions) and the Candidate (answering in English).

TASK:
Rewrite the transcript into a structured conversation script in clean English, separating Interviewer questions from Candidate answers.
STRICTLY REMOVE all speech disfluencies and filler words like 'uhm', 'so yeah', 'basically', 'like', 'you know', 'actually'.

FORMAT:
[INTERVIEWER]: <Interviewer question or prompt in English>
[CANDIDATE]: <Candidate spoken response in clean English>`;

  const userPrompt = `Raw Continuous Interview Transcript:\n"${cleanedInput}"\n\nDiarized Conversation Script:`;
  const result = await callLLM(systemPrompt, userPrompt, settings, 0.1);
  return result || cleanedInput;
}

/**
 * Clean raw transcript by removing interviewer questions and speech disfluencies
 */
async function cleanTranscriptWithLLM(rawTranscript, settings = {}) {
  if (!rawTranscript || !rawTranscript.trim()) return "";
  const initialClean = stripFillerWords(rawTranscript);

  const diarized = await diarizeAndCleanTranscript(initialClean, settings);

  const candidateLines = diarized
    .split("\n")
    .filter((line) => line.startsWith("[CANDIDATE]:"))
    .map((line) => stripFillerWords(line.replace("[CANDIDATE]:", "").trim()))
    .filter(Boolean);

  if (candidateLines.length > 0) {
    return candidateLines.join("\n\n");
  }

  return initialClean;
}

/**
 * Generate a concise 1-2 sentence executive AI summary of ONLY candidate response in English
 */
async function summarizeCandidateResponse(rawTranscript, questionText = "", settings = {}) {
  if (!rawTranscript || !rawTranscript.trim()) return "No response recorded";
  const cleanInput = stripFillerWords(rawTranscript);

  const systemPrompt = `You are an executive hiring manager assistant.
Analyze the provided transcript segment and write a concise 1 to 2 sentence executive summary of ONLY the candidate's core answer in professional English.

RULES:
1. Summarize candidate's core skills, experience, project approach, or background in clean English.
2. DO NOT mention or quote the interviewer's question.
3. Exclude all speech filler words ('uhm', 'so yeah', 'basically').`;

  const userPrompt = `Target Question: "${questionText}"\n\nTranscript Segment:\n"${cleanInput}"\n\nConcise Executive AI Summary in English:`;
  const summary = await callLLM(systemPrompt, userPrompt, settings, 0.2);

  return summary || (cleanInput.length > 180 ? cleanInput.slice(0, 180) + "..." : cleanInput);
}

/**
 * Divide and categorize interview Q&A list with LLM
 */
async function divideAndCategorizeInterviewWithLLM(QandAList, settings = {}) {
  if (!QandAList || QandAList.length === 0) return QandAList;

  for (let i = 0; i < QandAList.length; i++) {
    const item = QandAList[i];
    if (item.transcript && !item.transcript.includes("[No response]")) {
      const candidateOnly = await cleanTranscriptWithLLM(item.transcript, settings);
      const summary = await summarizeCandidateResponse(candidateOnly || item.transcript, item.questionText, settings);
      item.aiSummary = summary;
      item.transcript = candidateOnly || item.transcript;
    } else {
      item.aiSummary = "Question not asked / No response recorded";
      item.keyTakeaways = "N/A";
    }
  }

  return QandAList;
}

/**
 * TWO-PASS Full Continuous Interview Analyzer:
 * Pass 1: Speaker Diarization ([INTERVIEWER] vs [CANDIDATE]).
 * Pass 2: Question-by-Question Section Segmenter & Executive Summarizer in English.
 * Fallback: Smart Local Heuristic Search Classifier (0ms safety net).
 */
async function parseAndDivideFullInterviewWithLLM(fullTranscriptText, questionsList = [], settings = {}) {
  if (!fullTranscriptText || !fullTranscriptText.trim()) {
    return questionsList.map((q, idx) => ({
      questionId: q.id,
      qNumber: idx + 1,
      category: q.category || "General",
      questionText: q.text,
      aiSummary: "Question not asked in session",
      keyTakeaways: "N/A",
      candidateAnswerOnly: "[Not answered in this session]"
    }));
  }

  const cleanFullTranscript = stripFillerWords(fullTranscriptText);

  console.log("[LLM Pipeline] Step 1: Running Speaker Diarization...");
  const diarizedScript = await diarizeAndCleanTranscript(cleanFullTranscript, settings);

  const questionTemplates = questionsList.map((q, idx) => ({
    qNumber: idx + 1,
    questionId: q.id,
    questionText: q.text,
    category: q.category || "General"
  }));

  const systemPrompt = `You are a senior executive interview analysis AI.
You are given a Diarized Interview Script containing [INTERVIEWER] and [CANDIDATE] lines in English, along with a list of Expected Questions (1 to 12).

TASK:
For each expected question:
1. Search the Diarized Script for the candidate's spoken response to that question.
2. Extract the candidate's spoken response in clean English.
3. Write an Executive 1 to 2 sentence summary in English of ONLY the candidate's core answer.

Return ONLY a JSON array of objects for all 12 questions with keys:
- qNumber (number 1 to 12)
- questionId (string matching provided questionId)
- category (string)
- questionText (string)
- aiSummary (string)
- keyTakeaways (string)
- candidateAnswerOnly (string)
- wasAnswered (boolean)`;

  const userPrompt = `Expected Questions List:\n${JSON.stringify(questionTemplates, null, 2)}\n\nDiarized Interview Script:\n"${diarizedScript}"`;

  console.log("[LLM Pipeline] Step 2: Running Section Segmenter & Executive Summarizer...");
  const jsonResponseText = await callLLM(systemPrompt, userPrompt, settings, 0.1);
  const fallbackResults = smartClassifyTranscript(cleanFullTranscript, questionsList);

  if (jsonResponseText) {
    const jsonMatch = jsonResponseText.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      try {
        const parsedArray = JSON.parse(jsonMatch[0]);

        return questionsList.map((q, idx) => {
          const qNum = idx + 1;
          const matched = parsedArray.find(
            (p) =>
              Number(p.qNumber) === qNum ||
              p.questionId === q.id ||
              (p.questionText && p.questionText.toLowerCase().includes(q.text.toLowerCase().slice(0, 15)))
          );

          const isAnswered =
            matched &&
            (matched.wasAnswered === true ||
              String(matched.wasAnswered).toLowerCase() === "true" ||
              String(matched.wasAnswered).toLowerCase() === "yes") &&
            matched.candidateAnswerOnly &&
            !matched.candidateAnswerOnly.toLowerCase().includes("not answered") &&
            !matched.candidateAnswerOnly.toLowerCase().includes("n/a") &&
            matched.candidateAnswerOnly.trim().length > 5;

          if (isAnswered) {
            const cleanCand = stripFillerWords(matched.candidateAnswerOnly.replace(/^\[CANDIDATE\]:\s*/i, "").trim());
            return {
              questionId: q.id,
              qNumber: qNum,
              category: matched.category || q.category || "General",
              questionText: q.text,
              aiSummary: stripFillerWords(matched.aiSummary || "Candidate response summarized."),
              keyTakeaways: matched.keyTakeaways || "Response recorded.",
              candidateAnswerOnly: cleanCand
            };
          }

          // Smart heuristic fallback for this specific question
          const fallbackItem = fallbackResults.find((f) => f.questionId === q.id || f.qNumber === qNum);
          if (fallbackItem) {
            return fallbackItem;
          }

          return {
            questionId: q.id,
            qNumber: qNum,
            category: q.category || "General",
            questionText: q.text,
            aiSummary: "Candidate response recorded.",
            keyTakeaways: "Response saved.",
            candidateAnswerOnly: cleanFullTranscript.slice(0, 150)
          };
        });
      } catch (e) {
        console.warn("[LLM Pipeline JSON Parse Error]:", e.message);
      }
    }
  }

  console.log("[LLM Pipeline] Executing Smart Local Heuristic Search Classifier Safety Net...");
  return fallbackResults;
}

module.exports = {
  cleanTranscriptWithLLM,
  summarizeCandidateResponse,
  divideAndCategorizeInterviewWithLLM,
  parseAndDivideFullInterviewWithLLM
};
