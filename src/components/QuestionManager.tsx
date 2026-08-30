import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Textarea } from "./ui/textarea";
import { Badge } from "./ui/badge";
import { fetchQuestions, upsertQuestion, type QuestionTemplate } from "../services/api";

function QuestionRow({ question }: { question: QuestionTemplate }) {
  const qc = useQueryClient();
  const [prompt, setPrompt] = useState(question.prompt);
  const [category, setCategory] = useState(question.category);

  const save = useMutation({
    mutationFn: () => upsertQuestion({ index: question.index, category, prompt }),
    onSuccess: () => {
      toast.success(`Question ${question.index} saved`);
      qc.invalidateQueries({ queryKey: ["questions"] });
    },
    onError: () => toast.error("Could not save question"),
  });

  const dirty = prompt !== question.prompt || category !== question.category;

  return (
    <div className="glass-panel space-y-3 p-5">
      <div className="flex items-center gap-3">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-secondary text-sm font-semibold">
          {question.index}
        </span>
        <Input
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="max-w-56"
          aria-label={`Category for question ${question.index}`}
        />
        {dirty ? (
          <Badge className="border border-warning/40 bg-warning/15 text-warning">Unsaved</Badge>
        ) : null}
        <Button
          size="sm"
          className="ml-auto"
          disabled={!dirty || save.isPending}
          onClick={() => save.mutate()}
        >
          <Save className="mr-1.5 h-3.5 w-3.5" /> Save
        </Button>
      </div>
      <Textarea rows={2} value={prompt} onChange={(e) => setPrompt(e.target.value)} />
    </div>
  );
}

export function QuestionManager() {
  const qc = useQueryClient();
  const { data: questions = [], isLoading } = useQuery({
    queryKey: ["questions"],
    queryFn: fetchQuestions,
  });
  const [newCategory, setNewCategory] = useState("");
  const [newPrompt, setNewPrompt] = useState("");

  const add = useMutation({
    mutationFn: () =>
      upsertQuestion({
        index: Math.max(0, ...questions.map((q) => q.index)) + 1,
        category: newCategory || "Custom",
        prompt: newPrompt,
      }),
    onSuccess: () => {
      toast.success("Question added");
      setNewCategory("");
      setNewPrompt("");
      qc.invalidateQueries({ queryKey: ["questions"] });
    },
    onError: () => toast.error("Could not add question"),
  });

  return (
    <div className="space-y-8">
      <section className="glass-panel gradient-hero p-6">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Question bank</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          The 12-question rubric used to segment every interview transcript.
        </p>
      </section>

      {isLoading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading questions…
        </div>
      ) : (
        <div className="space-y-3">
          {questions.map((q) => (
            <QuestionRow key={q.index} question={q} />
          ))}
        </div>
      )}

      <section className="glass-panel space-y-4 p-5">
        <h2 className="text-lg font-semibold tracking-tight">Add a custom question</h2>
        <div className="grid gap-4 sm:grid-cols-[220px_1fr]">
          <div className="space-y-2">
            <Label htmlFor="new-category">Category</Label>
            <Input
              id="new-category"
              value={newCategory}
              onChange={(e) => setNewCategory(e.target.value)}
              placeholder="Domain Technical"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="new-prompt">Prompt</Label>
            <Textarea
              id="new-prompt"
              rows={2}
              value={newPrompt}
              onChange={(e) => setNewPrompt(e.target.value)}
            />
          </div>
        </div>
        <Button disabled={!newPrompt || add.isPending} onClick={() => add.mutate()}>
          Add question
        </Button>
      </section>
    </div>
  );
}
