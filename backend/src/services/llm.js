const fetch = require("node-fetch");

/**
 * LLM Service for Transcript Cleanup & Automatic Section Partitioning
 */

/**
 * Clean up raw transcript using OpenAI-compatible LLM endpoint
 */
async function cleanTranscriptWithLLM(rawTranscript, settings = {}) {
  if (!rawTranscript || !rawTranscript.trim()) return "";

  const baseUrl = settings.llmBaseUrl || process.env.LLM_BASE_URL || "https://api.groq.com/openai/v1";
  const apiKey = settings.llmApiKey || process.env.GROQ_API_KEY || process.env.LLM_API_KEY || "";
  const model = settings.llmModel || process.env.LLM_MODEL || "llama-3.3-70b-versatile";

  if (!apiKey && !baseUrl.includes("localhost") && !baseUrl.includes("127.0.0.1")) {
    return rawTranscript.replace(/\b(um+|uh+|ah+|er+)\b/gi, "").replace(/\s+/g, " ").trim();
  }

  const systemPrompt = "You are an expert interview transcription editor. Clean up the provided spoken transcript by removing filler words (um, ah, like, you know), fixing minor grammar issues, and formatting it into clean, professional prose while strictly preserving the candidate's exact meaning and facts.";

  try {
    const response = await fetch(`${baseUrl.replace(/\/$/, "")}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey || "ollama"}`
      },
      body: JSON.stringify({
        model: model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Raw Transcript:\n"${rawTranscript}"\n\nCleaned Version:` }
        ],
        temperature: 0.2
      })
    });

    if (response.ok) {
      const data = await response.json();
      return data.choices?.[0]?.message?.content?.trim() || rawTranscript;
    } else {
      const errTxt = await response.text();
      console.warn("LLM API error response:", response.status, errTxt);
    }
  } catch (err) {
    console.warn("LLM cleanup service warning:", err.message);
  }

  return rawTranscript.replace(/\b(um+|uh+|ah+|er+)\b/gi, "").replace(/\s+/g, " ").trim();
}

/**
 * Auto-divide and map candidate answers into respective question categories & sections
 */
async function divideAndCategorizeInterviewWithLLM(QandAList, settings = {}) {
  if (!QandAList || QandAList.length === 0) return QandAList;

  const baseUrl = settings.llmBaseUrl || process.env.LLM_BASE_URL || "https://api.groq.com/openai/v1";
  const apiKey = settings.llmApiKey || process.env.GROQ_API_KEY || process.env.LLM_API_KEY || "";
  const model = settings.llmModel || process.env.LLM_MODEL || "llama-3.3-70b-versatile";

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

  const systemPrompt = `You are an executive technical interviewer assistant. Analyze the candidate's responses across all interview questions. For each question:
1. Map/Confirm its Section Category (e.g., Background & Overview, Technical Competency, System Architecture, Culture & Leadership, Q&A).
2. Generate a concise 2-sentence AI Section Summary of the answer.
3. Extract 2 Bullet Points of Key Strengths/Takeaways.
Return your answer as a JSON array of objects with keys: index, sectionCategory, aiSummary, keyTakeaways.`;

  try {
    const response = await fetch(`${baseUrl.replace(/\/$/, "")}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey || "ollama"}`
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
    console.warn("LLM auto-division warning:", err.message);
  }

  return QandAList.map((item) => ({
    ...item,
    sectionName: item.category || "General",
    aiSummary: item.transcript ? item.transcript.slice(0, 150) + "..." : "[No response]",
    keyTakeaways: "Direct candidate response recorded."
  }));
}

module.exports = { cleanTranscriptWithLLM, divideAndCategorizeInterviewWithLLM };
