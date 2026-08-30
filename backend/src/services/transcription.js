const fs = require("fs");
const path = require("path");
const fetch = require("node-fetch");
const FormData = require("form-data");

/**
 * Transcribe audio using Groq Whisper Large V3 API with language & domain context guidance
 * @param {String} filePath - Local file path of recording
 * @returns {Promise<String>} Transcribed text
 */
async function transcribeAudio(filePath) {
  const groqApiKey = process.env.GROQ_API_KEY || process.env.LLM_API_KEY || "";
  const whisperUrl = process.env.WHISPER_SERVICE_URL || "http://localhost:9000";

  console.log(`[Transcription] Processing audio file: ${filePath}`);

  // 1. Try Groq Cloud Whisper Large V3 API if key present (10s timeout)
  if (groqApiKey && groqApiKey.startsWith("gsk_")) {
    try {
      const formData = new FormData();
      const filename = path.basename(filePath);

      const ext = path.extname(filePath).toLowerCase();
      let contentType = "audio/webm";
      if (ext === ".mp3") contentType = "audio/mp3";
      if (ext === ".wav") contentType = "audio/wav";
      if (ext === ".m4a") contentType = "audio/m4a";

      formData.append("file", fs.createReadStream(filePath), {
        filename: filename,
        contentType: contentType
      });
      formData.append("model", "whisper-large-v3");
      formData.append("temperature", "0.0");
      formData.append("language", "en");
      formData.append(
        "prompt",
        "Technical candidate interview recording containing questions about introduction, problem statement, implementation plan, domain knowledge, DSA ideation, training and development, career vision, AAC focus, stay after hours availability, mentorship interest, and behavioral experiences."
      );

      console.log(`[Groq API] Sending ${filename} to Groq Whisper Large V3...`);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      const response = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${groqApiKey}`,
          ...formData.getHeaders()
        },
        body: formData,
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      const responseText = await response.text();
      console.log(`[Groq API] Status: ${response.status}, Length: ${responseText.length}`);

      if (response.ok) {
        const data = JSON.parse(responseText);
        if (data.text) {
          console.log("[Groq API] Transcribed Text:", data.text);
          return data.text.trim();
        }
      } else {
        console.warn("[Groq API Error]:", response.status, responseText);
      }
    } catch (err) {
      console.error("[Groq API Exception/Timeout]:", err.message);
    }
  }

  // 2. Fallback to local faster-whisper FastAPI microservice (5s timeout)
  try {
    const formData = new FormData();
    const filename = path.basename(filePath);
    formData.append("file", fs.createReadStream(filePath), { filename });

    console.log(`[Local Whisper] Sending ${filename} to local Whisper microservice at ${whisperUrl}...`);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(`${whisperUrl}/transcribe`, {
      method: "POST",
      headers: formData.getHeaders(),
      body: formData,
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    if (response.ok) {
      const data = await response.json();
      const text = data.text || data.transcript || "";
      console.log("[Local Whisper Success]:", text);
      return text.trim();
    }
  } catch (err) {
    console.warn("[Local Whisper Exception/Timeout]:", err.message);
  }

  return "";
}

module.exports = { transcribeAudio };
