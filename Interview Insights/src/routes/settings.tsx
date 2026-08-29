import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import Shell from "@/components/Shell";
import { useStudio } from "@/lib/store";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "Settings — Interview Transcriber Studio" },
      {
        name: "description",
        content:
          "Configure transcription and summarization keys, the media cloud name, and the preferred summary model for the studio.",
      },
      { property: "og:title", content: "Settings — Interview Transcriber Studio" },
      {
        property: "og:description",
        content: "Transcription keys, media storage, and summary model configuration.",
      },
    ],
  }),
  component: SettingsView,
});

const FIELDS = [
  { key: "groqKey", label: "Groq API Key", placeholder: "gsk_…", type: "password" },
  { key: "geminiKey", label: "Gemini API Key", placeholder: "AIzaSy…", type: "password" },
  { key: "cloudName", label: "Cloudinary Cloud Name", placeholder: "your-cloud", type: "text" },
  {
    key: "summaryModel",
    label: "Summary Model",
    placeholder: "gemini-1.5-flash-latest",
    type: "text",
  },
] as const;

function SettingsView() {
  const { state, saveSettings } = useStudio();
  const [form, setForm] = useState(state.settings);
  const [saved, setSaved] = useState(false);

  return (
    <Shell>
      <main className="mx-auto max-w-[640px] px-6 py-8">
        <div className="animate-rise mb-4">
          <p className="text-[10px] uppercase tracking-[0.22em] text-inkmuted">Configuration</p>
          <h1 className="display text-2xl font-semibold text-balance">Settings</h1>
          <p className="mt-1 text-[12px] text-inkmuted">
            Keys stay on this device and are used by the transcription pipeline.
          </p>
        </div>

        <div className="animate-rise space-y-3 rounded-2xl bg-panel p-5 ring-1 ring-line">
          {FIELDS.map((f) => (
            <label key={f.key} className="block">
              <span className="text-[10px] uppercase tracking-[0.18em] text-inkmuted">
                {f.label}
              </span>
              <input
                type={f.type}
                value={form[f.key]}
                onChange={(e) => {
                  setForm({ ...form, [f.key]: e.target.value });
                  setSaved(false);
                }}
                placeholder={f.placeholder}
                className="mono mt-1.5 w-full rounded-xl bg-background px-3 py-2.5 text-[12px] ring-1 ring-line outline-none placeholder:text-inkmuted/60 focus:ring-signal/50"
              />
            </label>
          ))}

          <div className="flex items-center gap-3 pt-1">
            <button
              onClick={() => {
                saveSettings(form);
                setSaved(true);
              }}
              className="rounded-xl bg-signal px-4 py-2.5 text-[11px] font-semibold text-background transition-colors hover:bg-live"
            >
              Save
            </button>
            {saved && <span className="mono text-[11px] text-signal">Saved</span>}
          </div>
        </div>
      </main>
    </Shell>
  );
}
