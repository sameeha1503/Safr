import React from "react";
import { Compass, LocateFixed, Navigation } from "lucide-react";
import type { FollowMode } from "../hooks/useUserLocation";

export interface RecenterButtonProps {
  followMode: FollowMode;
  pannedAway: boolean;
  hasPosition: boolean;
  onCycle: () => void;
  className?: string;
}

export function RecenterButton({
  followMode,
  pannedAway,
  hasPosition,
  onCycle,
  className = "",
}: RecenterButtonProps) {
  // Only appears if position exists, and if in free mode, only after panning away
  if (!hasPosition) return null;
  if (followMode === "free" && !pannedAway) return null;

  const ariaLabel =
    followMode === "free"
      ? "Show my location"
      : followMode === "follow"
        ? "Follow my location"
        : "Follow my heading";

  return (
    <button
      type="button"
      onClick={onCycle}
      aria-label={ariaLabel}
      title={ariaLabel}
      aria-pressed={followMode !== "free" ? "true" : "false"}
      className={`safr-map-ctrl-btn shadow-md transition-all ${
        followMode === "heading"
          ? "text-primary ring-2 ring-primary/40"
          : followMode === "follow"
            ? "text-primary"
            : "text-foreground"
      } ${className}`}
    >
      {followMode === "heading" ? (
        <Compass className="size-4 animate-spin-slow" />
      ) : followMode === "follow" ? (
        <Navigation className="size-4 fill-primary/30 text-primary" />
      ) : (
        <LocateFixed className="size-4 text-foreground" />
      )}
    </button>
  );
}
