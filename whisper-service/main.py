import os
import re
import tempfile
from fastapi import FastAPI, UploadFile, File, HTTPException, Body
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

load_dotenv()

app = FastAPI(title="Faster-Whisper Speech Translation & Smart Classifier", version="1.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

MODEL_SIZE = os.getenv("WHISPER_MODEL", "small")
DEVICE = os.getenv("WHISPER_DEVICE", "cpu")

whisper_model = None

FILLER_REGEX = re.compile(
    r"\b(so\s+yeah|okay\s+so|fine\s+so|you\s+know|i\s+mean|basically|actually|uhm+|um+|uh+|er+|ah+|yea+|yeah+)\b",
    re.IGNORECASE
)

def strip_fillers(text: str) -> str:
    if not text:
        return ""
    cleaned = FILLER_REGEX.sub(" ", text)
    cleaned = re.sub(r"\s+", " ", cleaned).strip()
    return cleaned

@app.on_event("startup")
def load_model():
    global whisper_model
    try:
        from faster_whisper import WhisperModel
        print(f"Loading faster-whisper model '{MODEL_SIZE}' on {DEVICE}...")
        whisper_model = WhisperModel(MODEL_SIZE, device=DEVICE, compute_type="int8")
        print("faster-whisper model loaded successfully!")
    except Exception as e:
        print(f"Warning: Could not load faster-whisper model at startup: {e}")

@app.get("/health")
def health():
    return {"status": "ok", "model": MODEL_SIZE, "device": DEVICE}

@app.post("/transcribe")
async def transcribe(file: UploadFile = File(...)):
    global whisper_model
    if not file:
        raise HTTPException(status_code=400, detail="No audio file provided")

    try:
        suffix = os.path.splitext(file.filename)[1] or ".webm"
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
            content = await file.read()
            tmp.write(content)
            tmp_path = tmp.name

        if whisper_model is None:
            from faster_whisper import WhisperModel
            whisper_model = WhisperModel(MODEL_SIZE, device=DEVICE, compute_type="int8")

        # Use task='translate' so multilingual Telugu/Hindi/Hinglish audio is translated into English
        segments, info = whisper_model.transcribe(tmp_path, beam_size=5, task="translate")
        raw_transcript = " ".join([segment.text.strip() for segment in segments])
        clean_transcript = strip_fillers(raw_transcript)

        try:
            os.remove(tmp_path)
        except Exception:
            pass

        return {
            "text": clean_transcript,
            "raw_text": raw_transcript,
            "language": info.language,
            "duration": info.duration
        }

    except Exception as e:
        print(f"Transcription error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 9000))
    uvicorn.run(app, host="0.0.0.0", port=port)
