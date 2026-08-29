import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import Shell from "@/components/Shell";
import { useStudio } from "@/lib/store";
import type { Question } from "@/lib/questions";

export const Route = createFileRoute("/questions")({
  head: () => ({
    meta: [
      { title: "Question Bank — Interview Transcriber Studio" },
      {
        name: "description",
        content:
          "Manage the 12 official interview questions by category and add custom domain-specific follow-ups to the shared bank.",
      },
      { property: "og:title", content: "Question Bank — Interview Transcriber Studio" },
      {
        property: "og:description",
        content: "Official interview questions grouped by category, plus custom question management.",
      },
    ],
  }),
  component: QuestionManager,
});

function QuestionManager() {
  const { questions, addCustomQuestion, removeCustomQuestion } = useStudio();
  const [category, setCategory] = useState("");
  const [prompt, setPrompt] = useState("");

  const grouped = useMemo(() => {
    const map = new Map<string, Question[]>();
    questions.forEach((q) => map.set(q.category, [...(map.get(q.category) ?? []), q]));
    return [...map.entries()];
  }, [questions]);

  const add = () => {
    if (!prompt.trim()) return;
    addCustomQuestion(category.trim() || "Custom", prompt.trim());
    setPrompt("");
    setCategory("");
  };

  return (
    <Shell>
      <main className="mx-auto max-w-[1200px] px-6 py-8">
        <div className="animate-rise mb-4">
          <p className="text-[10px] uppercase tracking-[0.22em] text-inkmuted">Administration</p>
          <h1 className="display text-2xl font-semibold text-balance">Question Bank</h1>
          <p className="mt-1 text-[12px] text-inkmuted">
            {questions.length} questions across {grouped.length} categories.
          </p>
        </div>

        <div className="animate-rise mb-5 rounded-2xl bg-panel2 p-3.5 ring-1 ring-line">
          <p className="mb-2.5 text-[10px] uppercase tracking-[0.2em] text-inkmuted">
            Add custom question
          </p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder="Category"
              className="rounded-lg bg-background px-3 py-2 text-[11px] ring-1 ring-line outline-none placeholder:text-inkmuted/60 focus:ring-signal/50 sm:w-56"
            />
            <input
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Question prompt"
              className="flex-1 rounded-lg bg-background px-3 py-2 text-[11px] ring-1 ring-line outline-none placeholder:text-inkmuted/60 focus:ring-signal/50"
            />
            <button
              onClick={add}
              className="rounded-lg bg-signal px-4 py-2 text-[11px] font-semibold text-background transition-colors hover:bg-live"
            >
              + Add Question
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          {grouped.map(([cat, items], i) => (
            <section
              key={cat}
              className="animate-rise rounded-2xl bg-panel p-4 ring-1 ring-line"
              style={{ animationDelay: `${i * 45}ms` }}
            >
              <p className="text-[10px] uppercase tracking-[0.18em] text-signal">{cat}</p>
              <ul className="mt-3 space-y-2.5">
                {items.map((q) => (
                  <li key={q.id} className="flex items-start gap-3">
                    <span className="mono mt-0.5 shrink-0 text-[11px] font-semibold text-inkmuted">
                      {q.n ? `Q${q.n}` : "C"}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-[12px] leading-relaxed text-ink/85">{q.prompt}</p>
                      <p className="mt-0.5 text-[11px] text-inkmuted">{q.objective}</p>
                    </div>
                    {q.custom && (
                      <button
                        onClick={() => removeCustomQuestion(q.id)}
                        className="mono shrink-0 rounded-lg px-2 py-1 text-[10px] text-inkmuted ring-1 ring-line transition-colors hover:text-danger hover:ring-danger/40"
                      >
                        Delete
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </main>
    </Shell>
  );
}
