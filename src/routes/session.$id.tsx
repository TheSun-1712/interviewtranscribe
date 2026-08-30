import { createFileRoute } from "@tanstack/react-router";
import { SessionView } from "../components/SessionView";
import { RequireAuth } from "../components/RequireAuth";

export const Route = createFileRoute("/session/$id")({
  component: function SessionPage() {
    const { id } = Route.useParams();
    return (
      <RequireAuth>
        <SessionView candidateId={id} />
      </RequireAuth>
    );
  },
});
