const fetch = require("node-fetch");

/**
 * Clean raw transcript by removing interviewer questions and preserving only candidate statements
 */
async function cleanTranscriptWithLLM(rawTranscript, settings = {}) {
  if (!rawTranscript || !rawTranscript.trim()) return "";

  const baseUrl = settings.llmBaseUrl || process.env.LLM_BASE_URL || "https://api.groq.com/openai/v1";
  const apiKey = settings.llmApiKey || process.env.GROQ_API_KEY || process.env.LLM_API_KEY || "";
  const model = settings.llmModel || process.env.LLM_MODEL || "llama3-70b-8192";

  if (!apiKey && !baseUrl.includes("localhost") && !baseUrl.includes("127.0.0.1")) {
    return rawTranscript.replace(/\b(um+|uh+|ah+|er+)\b/gi, "").replace(/\s+/g, " ").trim();
  }

  const systemPrompt = `You are an expert interview transcription editor. The input audio transcript contains two speakers: the interviewer (asking questions) and the candidate (answering).

STRICT RULES:
1. REMOVE all sentences, prompts, and interjections spoken by the interviewer (such as questions starting with 'Can you...', 'How do you...', 'Tell us about...', or ending with a question mark '?').
2. Retain ONLY the candidate's direct spoken statements.
3. Clean up filler words (um, ah, like, you know) and formatting into clean, professional prose while strictly preserving the candidate's exact facts.`;

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
          { role: "user", content: `Full Audio Transcript:\n"${rawTranscript}"\n\nCandidate Only Response:` }
        ],
        temperature: 0.2
      })
    });

    if (response.ok) {
      const data = await response.json();
      return data.choices?.[0]?.message?.content?.trim() || rawTranscript;
    }
  } catch (err) {
    console.warn("[LLM Cleanup Exception]:", err.message);
  }

  return rawTranscript.replace(/\b(um+|uh+|ah+|er+)\b/gi, "").replace(/\s+/g, " ").trim();
}

/**
 * Generate a concise 1-2 sentence executive AI summary of ONLY the candidate's response
 */
async function summarizeCandidateResponse(rawTranscript, questionText = "", settings = {}) {
  if (!rawTranscript || !rawTranscript.trim()) return "";

  const baseUrl = settings.llmBaseUrl || process.env.LLM_BASE_URL || "https://api.groq.com/openai/v1";
  const apiKey = settings.llmApiKey || process.env.GROQ_API_KEY || process.env.LLM_API_KEY || "";
  const model = settings.llmModel || process.env.LLM_MODEL || "llama3-70b-8192";

  if (!apiKey && !baseUrl.includes("localhost") && !baseUrl.includes("127.0.0.1")) {
    return rawTranscript.slice(0, 150) + "...";
  }

  const systemPrompt = `You are an executive interviewer assistant analyzing an interview audio transcript.

CRITICAL INSTRUCTIONS:
1. The audio transcript contains TWO voices: the interviewer (asking questions) and the candidate (answering).
2. STRIP OUT AND IGNORE any sentence that sounds like a question, prompt, or interviewer intro.
3. Focus EXCLUSIVELY on the candidate's spoken response.
4. Generate a concise 1 to 2 sentence executive AI summary summarizing ONLY what the candidate stated (their core skills, experience, or approach). Do NOT mention or repeat the interviewer's question.`;

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
          { role: "user", content: `Question Prompt: "${questionText}"\n\nAudio Transcript:\n"${rawTranscript}"\n\nCandidate-Only Executive AI Summary:` }
        ],
        temperature: 0.2
      })
    });

    if (response.ok) {
      const data = await response.json();
      return data.choices?.[0]?.message?.content?.trim() || rawTranscript.slice(0, 150);
    }
  } catch (err) {
    console.warn("[LLM Summary Exception]:", err.message);
  }

  return rawTranscript.slice(0, 150) + "...";
}

/**
 * Divide and categorize interview Q&A list with LLM, stripping out interviewer questions
 */
