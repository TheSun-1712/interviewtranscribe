import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useStudio } from "@/lib/store";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Sign In — Interview Transcriber Studio" },
      {
        name: "description",
        content:
          "Operator sign-in for Interview Transcriber Studio: record interviews, auto-summarize answers, and export candidate workbooks.",
      },
      { property: "og:title", content: "Sign In — Interview Transcriber Studio" },
      {
        property: "og:description",
        content: "Operator console for interview recording, AI summaries, and Excel exports.",
      },
    ],
  }),
  component: LoginView,
});

function LoginView() {
  const { ready, state, login } = useStudio();
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (ready && state.authed) navigate({ to: "/candidates" });
  }, [ready, state.authed, navigate]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (login(password)) navigate({ to: "/candidates" });
    else setError("Invalid admin password");
  };

  return (
    <main className="grid min-h-screen place-items-center px-6">
      <div className="animate-rise w-full max-w-sm">
        <div className="rounded-2xl bg-panel p-6 ring-1 ring-line">
          <div className="flex items-end gap-1.5" aria-hidden="true">
            {[0.35, 0.7, 1, 0.5, 0.85, 0.4, 0.95, 0.6, 0.3].map((h, i) => (
              <span
                key={i}
                className="animate-meter w-1 rounded-full bg-live/70"
                style={{ height: `${h * 32}px`, animationDelay: `${i * 0.09}s` }}
              />
            ))}
          </div>
          <p className="mt-5 text-[10px] uppercase tracking-[0.22em] text-inkmuted">
            Signal · Admin Access
          </p>
          <h1 className="display mt-1 text-2xl font-semibold text-balance">
            Interview Transcriber Studio
          </h1>
          <p className="mt-2 text-[12px] leading-relaxed text-inkmuted">
            Enter the shared operator password to open the candidate roster.
          </p>

          <form onSubmit={submit} className="mt-5">
            <input
              type="password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                setError(null);
              }}
              placeholder="Admin password"
              className="mono w-full rounded-xl bg-background px-3 py-2.5 text-[12px] ring-1 ring-line outline-none placeholder:text-inkmuted/60 focus:ring-signal/50"
            />
            {error && (
              <p className="mt-2.5 rounded-lg bg-danger-soft px-3 py-2 text-[11px] text-danger">
                {error}
              </p>
            )}
            <button
              type="submit"
              className="mt-3 w-full rounded-xl bg-signal px-3 py-2.5 text-[11px] font-semibold text-background transition-colors hover:bg-live"
            >
              Sign In
            </button>
          </form>
        </div>
        <p className="mono mt-3 text-center text-[10px] text-inkmuted">
          Demo password · admin123
        </p>
      </div>
    </main>
  );
}
