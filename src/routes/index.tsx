import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useStudio } from "@/lib/store";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Interview Tracker — Login" },
      {
        name: "description",
        content: "Interview Tracker — SIGNAL / ADMIN ACCESS",
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
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (ready && state.authed) {
      navigate({ to: "/candidates" });
    }
  }, [ready, state.authed, navigate]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!password) {
      setError("Please enter the shared password");
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch("http://localhost:4000/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password })
      });

      if (res.ok || login(password)) {
        login(password);
        navigate({ to: "/candidates" });
      } else {
        setError("Invalid password");
      }
    } catch {
      if (login(password)) {
        navigate({ to: "/candidates" });
      } else {
        setError("Invalid password");
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="login-wrap">
      <div className="login-card">
        <span className="login-mark">SIGNAL / ADMIN ACCESS</span>
        <h1 className="login-title">Interview Tracker</h1>
        <div className="login-meter">
          <i style={{ height: "30%" }}></i>
          <i style={{ height: "55%" }}></i>
          <i style={{ height: "25%" }}></i>
          <i style={{ height: "70%" }}></i>
          <i style={{ height: "40%" }}></i>
          <i style={{ height: "60%" }}></i>
          <i style={{ height: "20%" }}></i>
          <i style={{ height: "50%" }}></i>
        </div>
        <label className="field-label">Shared password</label>
        <form onSubmit={submit}>
          <input
            type="password"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              setError(null);
            }}
            placeholder="Enter password"
            autoFocus
          />
          {error && (
            <span style={{ color: "var(--red)", fontFamily: "var(--mono)", fontSize: "11px", display: "block", marginBottom: "12px" }}>
              {error}
            </span>
          )}
          <button type="submit" className="btn-primary" disabled={isLoading}>
            {isLoading ? "Signing in..." : "Sign in"}
          </button>
        </form>
      </div>
    </div>
  );
}

