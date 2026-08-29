import React, { useState } from "react";
import { FileSpreadsheet } from "lucide-react";

export default function SettingsView({ onExportExcel, onLogout }) {
  const [llmBaseUrl, setLlmBaseUrl] = useState("https://api.groq.com/openai/v1");
  const [llmApiKey, setLlmApiKey] = useState("");
  const [llmModel, setLlmModel] = useState("llama-3.1-8b-instant");
  const [transcriptionUrl, setTranscriptionUrl] = useState("http://localhost:9000");
  const [saved, setSaved] = useState(false);

  const handleSave = (e) => {
    e.preventDefault();
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  return (
    <div>
      {/* Topbar */}
      <div className="topbar">
        <span className="mark">SIGNAL</span>
        <h1>Settings</h1>
        <div className="flex-1" />
        <button onClick={onExportExcel} className="ghost-btn font-mono text-xs">
          <FileSpreadsheet className="h-3.5 w-3.5 inline mr-1 text-[var(--teal)]" />
          Export Excel
        </button>
        <button onClick={onLogout} className="ghost-btn font-mono text-xs">
          Log out
        </button>
      </div>

      <div className="p-[26px_28px] max-w-[800px] mx-auto space-y-6">
        <h2 className="m-0 text-[15px] text-[var(--muted)] font-mono font-semibold tracking-[0.04em] uppercase">
          RUNTIME CONFIGURATION &amp; SERVICES
        </h2>

        {saved && (
          <div className="p-3 rounded-md bg-[var(--teal-bg)] border border-[var(--teal)] text-[var(--teal)] font-mono text-xs font-semibold">
            ✓ Settings updated successfully
          </div>
        )}

        <form onSubmit={handleSave} className="space-y-5">
          {/* Cloudinary Info */}
          <div className="panel-card space-y-3">
            <label className="field-label text-[var(--amber)]">AUDIO STORAGE (CLOUD CDN)</label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 font-mono text-xs text-[var(--muted)]">
              <div className="bg-[var(--panel-2)] p-2.5 rounded border border-[var(--line)]">
                <span className="block text-[10px]">CLOUD NAME</span>
                <span className="text-[var(--text)] font-semibold">neugchyg</span>
              </div>
              <div className="bg-[var(--panel-2)] p-2.5 rounded border border-[var(--line)]">
                <span className="block text-[10px]">API KEY</span>
                <span className="text-[var(--text)] font-semibold">Configured</span>
              </div>
              <div className="bg-[var(--panel-2)] p-2.5 rounded border border-[var(--line)]">
                <span className="block text-[10px]">STATUS</span>
                <span className="text-[var(--teal)] font-semibold">Connected</span>
              </div>
            </div>
          </div>

          {/* Groq / LLM Endpoint */}
          <div className="panel-card space-y-4">
            <label className="field-label text-[var(--amber)]">LLM ENDPOINT (GROQ / OPENAI COMPATIBLE)</label>

            <div>
              <label className="field-label">Base URL</label>
              <input
                type="text"
                value={llmBaseUrl}
                onChange={(e) => setLlmBaseUrl(e.target.value)}
                className="form-input font-mono text-xs"
              />
            </div>

            <div>
              <label className="field-label">Model Name</label>
              <input
                type="text"
                value={llmModel}
                onChange={(e) => setLlmModel(e.target.value)}
                className="form-input font-mono text-xs"
              />
            </div>

            <div>
              <label className="field-label">API Key</label>
              <input
                type="password"
                placeholder="Enter LLM API Key (e.g. gsk_...)"
                value={llmApiKey}
                onChange={(e) => setLlmApiKey(e.target.value)}
                className="form-input font-mono text-xs"
              />
            </div>
          </div>

          {/* Whisper URL */}
          <div className="panel-card space-y-3">
            <label className="field-label text-[var(--amber)]">WHISPER MICROSERVICE</label>
            <input
              type="text"
              value={transcriptionUrl}
              onChange={(e) => setTranscriptionUrl(e.target.value)}
              className="form-input font-mono text-xs"
            />
          </div>

          <div className="flex justify-end">
            <button type="submit" className="btn-primary">
              Save Settings
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
