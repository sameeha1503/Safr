import { Link } from "@tanstack/react-router";
import {
  CalendarClock,
  ChevronDown,
  History,
  Loader2,
  MapPinned,
  RotateCcw,
  Trash2,
} from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import type { Itinerary } from "@/lib/goa-schemas";
import { itineraryMapHandoff } from "@/lib/itinerary-map";

export type SavedItinerary = {
  id: string;
  created_at: string;
  place: string;
  hours: number;
  pace: string;
  interests: string[];
  itinerary: Itinerary;
};

type Props = {
  plans: SavedItinerary[];
  loading: boolean;
  error: boolean;
  deletingId: string | undefined;
  onRetry: () => void;
  onResume: (plan: SavedItinerary) => void;
  onReuseSettings: (plan: SavedItinerary) => void;
  onDelete: (id: string) => void;
};

export function SavedItineraries({
  plans,
  loading,
  error,
  deletingId,
  onRetry,
  onResume,
  onReuseSettings,
  onDelete,
}: Props) {
  const [confirmingId, setConfirmingId] = useState<string>();
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (error) setExpanded(true);
  }, [error]);

  return (
    <section
      aria-labelledby="saved-itineraries-title"
      className="print:hidden mb-6 overflow-hidden rounded-3xl border border-border/60 bg-card/75 shadow-sm backdrop-blur-2xl"
    >
      <button
        type="button"
        aria-expanded={expanded}
        aria-controls="saved-itineraries-list"
        onClick={() => setExpanded((current) => !current)}
        className="flex w-full items-center justify-between gap-4 p-5 text-left transition-colors hover:bg-secondary/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-inset sm:px-6"
      >
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-primary">
            <History className="size-3.5" /> Saved plans
          </p>
          <div className="mt-1 flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
            <h2 id="saved-itineraries-title" className="text-lg font-bold">
              Continue a previous day
            </h2>
            <span className="text-xs font-medium text-muted-foreground">
              {loading
                ? "Loading…"
                : `${plans.length} saved ${plans.length === 1 ? "plan" : "plans"}`}
            </span>
          </div>
        </div>
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-secondary text-muted-foreground">
          {loading ? (
            <Loader2 className="size-4 animate-spin text-primary" />
          ) : (
            <ChevronDown
              className={`size-4 transition-transform duration-200 ${expanded ? "rotate-180" : ""}`}
            />
          )}
        </span>
      </button>

      {expanded && (
        <div
          id="saved-itineraries-list"
          className="border-t border-border/50 px-5 pb-5 sm:px-6 sm:pb-6"
        >
          {error && (
            <div role="alert" className="mt-4 rounded-2xl bg-destructive/5 p-3">
              <p className="text-sm">Saved plans could not be loaded.</p>
              <Button
                variant="outline"
                size="sm"
                className="mt-2"
                onClick={onRetry}
              >
                Retry
              </Button>
            </div>
          )}

          {!loading && !error && plans.length === 0 && (
            <p className="mt-4 text-sm text-muted-foreground">
              Plans you generate will appear here so you can reopen them later.
            </p>
          )}

          {plans.length > 0 && (
            <div className="mt-4 grid gap-3 lg:grid-cols-2">
              {plans.map((plan) => {
                const handoff = itineraryMapHandoff(plan.itinerary, plan.place);
                const omitted = handoff
                  ? handoff.mappedStopCount - handoff.includedStopCount
                  : 0;
                const unmapped = handoff
                  ? plan.itinerary.stops.length - handoff.mappedStopCount
                  : plan.itinerary.stops.length;
                const isDeleting = deletingId === plan.id;
                const isConfirming = confirmingId === plan.id;
                return (
                  <article
                    key={plan.id}
                    className="rounded-2xl border border-border/60 bg-secondary/25 p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className="truncate font-bold">
                          {plan.itinerary.title}
                        </h3>
                        <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                          <CalendarClock className="size-3.5 shrink-0" />
                          {new Date(plan.created_at).toLocaleString("en-IN", {
                            dateStyle: "medium",
                            timeStyle: "short",
                          })}
                          <span aria-hidden="true">·</span>
                          {plan.hours}h, {plan.pace}
                        </p>
                      </div>
                      <span className="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">
                        {plan.itinerary.stops.length} stops
                      </span>
                    </div>

                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button size="sm" onClick={() => onResume(plan)}>
                        Resume plan
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => onReuseSettings(plan)}
                      >
                        <RotateCcw className="size-3.5" /> Reuse settings
                      </Button>
                      {handoff && (
                        <Button asChild size="sm" variant="outline">
                          <Link to="/map" search={handoff.search}>
                            <MapPinned className="size-3.5" />
                            {omitted > 0
                              ? `Map ${handoff.includedStopCount} of ${handoff.mappedStopCount}`
                              : "Edit route on map"}
                          </Link>
                        </Button>
                      )}
                      {isConfirming ? (
                        <>
                          <Button
                            size="sm"
                            variant="destructive"
                            disabled={isDeleting}
                            onClick={() => onDelete(plan.id)}
                          >
                            {isDeleting ? (
                              <Loader2 className="size-3.5 animate-spin" />
                            ) : (
                              <Trash2 className="size-3.5" />
                            )}
                            Delete permanently
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            disabled={isDeleting}
                            onClick={() => setConfirmingId(undefined)}
                          >
                            Cancel
                          </Button>
                        </>
                      ) : (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-muted-foreground hover:text-destructive"
                          onClick={() => setConfirmingId(plan.id)}
                        >
                          <Trash2 className="size-3.5" /> Delete
                        </Button>
                      )}
                    </div>
                    {(omitted > 0 || unmapped > 0) && (
                      <p className="mt-2 text-[11px] text-muted-foreground">
                        {omitted > 0 && (
                          <>
                            The route planner supports five intermediate stops,
                            so {omitted} mapped{" "}
                            {omitted === 1 ? "stop" : "stops"} will remain only
                            in this saved itinerary.{" "}
                          </>
                        )}
                        {unmapped > 0 && (
                          <>
                            {unmapped}{" "}
                            {unmapped === 1 ? "stop has" : "stops have"} no
                            verified coordinates and cannot be transferred.
                          </>
                        )}
                      </p>
                    )}
                  </article>
                );
              })}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
