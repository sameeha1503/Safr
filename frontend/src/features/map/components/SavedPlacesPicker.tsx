import { Heart, X } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface SavedPlaceRecord {
  id: string;
  place_name: string;
  category?: string;
  lat?: number | null;
  lng?: number | null;
}

export interface SavedPlacesPickerProps {
  isOpen: boolean;
  savedPlaces: SavedPlaceRecord[];
  error?: boolean;
  pending?: boolean;
  onRetry?: () => void;
  onClose: () => void;
  onAddStop: (place: SavedPlaceRecord) => void;
  onSetDestination: (place: SavedPlaceRecord) => void;
}

export function SavedPlacesPicker({
  isOpen,
  savedPlaces,
  error,
  pending,
  onRetry,
  onClose,
  onAddStop,
  onSetDestination,
}: SavedPlacesPickerProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md rounded-3xl border border-border bg-card p-6 shadow-2xl space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-base text-foreground flex items-center gap-2">
            <Heart className="size-4 text-coral" /> Bucket List Places
          </h3>
          <Button
            size="sm"
            variant="ghost"
            className="h-8 w-8 p-0 rounded-full"
            onClick={onClose}
          >
            <X className="size-4" />
          </Button>
        </div>

        {error ? (
          <div role="alert" className="space-y-2 text-sm">
            <p>Your bucket list could not be loaded.</p>
            <Button variant="outline" onClick={onRetry}>
              Retry
            </Button>
          </div>
        ) : pending ? (
          <p role="status" className="text-sm text-muted-foreground">
            Loading your bucket list…
          </p>
        ) : savedPlaces.length === 0 ? (
          <p className="text-xs text-muted-foreground py-4 text-center">
            Your bucket list is empty. Explore places in Goa and tap the heart
            icon to save them!
          </p>
        ) : (
          <div className="max-h-72 overflow-y-auto space-y-2 pr-1">
            {savedPlaces.map((sp) => (
              <div
                key={sp.id}
                className="p-3 rounded-2xl border border-border/40 bg-secondary/30 flex items-center justify-between gap-3"
              >
                <div className="min-w-0">
                  <h4 className="font-bold text-xs text-foreground truncate">
                    {sp.place_name}
                  </h4>
                  <span className="text-[10px] text-muted-foreground uppercase font-semibold block">
                    {sp.category}
                  </span>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => onAddStop(sp)}
                    className="h-7 text-[10px] px-2.5 rounded-full font-bold"
                  >
                    + Stop
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => onSetDestination(sp)}
                    className="h-7 text-[10px] px-2.5 rounded-full font-bold"
                  >
                    Dest
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
