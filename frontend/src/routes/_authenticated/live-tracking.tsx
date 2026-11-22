import { createFileRoute } from "@tanstack/react-router";
import { GuardianWorkspace } from "@/features/tracking/components/GuardianWorkspace";
export const Route = createFileRoute("/_authenticated/live-tracking")({
  component: GuardianWorkspace,
});
