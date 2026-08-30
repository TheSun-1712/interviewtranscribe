import type { ReactNode } from "react";
import { useAuth } from "../lib/auth";
import { AppShell } from "./AppShell";
import { LoginView } from "./LoginView";

export function RequireAuth({ children }: { children: ReactNode }) {
  const { user, hydrated } = useAuth();
  if (!hydrated) return <div className="min-h-screen" />;
  if (!user) return <LoginView />;
  return <AppShell>{children}</AppShell>;
}