async function divideAndCategorizeInterviewWithLLM(QandAList, settings = {}) {
  if (!QandAList || QandAList.length === 0) return QandAList;

  const baseUrl = settings.llmBaseUrl || process.env.LLM_BASE_URL || "https://api.groq.com/openai/v1";
  const apiKey = settings.llmApiKey || process.env.GROQ_API_KEY || process.env.LLM_API_KEY || "";
  const model = settings.llmModel || process.env.LLM_MODEL || "llama3-70b-8192";

  if (!apiKey && !baseUrl.includes("localhost") && !baseUrl.includes("127.0.0.1")) {
    return QandAList.map((item) => ({
      ...item,
      sectionName: item.category || "General",
      aiSummary: item.transcript ? item.transcript.slice(0, 150) + "..." : "[No response]",
      keyTakeaways: "Direct candidate response recorded."
    }));
  }

  const promptPayload = QandAList.map((q, idx) => ({
    index: idx + 1,
    category: q.category || "General",
    question: q.questionText,
    rawResponse: q.transcript || "[No response]"
  }));

  const systemPrompt = `You are an executive interviewer assistant. Analyze the interview audio transcript which contains interviewer questions and candidate answers.

STRICT INSTRUCTIONS:
1. Strip out all interviewer questions and prompts. Focus ONLY on the candidate's answers.
2. For each question item:
   a) Confirm Section Category.
   b) Generate a concise 2-sentence AI Section Summary of ONLY the candidate's response.
   c) Extract 2 Bullet Points of Candidate Strengths/Takeaways.
Return your answer as a JSON array of objects with keys: index, sectionCategory, aiSummary, keyTakeaways.`;

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
          { role: "user", content: `Interview Q&A Data:\n${JSON.stringify(promptPayload, null, 2)}` }
        ],
        temperature: 0.2
      })
    });

    if (response.ok) {
      const data = await response.json();
      const content = data.choices?.[0]?.message?.content?.trim();
      const jsonMatch = content ? content.match(/\[[\s\S]*\]/) : null;
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return QandAList.map((item, idx) => {
          const aiMatch = parsed.find((p) => p.index === idx + 1) || {};
          return {
            ...item,
            sectionName: aiMatch.sectionCategory || item.category || "General",
            aiSummary: aiMatch.aiSummary || (item.transcript ? item.transcript.slice(0, 150) + "..." : ""),
            keyTakeaways: aiMatch.keyTakeaways || "Candidate response recorded."
          };
        });
      }
    }
  } catch (err) {
    console.warn("[LLM Division Exception]:", err.message);
  }

  return QandAList.map((item) => ({
    ...item,
    sectionName: item.category || "General",
    aiSummary: item.transcript ? item.transcript.slice(0, 150) + "..." : "[No response]",
    keyTakeaways: "Direct candidate response recorded."
  }));
}

/**
 * Intelligently parse a single continuous full-interview transcript:
 * Categorizes the transcript into EVERY question provided in questionsList.
 * Strips out interviewer questions and isolates ONLY candidate answers per question.
 */
async function parseAndDivideFullInterviewWithLLM(fullTranscriptText, questionsList = [], settings = {}) {
  if (!fullTranscriptText || !fullTranscriptText.trim()) return [];

  const baseUrl = settings.llmBaseUrl || process.env.LLM_BASE_URL || "https://api.groq.com/openai/v1";
  const apiKey = settings.llmApiKey || process.env.GROQ_API_KEY || process.env.LLM_API_KEY || "";
  const model = settings.llmModel || process.env.LLM_MODEL || "llama3-70b-8192";

  const questionTemplates = questionsList.map((q) => ({
    questionId: q.id,
    questionText: q.text,
    category: q.category || "General"
  }));

  const systemPrompt = `You are a high-precision executive technical interviewer AI. You are given a full continuous audio transcript of an interview and a list of expected target questions.

CRITICAL MANDATORY INSTRUCTIONS:
1. You MUST process and include EVERY question listed in the target question array. Do NOT skip any question.
2. For each target question:
   a) Locate where the candidate answered or discussed that topic in the continuous transcript.
   b) STRIP OUT any interviewer questions, prompts, or interjections.
   c) Extract ONLY the candidate's spoken response text into 'candidateAnswerOnly'.
   d) Generate a clear 1 to 2 sentence Executive AI Summary of ONLY what the candidate stated into 'aiSummary'.
   e) Extract 2 key bullet point strengths into 'keyTakeaways'.
   f) If the candidate did not answer or discuss a specific question, set candidateAnswerOnly: "Candidate did not answer this question", aiSummary: "No answer recorded for this question."

RETURN ONLY a JSON array containing an object for EVERY question provided. Each object must have keys:
- questionId (MUST match the questionId provided)
- category (string)
- questionText (string)
- aiSummary (string)
- keyTakeaways (string)
- candidateAnswerOnly (string)`;

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
          { role: "user", content: `Target Questions:\n${JSON.stringify(questionTemplates, null, 2)}\n\nFull Continuous Interview Audio Transcript:\n"${fullTranscriptText}"` }
        ],
        temperature: 0.1
      })
    });

    if (response.ok) {
      const data = await response.json();
      const content = data.choices?.[0]?.message?.content?.trim();
      const jsonMatch = content ? content.match(/\[[\s\S]*\]/) : null;
      if (jsonMatch) {
        const parsedArray = JSON.parse(jsonMatch[0]);
        // Map and ensure EVERY question from questionsList is present
        return questionsList.map((q) => {
          const matched = parsedArray.find((p) => p.questionId === q.id || p.questionText === q.text);
          return {
            questionId: q.id,
            category: matched?.category || q.category || "General",
            questionText: q.text,
            aiSummary: matched?.aiSummary || "Answer summarized from continuous recording.",
            keyTakeaways: matched?.keyTakeaways || "Candidate response recorded.",
            candidateAnswerOnly: matched?.candidateAnswerOnly || fullTranscriptText
          };
        });
      }
    }
  } catch (err) {
    console.warn("[LLM Full-Interview Division Exception]:", err.message);
  }

  return questionsList.map((q) => ({
    questionId: q.id,
    category: q.category || "General",
    questionText: q.text,
    aiSummary: fullTranscriptText.slice(0, 150) + "...",
    keyTakeaways: "Candidate full interview audio recorded.",
    candidateAnswerOnly: fullTranscriptText
  }));
}

module.exports = {
  cleanTranscriptWithLLM,
  summarizeCandidateResponse,
  divideAndCategorizeInterviewWithLLM,
  parseAndDivideFullInterviewWithLLM
};
