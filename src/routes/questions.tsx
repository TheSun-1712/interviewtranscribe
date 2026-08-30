import { createFileRoute } from "@tanstack/react-router";
import { QuestionManager } from "../components/QuestionManager";
import { RequireAuth } from "../components/RequireAuth";

export const Route = createFileRoute("/questions")({
  component: () => (
    <RequireAuth>
      <QuestionManager />
    </RequireAuth>
  ),
});
