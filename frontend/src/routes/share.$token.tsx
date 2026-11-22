import { createFileRoute } from "@tanstack/react-router";
import { CompanionPage } from "@/features/tracking/components/CompanionPage";
export const Route = createFileRoute("/share/$token")({
  head: () => ({
    meta: [
      { name: "robots", content: "noindex, nofollow" },
      { name: "referrer", content: "no-referrer" },
    ],
  }),
  component: ShareRoute,
});
function ShareRoute() {
  const { token } = Route.useParams();
  return <CompanionPage token={token} />;
}
