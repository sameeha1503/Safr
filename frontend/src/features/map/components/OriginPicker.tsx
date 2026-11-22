import { Loader2, LocateFixed, MapPin, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Hit } from "../lib/types";

export interface OriginPickerProps {
  originLabel: string;
  isGpsOrigin: boolean;
  locating: boolean;
  onRequestLocation: () => void;
  showOriginSearch: boolean;
  setShowOriginSearch: (show: boolean) => void;
  originQuery: string;
  setOriginQuery: (q: string) => void;
  onSearchOrigin: (q: string) => void;
  isSearchingOrigin: boolean;
  originHits: Hit[];
  onSelectOrigin: (hit: Hit) => void;
}

export function OriginPicker({
  originLabel,
  isGpsOrigin,
  locating,
  onRequestLocation,
  showOriginSearch,
  setShowOriginSearch,
  originQuery,
  setOriginQuery,
  onSearchOrigin,
  isSearchingOrigin,
  originHits,
  onSelectOrigin,
}: OriginPickerProps) {
  return (
    <div className="rounded-3xl border border-border/60 bg-card/85 backdrop-blur-xl p-4 shadow-xs">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div
            className={`size-2.5 rounded-full shrink-0 ${
              isGpsOrigin ? "bg-emerald-500 animate-pulse" : "bg-primary"
            }`}
          />
          <div className="text-xs truncate">
            <span className="text-muted-foreground">From: </span>
            <strong className="text-foreground">{originLabel}</strong>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <Button
            type="button"
            variant={isGpsOrigin ? "secondary" : "outline"}
            size="sm"
            aria-label="Use Current GPS Location"
            onClick={onRequestLocation}
            disabled={locating}
            className="h-7 px-2.5 rounded-full text-xs font-semibold"
          >
            {locating ? (
              <Loader2 className="size-3 animate-spin" />
            ) : (
              <LocateFixed className="size-3 text-primary" />
            )}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            aria-label="Change starting origin"
            onClick={() => setShowOriginSearch(!showOriginSearch)}
            className="h-7 px-2.5 rounded-full text-xs"
          >
            <MapPin className="size-3 mr-1 text-muted-foreground" />
            {showOriginSearch ? "Cancel" : "Change"}
          </Button>
        </div>
      </div>

      {showOriginSearch && (
        <div className="mt-3 pt-3 border-t border-border/40">
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (originQuery.trim().length >= 2) {
                onSearchOrigin(originQuery.trim());
              }
            }}
          >
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
              <Input
                value={originQuery}
                placeholder="Search origin in Goa…"
                onChange={(e) => setOriginQuery(e.target.value)}
                className="h-8 pl-8 pr-2 rounded-full text-xs bg-background/80"
              />
            </div>
            <Button
              type="submit"
              size="sm"
              className="h-8 rounded-full px-3 text-xs"
              disabled={isSearchingOrigin}
            >
              {isSearchingOrigin ? (
                <Loader2 className="size-3 animate-spin" />
              ) : (
                "Search"
              )}
            </Button>
          </form>

          {originHits.length > 0 && (
            <div className="mt-2 rounded-2xl border border-border/50 bg-card overflow-hidden shadow-md max-h-48 overflow-y-auto">
              {originHits.map((h) => (
                <button
                  key={h.id}
                  type="button"
                  onClick={() => onSelectOrigin(h)}
                  className="block w-full border-b border-border/30 px-3 py-2 text-left last:border-0 hover:bg-muted text-xs"
                >
                  <span className="font-bold block text-foreground">
                    {h.name}
                  </span>
                  <span className="text-[11px] text-muted-foreground truncate block">
                    {h.address}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
