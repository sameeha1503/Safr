import { ListOrdered } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatDistance } from "../lib/format";
import { getManeuverIcon } from "../lib/maneuver-icon";
import type { RouteStep } from "@/lib/maps.server";

export interface RouteManeuversListProps {
  steps: RouteStep[];
  showDirections: boolean;
  setShowDirections: (show: boolean | ((prev: boolean) => boolean)) => void;
  activeStepIndex: number | null;
  onStepClick: (step: RouteStep, idx: number) => void;
}

export function RouteManeuversList({
  steps,
  showDirections,
  setShowDirections,
  activeStepIndex,
  onStepClick,
}: RouteManeuversListProps) {
  return (
    <div className="border-t border-border/40 pt-3">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-bold uppercase tracking-wider text-primary flex items-center gap-1">
          <ListOrdered className="size-3.5" /> Maneuvers ({steps.length})
        </span>
        <Button
          variant="ghost"
          size="sm"
          className="h-6 text-[10px] px-2"
          onClick={() => setShowDirections(!showDirections)}
        >
          {showDirections ? "Hide" : "Show"}
        </Button>
      </div>

      {showDirections && (
        <div className="max-h-60 overflow-y-auto pr-1 space-y-1 rounded-2xl border border-border/40 bg-secondary/20 p-2">
          {steps.map((step, sIdx) => {
            const isActive = activeStepIndex === sIdx;
            return (
              <div
                key={sIdx}
                onClick={() => onStepClick(step, sIdx)}
                className={`flex items-start gap-2.5 p-2 rounded-xl cursor-pointer transition-all ${
                  isActive
                    ? "bg-primary/20 border border-primary/40 shadow-xs"
                    : "hover:bg-muted/60"
                }`}
              >
                <div className="flex size-6 shrink-0 items-center justify-center rounded-lg bg-card border border-border/60 mt-0.5">
                  {getManeuverIcon(step.maneuverType, step.maneuverModifier)}
                </div>
                <div className="min-w-0 flex-1">
                  <p
                    className={`text-xs font-bold leading-tight ${isActive ? "text-primary" : "text-foreground"}`}
                  >
                    {step.instruction}
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    {formatDistance(step.distanceMeters)}
                    {step.durationSeconds > 0 &&
                      ` · ~${Math.ceil(step.durationSeconds / 60)}m`}
                  </p>
                </div>
                <span className="text-[9px] font-mono font-bold text-muted-foreground px-1 py-0.5 rounded bg-card border border-border/40">
                  #{sIdx + 1}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
