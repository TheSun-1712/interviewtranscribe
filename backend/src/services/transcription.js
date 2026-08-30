const fs = require("fs");
const path = require("path");
const fetch = require("node-fetch");
const FormData = require("form-data");
const { stripFillerWords } = require("./heuristicClassifier");

/**
 * Transcribe and translate audio (Telugu/Hindi/Hinglish -> English) using Groq Whisper API
 * @param {String} filePath - Local file path of recording
 * @returns {Promise<String>} Cleaned English transcribed text
 */
async function transcribeAudio(filePath) {
  const groqApiKey = process.env.GROQ_API_KEY || process.env.LLM_API_KEY || "";
  const whisperUrl = process.env.WHISPER_SERVICE_URL || "http://localhost:9000";

  console.log(`[Transcription] Processing audio file: ${filePath}`);

  // 1. Try Groq Cloud Whisper API for automatic translation to English (10s timeout)
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
      formData.append(
        "prompt",
        "Technical candidate interview recording in English, Telugu, or Hindi. Translate and transcribe accurately into clean professional English without speech fillers."
      );

      console.log(`[Groq Audio API] Sending ${filename} for multilingual translation to English...`);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      // Attempt translations endpoint first for multilingual audio to English
      let response = await fetch("https://api.groq.com/openai/v1/audio/translations", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${groqApiKey}`,
          ...formData.getHeaders()
        },
        body: formData,
        signal: controller.signal
      });

      if (!response.ok) {
        // Fallback to transcriptions endpoint if translations not supported for file type
        const formData2 = new FormData();
        formData2.append("file", fs.createReadStream(filePath), { filename, contentType });
        formData2.append("model", "whisper-large-v3");
        formData2.append("temperature", "0.0");

        response = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${groqApiKey}`,
            ...formData2.getHeaders()
          },
          body: formData2,
          signal: controller.signal
        });
      }

      clearTimeout(timeoutId);

      const responseText = await response.text();

      if (response.ok) {
        const data = JSON.parse(responseText);
        if (data.text) {
          const rawText = data.text.trim();
          const cleanText = stripFillerWords(rawText);
          console.log("[Groq Audio Success] Clean English Text:", cleanText);
          return cleanText;
        }
      } else {
        console.warn("[Groq Audio Error]:", response.status, responseText);
      }
    } catch (err) {
      console.error("[Groq Audio Exception/Timeout]:", err.message);
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
      const cleanText = stripFillerWords(text);
      console.log("[Local Whisper Success]:", cleanText);
      return cleanText;
    }
  } catch (err) {
    console.warn("[Local Whisper Exception/Timeout]:", err.message);
  }

  return "";
}

module.exports = { transcribeAudio };
