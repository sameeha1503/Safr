import { useRef, useState } from "react";
import {
  GripVertical,
  ArrowDown,
  ArrowUp,
  Heart,
  Loader2,
  Milestone,
  Plus,
  Search,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Hit } from "../lib/types";

export interface StopsEditorProps {
  waypoints: Hit[];
  onReorderStop: (from: number, to: number) => void;
  onMoveStopUp: (idx: number) => void;
  onMoveStopDown: (idx: number) => void;
  onRemoveStop: (idx: number) => void;
  onOpenBucketList: () => void;
  showAddStop: boolean;
  setShowAddStop: (show: boolean) => void;
  stopQuery: string;
  setStopQuery: (q: string) => void;
  onSearchStop: (q: string) => void;
  isSearchingStop: boolean;
  stopHits: Hit[];
  onSelectStop: (hit: Hit) => void;
}

export function StopsEditor({
  waypoints,
  onReorderStop,
  onMoveStopUp,
  onMoveStopDown,
  onRemoveStop,
  onOpenBucketList,
  showAddStop,
  setShowAddStop,
  stopQuery,
  setStopQuery,
  onSearchStop,
  isSearchingStop,
  stopHits,
  onSelectStop,
}: StopsEditorProps) {
  const dragIndex = useRef<number | null>(null);
  const [dragging, setDragging] = useState<number | null>(null);
  const [announcement, setAnnouncement] = useState("");

  return (
    <div className="rounded-3xl border border-border/60 bg-card/85 backdrop-blur-xl p-4 shadow-xs">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
          <Milestone className="size-3.5 text-sky-500" /> Stops (
          {waypoints.length}/5)
        </span>
        <div className="flex items-center gap-1.5">
          <Button
            type="button"
            variant="outline"
            size="sm"
            aria-label="Open saved places picker"
            onClick={onOpenBucketList}
            className="h-7 text-xs rounded-full gap-1 px-2.5 font-semibold"
          >
            <Heart className="size-3 text-coral" /> From Bucket List
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            aria-label="Add stop"
            disabled={waypoints.length >= 5}
            onClick={() => setShowAddStop(!showAddStop)}
            className="h-7 text-xs rounded-full gap-1 px-2.5 font-semibold"
          >
            <Plus className="size-3" /> Add Stop
          </Button>
        </div>
      </div>

      <p className="text-xs text-muted-foreground mb-2">
        Drag the handle to reorder, or use the arrow buttons.
      </p>
      <p className="sr-only" aria-live="polite">
        {announcement}
      </p>
      {/* List of stops */}
      {waypoints.length > 0 ? (
        <div className="space-y-1.5 mt-2">
          {waypoints.map((wp, idx) => (
            <div
              key={`${wp.id}-${idx}`}
              data-stop-index={idx}
              className={`flex items-center justify-between gap-2 p-2 rounded-2xl border text-xs ${dragging === idx ? "bg-primary/10 border-primary ring-1 ring-primary" : "bg-secondary/40 border-border/40"}`}
            >
              <div className="flex items-center gap-2 min-w-0">
                <button
                  type="button"
                  className="touch-none cursor-grab active:cursor-grabbing p-2 rounded-lg hover:bg-secondary shrink-0"
                  aria-label={`Drag stop ${idx + 1}: ${wp.name}. Arrow buttons also reorder stops.`}
                  onPointerDown={(event) => {
                    dragIndex.current = idx;
                    setDragging(idx);
                    event.currentTarget.setPointerCapture(event.pointerId);
                  }}
                  onPointerUp={(event) => {
                    const target = document
                      .elementFromPoint(event.clientX, event.clientY)
                      ?.closest<HTMLElement>("[data-stop-index]");
                    const to = target
                      ? Number(target.dataset["stopIndex"])
                      : -1;
                    if (
                      dragIndex.current !== null &&
                      to >= 0 &&
                      to !== dragIndex.current
                    ) {
                      onReorderStop(dragIndex.current, to);
                      setAnnouncement(`${wp.name} moved to stop ${to + 1}.`);
                    }
                    dragIndex.current = null;
                    setDragging(null);
                  }}
                  onPointerCancel={() => {
                    dragIndex.current = null;
                    setDragging(null);
                  }}
                >
                  <GripVertical className="size-4 text-muted-foreground" />
                </button>
                <span className="size-5 rounded-full bg-sky-500 text-white font-bold flex items-center justify-center text-[10px] shrink-0">
                  {idx + 1}
                </span>
                <span className="font-bold text-foreground truncate">
                  {wp.name}
                </span>
              </div>

              <div className="flex items-center gap-1 shrink-0">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={idx === 0}
                  aria-label={`Move ${wp.name} up`}
                  onClick={() => {
                    onMoveStopUp(idx);
                    setAnnouncement(`${wp.name} moved to stop ${idx}.`);
                  }}
                  className="h-9 w-9 p-0 rounded-lg text-muted-foreground hover:text-foreground"
                >
                  <ArrowUp className="size-3" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={idx === waypoints.length - 1}
                  aria-label={`Move ${wp.name} down`}
                  onClick={() => {
                    onMoveStopDown(idx);
                    setAnnouncement(`${wp.name} moved to stop ${idx + 2}.`);
                  }}
                  className="h-9 w-9 p-0 rounded-lg text-muted-foreground hover:text-foreground"
                >
                  <ArrowDown className="size-3" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  aria-label={`Remove stop ${wp.name}`}
                  onClick={() => onRemoveStop(idx)}
                  className="h-9 w-9 p-0 rounded-lg text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="size-3" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {showAddStop && (
        <div className="mt-3 pt-3 border-t border-border/40">
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (stopQuery.trim().length >= 2) {
                onSearchStop(stopQuery.trim());
              }
            }}
          >
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
              <Input
                value={stopQuery}
                placeholder="Search waypoint in Goa…"
                onChange={(e) => setStopQuery(e.target.value)}
                className="h-8 pl-8 pr-2 rounded-full text-xs bg-background/80"
              />
            </div>
            <Button
              type="submit"
              size="sm"
              className="h-8 rounded-full px-3 text-xs"
              disabled={isSearchingStop}
            >
              {isSearchingStop ? (
                <Loader2 className="size-3 animate-spin" />
              ) : (
                "Search"
              )}
            </Button>
          </form>

          {stopHits.length > 0 && (
            <div className="mt-2 rounded-2xl border border-border/50 bg-card overflow-hidden shadow-md max-h-48 overflow-y-auto">
              {stopHits.map((h) => (
                <button
                  key={h.id}
                  type="button"
                  onClick={() => onSelectStop(h)}
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
