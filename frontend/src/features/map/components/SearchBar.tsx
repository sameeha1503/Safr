import { Loader2, Navigation, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { QUICK_DESTINATIONS } from "../lib/constants";
import type { Hit } from "../lib/types";

export interface SearchBarProps {
  query: string;
  setQuery: (query: string) => void;
  onSearch: (query: string) => void;
  isSearching: boolean;
  recentDestinations: Hit[];
  hits: Hit[];
  onSelectDestination: (hit: Hit) => void;
}

export function SearchBar({
  query,
  setQuery,
  onSearch,
  isSearching,
  recentDestinations,
  hits,
  onSelectDestination,
}: SearchBarProps) {
  return (
    <div className="rounded-3xl border border-border/60 bg-card/85 backdrop-blur-xl p-4 shadow-xs">
      <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground block mb-2">
        To
      </span>
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (query.trim().length >= 2) {
            onSearch(query.trim());
          }
        }}
      >
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            value={query}
            maxLength={120}
            placeholder="Beach, fort, church, or shack in Goa…"
            onChange={(e) => setQuery(e.target.value)}
            className="w-full h-11 pl-10 pr-3 rounded-full text-xs bg-background/80 shadow-inner"
          />
        </div>
        <Button
          type="submit"
          disabled={isSearching}
          aria-label="Search destinations"
          className="h-11 w-11 rounded-full p-0 shrink-0"
        >
          {isSearching ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Navigation className="size-4" />
          )}
        </Button>
      </form>

      {/* Recent Searches Chips */}
      {recentDestinations.length > 0 && (
        <div className="mt-2.5 flex flex-wrap items-center gap-1">
          <span className="text-[10px] text-muted-foreground font-semibold">
            Recent:
          </span>
          {recentDestinations.map((rd) => (
            <button
              key={rd.id}
              type="button"
              onClick={() => onSelectDestination(rd)}
              className="rounded-full bg-secondary/60 border border-border/40 px-2.5 py-0.5 text-[10px] font-semibold text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
            >
              {rd.name}
            </button>
          ))}
        </div>
      )}

      {/* Popular quick destinations */}
      <div className="mt-2 flex flex-wrap items-center gap-1">
        <span className="text-[10px] text-muted-foreground font-semibold">
          Popular:
        </span>
        {QUICK_DESTINATIONS.map((qd) => (
          <button
            key={qd.id}
            type="button"
            onClick={() => onSelectDestination(qd)}
            className="rounded-full bg-secondary/80 border border-border/50 px-2.5 py-0.5 text-[10px] font-semibold text-secondary-foreground hover:bg-primary hover:text-primary-foreground transition-all"
          >
            {qd.name}
          </button>
        ))}
      </div>

      {/* Search Hits Autocomplete */}
      {hits.length > 0 && (
        <div className="mt-3 overflow-hidden rounded-2xl border border-border/60 bg-card shadow-xl max-h-56 overflow-y-auto">
          {hits.map((h) => (
            <button
              key={h.id}
              type="button"
              onClick={() => onSelectDestination(h)}
              className="block w-full border-b border-border/30 px-4 py-2.5 text-left last:border-0 hover:bg-primary/5 transition-colors"
            >
              <span className="block text-xs font-bold text-foreground">
                {h.name}
              </span>
              <span className="block text-[11px] text-muted-foreground truncate">
                {h.address}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
