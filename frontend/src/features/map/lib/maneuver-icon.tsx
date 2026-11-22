import {
  CornerUpLeft,
  CornerUpRight,
  Flag,
  MoveUp,
  RotateCcw,
  Split,
} from "lucide-react";

export function getManeuverIcon(type: string, modifier?: string) {
  if (type === "arrive") return <Flag className="size-4 text-emerald" />;
  if (type === "roundabout" || type === "rotary")
    return <RotateCcw className="size-4 text-amber" />;
  if (type === "fork" || type === "merge")
    return <Split className="size-4 text-cyan" />;
  if (modifier?.includes("left"))
    return <CornerUpLeft className="size-4 text-primary" />;
  if (modifier?.includes("right"))
    return <CornerUpRight className="size-4 text-coral" />;
  return <MoveUp className="size-4 text-primary" />;
}
