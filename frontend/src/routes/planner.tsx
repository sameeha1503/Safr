import { createFileRoute } from "@tanstack/react-router";
import { GoaTripPlannerSection } from "@/features/planner/components/GoaTripPlannerSection";

export const Route = createFileRoute("/planner")({
  component: PlannerPage,
});

function PlannerPage() {
  return (
    <div className="min-h-screen bg-background">
      <GoaTripPlannerSection />
    </div>
  );
}
