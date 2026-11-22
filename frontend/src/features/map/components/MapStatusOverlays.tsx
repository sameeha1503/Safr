import { Loader2, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface MapStatusOverlaysProps {
  isLoadingMap: boolean;
  mapLoadError: boolean;
  onRetry: () => void;
}

export function MapStatusOverlays({
  isLoadingMap,
  mapLoadError,
  onRetry,
}: MapStatusOverlaysProps) {
  return (
    <>
      {/* Loading Shimmer Overlay */}
      {isLoadingMap && !mapLoadError && (
        <div className="absolute inset-0 pointer-events-none bg-muted/30 backdrop-blur-[2px] animate-pulse flex items-center justify-center z-10">
          <span className="text-xs text-muted-foreground font-mono flex items-center gap-2">
            <Loader2 className="size-4 animate-spin text-primary" /> Loading map
            tiles…
          </span>
        </div>
      )}

      {/* Map Load Error Fallback Overlay */}
      {mapLoadError && (
        <div className="absolute inset-0 bg-background/85 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center z-20">
          <p className="text-sm font-semibold text-foreground mb-3">
            Map tiles could not be loaded.
          </p>
          <Button
            size="sm"
            variant="outline"
            onClick={onRetry}
            className="gap-2 rounded-xl text-xs font-bold"
          >
            <RotateCcw className="size-3.5" /> Retry
          </Button>
        </div>
      )}
    </>
  );
}
