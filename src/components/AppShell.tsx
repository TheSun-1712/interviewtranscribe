import { Link } from "@tanstack/react-router";
import { LogOut, Mic, ListChecks, Users } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "./ui/button";
import { useAuth } from "../lib/auth";

export function AppShell({ children }: { children: ReactNode }) {
  const { user, signOut } = useAuth();

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 border-b border-border/60 bg-background/70 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center gap-4 px-4 py-3 sm:px-6">
          <Link to="/" className="flex items-center gap-2.5">
            <span className="gradient-hero flex h-9 w-9 items-center justify-center rounded-xl">
              <Mic className="h-4 w-4 text-primary" />
            </span>
            <span className="text-sm font-semibold tracking-tight sm:text-base">
              Interview <span className="gradient-text">Panel</span>
            </span>
          </Link>

          <nav className="ml-4 hidden items-center gap-1 sm:flex">
            <Link
              to="/"
              className="rounded-lg px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
              activeProps={{ className: "bg-secondary text-foreground" }}
              activeOptions={{ exact: true }}
            >
              <span className="flex items-center gap-1.5">
                <Users className="h-3.5 w-3.5" /> Candidates
              </span>
            </Link>
            <Link
              to="/questions"
              className="rounded-lg px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
              activeProps={{ className: "bg-secondary text-foreground" }}
            >
              <span className="flex items-center gap-1.5">
                <ListChecks className="h-3.5 w-3.5" /> Question bank
              </span>
            </Link>
          </nav>

          <div className="ml-auto flex items-center gap-3">
            {user ? (
              <span className="hidden text-right sm:block">
                <span className="block text-sm font-medium capitalize">{user.name}</span>
                <span className="block text-xs text-muted-foreground">
                  {user.role === "panel_lead" ? "Panel lead" : "Interviewer"}
                </span>
              </span>
            ) : null}
            <Button variant="ghost" size="sm" onClick={signOut}>
              <LogOut className="mr-1.5 h-3.5 w-3.5" /> Log out
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">{children}</main>
    </div>
  );
}
