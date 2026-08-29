const fetch = require("node-fetch");

/**
 * Universal LLM Request Helper
 * Automatically routes to Gemini API, Groq Cloud API, or OpenAI/Claude Compatible API
 */
async function callLLM(systemPrompt, userPrompt, settings = {}, temperature = 0.1) {
  let baseUrl = settings.llmBaseUrl || process.env.LLM_BASE_URL || "https://api.groq.com/openai/v1";
  let apiKey = settings.llmApiKey || process.env.GROQ_API_KEY || process.env.GEMINI_API_KEY || process.env.LLM_API_KEY || "";
  let model = settings.llmModel || process.env.LLM_MODEL || "llama-3.3-70b-versatile";

  // Auto-detect Google Gemini Key
  if (apiKey.startsWith("AIzaSy") || apiKey.startsWith("AQ.")) {
    baseUrl = "https://generativelanguage.googleapis.com/v1beta/openai/";
    model = settings.llmModel || "gemini-1.5-flash";
  }

  if (!apiKey && !baseUrl.includes("localhost") && !baseUrl.includes("127.0.0.1")) {
    return null;
  }

  try {
    const response = await fetch(`${baseUrl.replace(/\/$/, "")}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
        temperature: temperature
      })
    });

    if (response.ok) {
      const data = await response.json();
      return data.choices?.[0]?.message?.content?.trim() || null;
    } else {
      const errTxt = await response.text();
      console.warn(`[LLM Call Error ${response.status}]:`, errTxt);

      // Fallback strategies
      if (apiKey.startsWith("gsk_") && model.includes("70b")) {
        console.log("[LLM Fallback] Retrying Groq with llama-3.1-8b-instant...");
        return callLLM(systemPrompt, userPrompt, { ...settings, llmModel: "llama-3.1-8b-instant" }, temperature);
      }
    }
  } catch (err) {
    console.warn("[LLM Call Exception]:", err.message);
  }

  return null;
}

/**
 * PASS 1: Speaker Diarization ([INTERVIEWER] vs [CANDIDATE])
 */
async function diarizeAndCleanTranscript(rawTranscript, settings = {}) {
  if (!rawTranscript || !rawTranscript.trim()) return "";

  const systemPrompt = `You are an expert interview speaker diarization AI.
You are given a raw continuous transcript of an interview containing two speakers: the Interviewer (asking questions) and the Candidate (answering).

TASK:
Rewrite the transcript into a structured conversation script separating Interviewer questions from Candidate answers.

FORMAT:
[INTERVIEWER]: <Interviewer question or prompt>
[CANDIDATE]: <Candidate spoken response>

RULES:
1. Label any question, prompt, or interviewer intro (e.g. 'tell me your name', 'what is your problem statement', 'next question', 'how do you plan...') as [INTERVIEWER].
2. Label any candidate statements, background, or explanations as [CANDIDATE].
3. Clean up speech stutters, but preserve exact factual statements.`;

  const userPrompt = `Raw Continuous Interview Transcript:\n"${rawTranscript}"\n\nDiarized Conversation Script:`;
  const result = await callLLM(systemPrompt, userPrompt, settings, 0.1);
  return result || rawTranscript;
}

/**
 * Clean raw transcript by removing interviewer questions and preserving only candidate statements
 */
async function cleanTranscriptWithLLM(rawTranscript, settings = {}) {
  if (!rawTranscript || !rawTranscript.trim()) return "";

  const diarized = await diarizeAndCleanTranscript(rawTranscript, settings);

  const candidateLines = diarized
    .split("\n")
    .filter((line) => line.startsWith("[CANDIDATE]:"))
    .map((line) => line.replace("[CANDIDATE]:", "").trim())
    .filter(Boolean);

  if (candidateLines.length > 0) {
    return candidateLines.join("\n\n");
  }

  return rawTranscript.replace(/\b(um+|uh+|ah+|er+)\b/gi, "").replace(/\s+/g, " ").trim();
}

/**
 * Generate a concise 1-2 sentence executive AI summary of ONLY candidate response
 */
async function summarizeCandidateResponse(rawTranscript, questionText = "", settings = {}) {
  if (!rawTranscript || !rawTranscript.trim()) return "No response recorded";

  const systemPrompt = `You are an executive hiring manager assistant.
Analyze the provided transcript segment and write a concise 1 to 2 sentence executive summary of ONLY the candidate's core answer.

RULES:
1. Summarize candidate's core skills, experience, project approach, or background.
2. DO NOT mention or quote the interviewer's question.
3. Write a direct executive summary.`;

  const userPrompt = `Target Question: "${questionText}"\n\nTranscript Segment:\n"${rawTranscript}"\n\nConcise Executive AI Summary:`;
  const summary = await callLLM(systemPrompt, userPrompt, settings, 0.2);

  return summary || rawTranscript.slice(0, 150) + "...";
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
 * Pass 2: Question-by-Question Section Segmenter & Executive Summarizer.
 */
async function parseAndDivideFullInterviewWithLLM(fullTranscriptText, questionsList = [], settings = {}) {
  if (!fullTranscriptText || !fullTranscriptText.trim()) {
    return questionsList.map((q) => ({
      questionId: q.id,
      category: q.category || "General",
      questionText: q.text,
      aiSummary: "Question not asked in session",
      keyTakeaways: "N/A",
      candidateAnswerOnly: "[Not answered in this session]"
    }));
  }

  console.log("[LLM Pipeline] Step 1: Running Speaker Diarization...");
  const diarizedScript = await diarizeAndCleanTranscript(fullTranscriptText, settings);
  console.log("[LLM Pipeline] Step 1 Diarized Script:\n", diarizedScript.slice(0, 300) + "...");

  const questionTemplates = questionsList.map((q, idx) => ({
    qNumber: idx + 1,
    questionId: q.id,
    questionText: q.text,
    category: q.category || "General"
  }));

  const systemPrompt = `You are a senior executive interview analysis AI.
You are given a Diarized Interview Script containing [INTERVIEWER] and [CANDIDATE] lines, along with a list of Expected Questions (1 to 12).

TASK:
For each expected question:
1. Search the Diarized Script for the candidate's spoken response to that question.
2. If the candidate answered that question:
   - 'wasAnswered': true
   - 'candidateAnswerOnly': Clean candidate spoken response (strictly exclude all [INTERVIEWER] lines/questions).
   - 'aiSummary': Executive 1 to 2 sentence summary of ONLY the candidate's core answer.
   - 'keyTakeaways': 2 key strengths.
3. If the candidate DID NOT answer or discuss that question:
   - 'wasAnswered': false
   - 'candidateAnswerOnly': "[Not answered in this session]"
   - 'aiSummary': "Question not asked in session"
   - 'keyTakeaways': "N/A"

STRICT RULE: Do NOT copy the same answer to multiple questions.

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

  if (jsonResponseText) {
    const jsonMatch = jsonResponseText.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      try {
        const parsedArray = JSON.parse(jsonMatch[0]);
        console.log("[LLM Pipeline] Step 2 Parsed Array Count:", parsedArray.length);

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
            const cleanCand = matched.candidateAnswerOnly.replace(/^\[CANDIDATE\]:\s*/i, "").trim();
            return {
              questionId: q.id,
              category: matched.category || q.category || "General",
              questionText: q.text,
              aiSummary: matched.aiSummary || "Candidate response summarized.",
              keyTakeaways: matched.keyTakeaways || "Response recorded.",
              candidateAnswerOnly: cleanCand
            };
          } else {
            return {
              questionId: q.id,
              category: q.category || "General",
              questionText: q.text,
              aiSummary: "Question not asked in session",
              keyTakeaways: "N/A",
              candidateAnswerOnly: "[Not answered in this session]"
            };
          }
        });
      } catch (e) {
        console.warn("[LLM Pipeline JSON Parse Error]:", e.message);
      }
    }
  }

  // Safe Fallback: Process each candidate segment independently
  const candidateBlocks = diarizedScript.split("[INTERVIEWER]:").filter(Boolean);

  return questionsList.map((q, idx) => {
    const block = candidateBlocks[idx + 1] || candidateBlocks[idx];
    if (block && block.includes("[CANDIDATE]:")) {
      const candText = block.split("[CANDIDATE]:")[1]?.trim() || block.trim();
      if (candText.length > 5) {
        return {
          questionId: q.id,
          category: q.category || "General",
          questionText: q.text,
          aiSummary: candText.slice(0, 150) + "...",
          keyTakeaways: "Candidate answer recorded.",
          candidateAnswerOnly: candText
        };
      }
    }
    return {
      questionId: q.id,
      category: q.category || "General",
      questionText: q.text,
      aiSummary: "Question not asked in session",
      keyTakeaways: "N/A",
      candidateAnswerOnly: "[Not answered in this session]"
    };
  });
}

module.exports = {
  cleanTranscriptWithLLM,
  summarizeCandidateResponse,
  divideAndCategorizeInterviewWithLLM,
  parseAndDivideFullInterviewWithLLM
};
