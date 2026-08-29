import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import { useStudio } from "@/lib/store";
import { exportAllCandidates } from "@/lib/excelExporter";

const NAV = [
  { to: "/candidates", label: "Roster" },
  { to: "/questions", label: "Bank" },
  { to: "/settings", label: "Settings" },
] as const;

export default function Shell({ children }: { children: ReactNode }) {
  const { ready, state, logout, resetDatabase, exportExcel } = useStudio();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [resetOpen, setResetOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [resetError, setResetError] = useState<string | null>(null);

  useEffect(() => {
    if (ready && !state.authed) navigate({ to: "/" });
  }, [ready, state.authed, navigate]);

  if (!ready || !state.authed) {
    return (
      <div className="min-h-screen grid place-items-center">
        <p className="mono text-[11px] uppercase tracking-[0.22em] text-inkmuted">Loading console…</p>
      </div>
    );
  }

  const confirmReset = async () => {
    const ok = await resetDatabase(password);
    if (ok) {
      setResetOpen(false);
      setPassword("");
      setResetError(null);
      navigate({ to: "/candidates" });
    } else {
      setResetError("Incorrect admin password.");
    }
  };

  return (
    <div className="min-h-screen bg-background text-ink">
      <header className="sticky top-0 z-20 border-b border-line bg-background/85 backdrop-blur-sm">
        <div className="mx-auto flex h-16 max-w-[1200px] items-center gap-4 px-6">
          <Link to="/candidates" className="flex items-center gap-2.5">
            <span className="size-2.5 rounded-full bg-live animate-ring" />
            <span className="leading-none">
              <span className="display block text-[15px] font-semibold">
                Interview Transcriber Studio
              </span>
              <span className="mt-1 block text-[9px] uppercase tracking-[0.22em] text-inkmuted">
                Internal · Operator Console
              </span>
            </span>
          </Link>
          <nav className="ml-6 hidden items-center gap-1 text-[11px] md:flex">
            {NAV.map((item) => {
              const active =
                item.to === "/candidates"
                  ? pathname.startsWith("/candidates") || pathname.startsWith("/session")
                  : pathname.startsWith(item.to);
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={`rounded-full px-3 py-2 transition-colors ${
                    active
                      ? "bg-signal-soft font-semibold text-signal"
                      : "text-inkmuted hover:bg-panel2"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <button
              onClick={() => exportExcel ? exportExcel() : exportAllCandidates(state.candidates)}
              className="rounded-full bg-signal px-3.5 py-2 text-[11px] font-semibold text-background transition-colors hover:bg-live"
            >
              Export Excel
            </button>
            <button
              onClick={() => setResetOpen(true)}
              className="rounded-full px-3.5 py-2 text-[11px] text-inkmuted ring-1 ring-line transition-colors hover:text-danger hover:ring-danger/40"
            >
              Reset DB
            </button>
            <button
              onClick={() => {
                logout();
                navigate({ to: "/" });
              }}
              className="rounded-full px-3.5 py-2 text-[11px] text-inkmuted ring-1 ring-line transition-colors hover:text-ink hover:ring-inkmuted/40"
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      {children}

      {resetOpen && (
        <div className="fixed inset-0 z-40 grid place-items-center bg-ink/40 px-6 backdrop-blur-sm">
          <div className="animate-rise w-full max-w-md rounded-2xl bg-panel p-5 ring-1 ring-line">
            <p className="text-[10px] uppercase tracking-[0.22em] text-danger">Destructive action</p>
            <h2 className="display mt-1 text-xl font-semibold">Reset database</h2>
            <p className="mt-2 text-[12px] leading-relaxed text-inkmuted">
              Are you sure you want to reset the database? All recordings will be cleared and the 12
              official questions re-seeded.
            </p>
            <input
              type="password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                setResetError(null);
              }}
              placeholder="Admin password"
              className="mono mt-4 w-full rounded-xl bg-background px-3 py-2.5 text-[12px] ring-1 ring-line outline-none focus:ring-signal/50"
            />
            {resetError && <p className="mt-2 text-[11px] text-danger">{resetError}</p>}
            <div className="mt-4 flex gap-2">
              <button
                onClick={confirmReset}
                className="flex-1 rounded-xl bg-danger px-3 py-2 text-[11px] font-semibold text-background transition-opacity hover:opacity-90"
              >
                Confirm Reset
              </button>
              <button
                onClick={() => {
                  setResetOpen(false);
                  setResetError(null);
                  setPassword("");
                }}
                className="rounded-xl px-3 py-2 text-[11px] text-inkmuted ring-1 ring-line transition-colors hover:text-ink"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
