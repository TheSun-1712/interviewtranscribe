const fs = require("fs");
const path = require("path");
const fetch = require("node-fetch");
const FormData = require("form-data");
const { stripFillerWords } = require("./heuristicClassifier");

/**
 * Transcribe audio using the local faster-whisper FastAPI service.
 * Service must be running at WHISPER_SERVICE_URL (default: http://localhost:9000).
 *
 * Start it with:
 *   cd whisper-service
 *   pip install -r requirements.txt
 *   python main.py
 *
 * @param {String} filePath - Local file path of recording
 * @returns {Promise<String>} Cleaned transcribed text, or "" if unavailable
 */
async function transcribeAudio(filePath) {
  const whisperUrl = process.env.WHISPER_SERVICE_URL || "http://localhost:9000";

  console.log(`[Transcription] Processing audio file: ${filePath}`);

  try {
    const formData = new FormData();
    const filename = path.basename(filePath);

    formData.append("file", fs.createReadStream(filePath), { filename });

    console.log(`[Whisper] Sending ${filename} to local faster-whisper at ${whisperUrl}/transcribe ...`);

    const controller = new AbortController();
    // Local CPU whisper can be slow — give it 120 seconds
    const timeoutId = setTimeout(() => controller.abort(), 120000);

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
      console.log("[Whisper] Transcription success:", cleanText.slice(0, 100));
      return cleanText;
    } else {
      const errText = await response.text();
      console.warn(`[Whisper] Service returned error ${response.status}:`, errText);
    }
  } catch (err) {
    if (err.name === "AbortError") {
      console.warn("[Whisper] Request timed out after 120s — is the faster-whisper service running?");
    } else {
      console.warn("[Whisper] Service unavailable:", err.message);
      console.warn("[Whisper] Start it with: cd whisper-service && python main.py");
    }
  }

  // Return empty string — recording still saves, just without transcript
  return "";
}

module.exports = { transcribeAudio };
