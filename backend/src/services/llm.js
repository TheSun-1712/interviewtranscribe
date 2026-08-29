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
 * High-Precision Full Interview Segmenter:
 * 1. Strips out interviewer questions.
 * 2. Matches candidate spoken answers to exact target question IDs.
 * 3. NEVER duplicates responses across unanswered questions!
 */
async function parseAndDivideFullInterviewWithLLM(fullTranscriptText, questionsList = [], settings = {}) {
  if (!fullTranscriptText || !fullTranscriptText.trim()) {
    return questionsList.map((q) => ({
      questionId: q.id,
      category: q.category || "General",
      questionText: q.text,
      aiSummary: "Question not asked / No response recorded",
      keyTakeaways: "N/A",
      candidateAnswerOnly: "[Not answered in this session]"
    }));
  }

  const baseUrl = settings.llmBaseUrl || process.env.LLM_BASE_URL || "https://api.groq.com/openai/v1";
  const apiKey = settings.llmApiKey || process.env.GROQ_API_KEY || process.env.LLM_API_KEY || "";
  const model = settings.llmModel || process.env.LLM_MODEL || "llama3-70b-8192";

  const questionTemplates = questionsList.map((q) => ({
    questionId: q.id,
    questionText: q.text,
    category: q.category || "General"
  }));

  const systemPrompt = `You are a high-precision executive technical interviewer AI. You are given a full continuous audio transcript of an interview containing TWO speakers: the interviewer (asking questions) and the candidate (answering).

STRICT DIRECTIVES:
1. Examine the transcript and match the candidate's spoken responses to the provided Target Questions list.
2. For EVERY question in the Target Questions list:
   - If the candidate ANSWERED this question in the transcript:
     a) STRIP OUT all interviewer questions/prompts.
     b) Set 'candidateAnswerOnly' to ONLY the candidate's direct spoken statements.
     c) Set 'aiSummary' to a concise 1-2 sentence summary of ONLY the candidate's answer. Do NOT repeat or mention the interviewer's question.
     d) Set 'keyTakeaways' to 2 key candidate strengths.
     e) Set 'wasAnswered': true.
   - If the candidate DID NOT answer this question in the transcript (or the question was not asked):
     a) Set 'candidateAnswerOnly': "[Not answered in this session]"
     b) Set 'aiSummary': "Question not asked in session"
     c) Set 'keyTakeaways': "N/A"
     d) Set 'wasAnswered': false.

CRITICAL RULE: DO NOT copy or paste the entire transcript across questions that were NOT answered.

RETURN ONLY a JSON array of objects with keys:
- questionId (string matching provided questionId)
- category (string)
- questionText (string)
- aiSummary (string)
- keyTakeaways (string)
- candidateAnswerOnly (string)
- wasAnswered (boolean)`;

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
          { role: "user", content: `Target Questions (1 to 12):\n${JSON.stringify(questionTemplates, null, 2)}\n\nFull Continuous Audio Transcript:\n"${fullTranscriptText}"` }
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

        return questionsList.map((q) => {
          const matched = parsedArray.find((p) => p.questionId === q.id || p.questionText === q.text);
          if (matched && matched.wasAnswered && matched.candidateAnswerOnly && !matched.candidateAnswerOnly.includes("[Not answered")) {
            return {
              questionId: q.id,
              category: matched.category || q.category || "General",
              questionText: q.text,
              aiSummary: matched.aiSummary || "Candidate response summarized.",
              keyTakeaways: matched.keyTakeaways || "Response recorded.",
              candidateAnswerOnly: matched.candidateAnswerOnly
            };
          } else if (matched && matched.candidateAnswerOnly) {
            return {
              questionId: q.id,
              category: q.category || "General",
              questionText: q.text,
              aiSummary: matched.aiSummary || "Question not asked in session",
              keyTakeaways: "N/A",
              candidateAnswerOnly: matched.candidateAnswerOnly
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
      }
    }
  } catch (err) {
    console.warn("[LLM Full-Interview Division Exception]:", err.message);
  }

  // Safe Fallback: do NOT duplicate transcript!
  return questionsList.map((q, idx) => ({
    questionId: q.id,
    category: q.category || "General",
    questionText: q.text,
    aiSummary: idx === 0 ? fullTranscriptText.slice(0, 150) + "..." : "Question not asked in session",
    keyTakeaways: idx === 0 ? "Candidate introduction recorded." : "N/A",
    candidateAnswerOnly: idx === 0 ? fullTranscriptText : "[Not answered in this session]"
  }));
}

module.exports = {
  cleanTranscriptWithLLM,
  summarizeCandidateResponse,
  divideAndCategorizeInterviewWithLLM,
  parseAndDivideFullInterviewWithLLM
};
