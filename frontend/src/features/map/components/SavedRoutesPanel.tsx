import { Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";

export type SavedRouteItem =
  import("@/integrations/supabase/types").Database["public"]["Tables"]["saved_routes"]["Row"];

export interface SavedRoutesPanelProps {
  isOpen: boolean;
  error?: boolean;
  pending?: boolean;
  onRetry?: () => void;
  savedRoutesList: SavedRouteItem[];
  onClose: () => void;
  onSelectRoute: (route: SavedRouteItem) => void;
  onDeleteRoute: (id: string) => void;
}

export function SavedRoutesPanel({
  isOpen,
  error,
  pending,
  onRetry,
  savedRoutesList,
  onClose,
  onSelectRoute,
  onDeleteRoute,
}: SavedRoutesPanelProps) {
  if (!isOpen) return null;

  return (
    <div className="rounded-3xl border border-border/60 bg-card p-4 shadow-lg animate-in fade-in duration-200">
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-xs font-bold text-foreground uppercase tracking-wider">
          Saved Trips
        </h4>
        <Button
          size="sm"
          variant="ghost"
          className="h-6 w-6 p-0"
          onClick={onClose}
        >
          <X className="size-3.5" />
        </Button>
      </div>
      {error ? (
        <div className="text-sm">
          Saved routes could not be loaded.{" "}
          <Button variant="outline" size="sm" onClick={onRetry}>
            Retry
          </Button>
        </div>
      ) : pending ? (
        <p role="status">Loading saved routes…</p>
      ) : savedRoutesList.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          No saved routes yet. Plan a trip and click "Save Route".
        </p>
      ) : (
        <div className="space-y-1.5 max-h-48 overflow-y-auto">
          {savedRoutesList.map((sr) => (
            <div
              key={sr.id}
              className="p-2.5 rounded-2xl border border-border/40 bg-secondary/30 hover:bg-secondary/60 transition-colors flex items-center justify-between gap-2"
            >
              <button
                type="button"
                onClick={() => onSelectRoute(sr)}
                className="text-left text-xs font-bold text-foreground truncate min-w-0"
              >
                {sr.name}
              </button>

              <Button
                type="button"
                variant="ghost"
                size="sm"
                aria-label="Delete saved route"
                onClick={() => onDeleteRoute(sr.id)}
                className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
              >
                <Trash2 className="size-3" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
