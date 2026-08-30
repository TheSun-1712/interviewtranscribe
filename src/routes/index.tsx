import { createFileRoute } from "@tanstack/react-router";
import { CandidateList } from "../components/CandidateList";
import { RequireAuth } from "../components/RequireAuth";

export const Route = createFileRoute("/")({
  component: () => (
    <RequireAuth>
      <CandidateList />
    </RequireAuth>
  ),
});
