import { useState } from "react";
import { Mic, ShieldCheck } from "lucide-react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { login } from "../services/api";
import { useAuth } from "../lib/auth";
import { toast } from "sonner";

export function LoginView() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      toast.error("Enter your panel email and password.");
      return;
    }
    setLoading(true);
    try {
      const user = await login(email, password);
      signIn(user);
      toast.success(`Welcome back, ${user.name}`);
    } catch {
      toast.error("Login failed. Check your credentials.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-16">
      <div className="glass-panel w-full max-w-md p-8">
        <div className="gradient-hero mb-6 flex h-14 w-14 items-center justify-center rounded-2xl">
          <Mic className="h-6 w-6 text-primary" />
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Interview <span className="gradient-text">Transcribe</span> &amp; Evaluation
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Sign in to access the candidate roster, record sessions and score answers.
        </p>

        <form onSubmit={submit} className="mt-8 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Panel email</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              placeholder="interviewer@panel.edu"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              placeholder="•••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Signing in…" : "Sign in"}
          </Button>
        </form>

        <p className="mt-6 flex items-center gap-2 text-xs text-muted-foreground">
          <ShieldCheck className="h-3.5 w-3.5" />
          Session persists locally until you log out.
        </p>
      </div>
    </main>
  );
}
