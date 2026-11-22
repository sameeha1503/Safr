import { Bookmark, ChevronDown, ChevronUp, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatDistance } from "../lib/format";
import type { ScoredRoute } from "@/lib/maps.server";

export interface MobileRouteSheetProps {
  currentRoute: ScoredRoute | undefined;
  sheetExpanded: boolean;
  setSheetExpanded: (expanded: boolean | ((prev: boolean) => boolean)) => void;
  onShareRoute: () => void;
  onSaveRoute: () => void;
}

export function MobileRouteSheet({
  currentRoute,
  sheetExpanded,
  setSheetExpanded,
  onShareRoute,
  onSaveRoute,
}: MobileRouteSheetProps) {
  if (!currentRoute) return null;

  return (
    <div className="lg:hidden absolute bottom-3 left-3 right-3 z-10 pointer-events-auto">
      <div className="rounded-2xl border border-border/70 bg-card/95 backdrop-blur-2xl shadow-xl overflow-hidden transition-all duration-300">
        <button
          type="button"
          onClick={() => setSheetExpanded((prev) => !prev)}
          className="w-full p-3 flex items-center justify-between text-left hover:bg-muted/50 transition-colors"
        >
          <div className="min-w-0 pr-2">
            <span className="font-bold text-xs text-foreground block truncate">
              {currentRoute.summary}
            </span>
            <span className="text-[11px] text-muted-foreground font-semibold">
              {currentRoute.durationMin} min · {currentRoute.distanceKm} km ·{" "}
              {currentRoute.label}
            </span>
          </div>
          <div className="size-7 rounded-full bg-secondary flex items-center justify-center shrink-0">
            {sheetExpanded ? (
              <ChevronDown className="size-4" />
            ) : (
              <ChevronUp className="size-4" />
            )}
          </div>
        </button>

        {sheetExpanded && (
          <div className="p-3 pt-0 border-t border-border/40 max-h-56 overflow-y-auto space-y-2 mt-1">
            <div className="flex items-center gap-2 pt-2">
              {currentRoute.googleMapsUrl && (
                <a
                  href={currentRoute.googleMapsUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="flex-1 text-center py-2 rounded-xl bg-primary text-primary-foreground text-xs font-bold shadow-xs"
                >
                  GPS Navigation
                </a>
              )}
              <Button
                size="sm"
                variant="outline"
                onClick={onShareRoute}
                className="h-8 rounded-xl px-3 text-xs"
              >
                <Share2 className="size-3.5" />
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={onSaveRoute}
                className="h-8 rounded-xl px-3 text-xs"
              >
                <Bookmark className="size-3.5" />
              </Button>
            </div>

            {currentRoute.legs && currentRoute.legs.length > 1 && (
              <div className="space-y-1">
                <span className="text-[9px] font-bold uppercase text-muted-foreground">
                  Legs
                </span>
                {currentRoute.legs.map((leg) => (
                  <div
                    key={leg.legIndex}
                    className="text-[11px] text-foreground flex justify-between"
                  >
                    <span className="truncate max-w-[180px]">
                      {leg.fromName} → {leg.toName}
                    </span>
                    <span className="font-mono text-muted-foreground">
                      {formatDistance(leg.distanceMeters)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
