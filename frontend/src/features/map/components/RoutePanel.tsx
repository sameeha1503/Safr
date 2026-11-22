import {
  Bike,
  Bookmark,
  Car,
  Clock,
  ExternalLink,
  Footprints,
  Heart,
  Loader2,
  Milestone,
  Moon,
  Share2,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatDistance } from "../lib/format";
import type { RouteStep, ScoredRoute } from "@/lib/maps.server";
import type { TravelMode } from "../lib/types";
import type { ComparisonCard } from "../hooks/useRoutePlanner";
import { RouteManeuversList } from "./RouteManeuversList";
import { RouteEvidence } from "./RouteEvidence";

export interface RoutePanelProps {
  travelMode: TravelMode;
  setTravelMode: (mode: TravelMode) => void;
  routingConfig:
    { provider?: string; supportedModes?: readonly string[] } | undefined;
  departureMode: "now" | "custom";
  setDepartureMode: (mode: "now" | "custom") => void;
  customTime: string;
  setCustomTime: (time: string) => void;
  isNightTime: boolean;
  showSavedPlaces: boolean;
  setShowSavedPlaces: (show: boolean | ((prev: boolean) => boolean)) => void;
  showSavedRoutes: boolean;
  setShowSavedRoutes: (show: boolean | ((prev: boolean) => boolean)) => void;
  savedRoutesCount: number;
  isCalculatingRoute: boolean;
  routes: ScoredRoute[];
  selected: number;
  setSelected: (idx: number) => void;
  currentRoute: ScoredRoute | undefined;
  comparisonCards: ComparisonCard[];
  activeStepIndex: number | null;
  setActiveStepIndex: (idx: number | null) => void;
  showDirections: boolean;
  setShowDirections: (show: boolean | ((prev: boolean) => boolean)) => void;
  onStepClick: (step: RouteStep, idx: number) => void;
  onShareRoute: () => void;
  onSaveRoute: () => void;
}

export function RoutePanel({
  travelMode,
  setTravelMode,
  routingConfig,
  departureMode,
  setDepartureMode,
  customTime,
  setCustomTime,
  isNightTime,
  showSavedPlaces,
  setShowSavedPlaces,
  showSavedRoutes,
  setShowSavedRoutes,
  savedRoutesCount,
  isCalculatingRoute,
  routes,
  selected,
  setSelected,
  currentRoute,
  comparisonCards,
  activeStepIndex,
  setActiveStepIndex,
  showDirections,
  setShowDirections,
  onStepClick,
  onShareRoute,
  onSaveRoute,
}: RoutePanelProps) {
  return (
    <>
      {/* Departure Time & Travel Mode Selector */}
      <div className="rounded-3xl border border-border/60 bg-card/85 backdrop-blur-xl p-4 shadow-xs space-y-3">
        {/* Travel Mode */}
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground block mb-2">
            Travel Mode
          </span>
          <div className="flex gap-1.5">
            {[
              { id: "car", label: "Car", icon: Car },
              { id: "motor_scooter", label: "Scooter", icon: Bike },
              { id: "bicycle", label: "Bicycle", icon: Zap },
              { id: "walking", label: "Walking", icon: Footprints },
            ]
              .filter((mode) =>
                (routingConfig?.supportedModes || ["car"]).includes(mode.id),
              )
              .map((modeItem) => {
                const isSupported = routingConfig?.supportedModes
                  ? (
                      routingConfig.supportedModes as readonly string[]
                    ).includes(modeItem.id)
                  : modeItem.id === "car";
                const isSelected = travelMode === modeItem.id;
                const Icon = modeItem.icon;

                return (
                  <button
                    key={modeItem.id}
                    type="button"
                    disabled={!isSupported}
                    title={
                      !isSupported
                        ? "Requires Valhalla routing provider"
                        : modeItem.label
                    }
                    aria-pressed={isSelected}
                    aria-label={`Travel mode: ${modeItem.label}`}
                    onClick={() => {
                      const newM = modeItem.id as TravelMode;
                      setTravelMode(newM);
                    }}
                    className={`flex flex-1 flex-col items-center justify-center p-2 rounded-2xl border text-xs font-semibold transition-all ${
                      isSelected
                        ? "bg-primary/15 border-primary text-primary shadow-xs"
                        : "bg-secondary/40 border-border/50 text-foreground hover:bg-secondary/70"
                    }`}
                  >
                    <Icon className="size-4 mb-1" />
                    <span className="text-[10px]">{modeItem.label}</span>
                  </button>
                );
              })}
          </div>
        </div>

        {/* Departure Time */}
        <div className="pt-2 border-t border-border/40">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
              <Clock className="size-3" /> Departure Time
            </span>
            <div className="flex items-center gap-1 bg-secondary/60 p-0.5 rounded-full border border-border/40">
              <button
                type="button"
                onClick={() => {
                  setDepartureMode("now");
                }}
                className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold transition-colors ${
                  departureMode === "now"
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground"
                }`}
              >
                Leave Now
              </button>
              <button
                type="button"
                onClick={() => {
                  setDepartureMode("custom");
                }}
                className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold transition-colors ${
                  departureMode === "custom"
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground"
                }`}
              >
                Leave At
              </button>
            </div>
          </div>

          {departureMode === "custom" && (
            <div className="flex items-center gap-2 mb-2">
              <Input
                type="time"
                value={customTime}
                onChange={(e) => {
                  setCustomTime(e.target.value);
                }}
                className="h-8 rounded-xl text-xs bg-background/80"
              />
              <span className="text-[11px] text-muted-foreground">
                Local IST
              </span>
            </div>
          )}

          {isNightTime && (
            <div className="flex items-center gap-1.5 rounded-xl bg-amber-500/10 border border-amber-500/30 px-2.5 py-1 text-[11px] font-semibold text-amber-600 dark:text-amber-400">
              <Moon className="size-3.5 shrink-0" />
              <span>Night driving: lighting data matters more</span>
            </div>
          )}
        </div>
      </div>

      {/* Quick Actions (Saved Routes & Saved Places Marker Toggle) */}
      <div className="flex items-center justify-between gap-2 px-1">
        <button
          type="button"
          onClick={() => setShowSavedPlaces((prev) => !prev)}
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground font-semibold"
        >
          <Heart
            className={`size-3.5 ${showSavedPlaces ? "text-coral fill-coral/30" : ""}`}
          />
          <span>
            {showSavedPlaces
              ? "Hide saved places on map"
              : "Show saved places on map"}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setShowSavedRoutes(!showSavedRoutes)}
          className="inline-flex items-center gap-1 text-xs text-primary font-semibold hover:underline"
        >
          <Bookmark className="size-3.5" />
          <span>My Routes ({savedRoutesCount})</span>
        </button>
      </div>

      {/* ROUTE COMPARISON CARDS & DIRECTIONS (Left column on desktop) */}
      {isCalculatingRoute && (
        <div className="flex items-center justify-center gap-3 rounded-3xl border border-primary/20 bg-primary/5 p-4 animate-pulse">
          <Loader2 className="size-5 animate-spin text-primary" />
          <span className="text-xs font-bold text-primary">
            Comparing routes…
          </span>
        </div>
      )}

      {routes.length > 0 && currentRoute && (
        <div className="space-y-4">
          <RouteEvidence route={currentRoute} />
          <p className="text-xs text-muted-foreground px-1">
            {travelMode === "walking"
              ? "Walking"
              : travelMode === "bicycle"
                ? "Cycling"
                : "Driving"}{" "}
            estimate · no live traffic. Compare routes below.
          </p>
          {/* Comparison Cards */}
          <div className="grid gap-2">
            {routes.map((r, index) => {
              const choice = comparisonCards.find(
                (card) => card.index === index,
              ) || {
                title: `Route ${index + 1}`,
                index,
                detail: "Alternative route",
                alsoSafest: false,
              };
              const isCur = r && choice.index === selected;
              return (
                <button
                  key={choice.index}
                  aria-pressed={Boolean(isCur)}
                  type="button"
                  disabled={!r}
                  onClick={() => {
                    if (r) {
                      setSelected(choice.index);
                      setActiveStepIndex(null);
                    }
                  }}
                  className={`rounded-2xl border p-3.5 text-left transition-all ${
                    isCur
                      ? "border-primary bg-primary/10 ring-1 ring-primary/40 shadow-xs"
                      : "border-border/60 bg-card hover:border-primary/40"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold text-xs text-foreground">
                      {choice.title}
                    </span>
                    {choice.alsoSafest && (
                      <span className="rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 px-2 py-0.5 text-[9px] font-bold">
                        Road preference
                      </span>
                    )}
                  </div>
                  <span className="block mt-1 font-bold text-sm text-foreground">
                    {r
                      ? `${r.durationMin} min · ${r.distanceKm} km`
                      : "Unavailable"}
                  </span>
                  <span className="block mt-0.5 text-[11px] text-muted-foreground">
                    {choice.detail}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Active Route Details Card */}
          <div className="rounded-3xl border border-border/60 bg-card/90 backdrop-blur-xl p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between gap-2 border-b border-border/40 pb-3">
              <div>
                <h3 className="text-base font-bold text-foreground flex items-center gap-1.5">
                  <Milestone className="size-4 text-primary" />{" "}
                  {currentRoute.summary}
                </h3>
                <p className="text-xs text-muted-foreground">
                  <strong>{currentRoute.distanceKm} km</strong> · ~
                  <strong>{currentRoute.durationMin} mins</strong>
                </p>
              </div>

              {/* Actions: Share, Save, Google Maps */}
              <div className="flex items-center gap-1">
                <Button
                  size="sm"
                  variant="outline"
                  aria-label="Share route link"
                  onClick={onShareRoute}
                  className="h-8 w-8 p-0 rounded-full"
                >
                  <Share2 className="size-3.5" />
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  aria-label="Save route"
                  onClick={onSaveRoute}
                  className="h-8 w-8 p-0 rounded-full"
                >
                  <Bookmark className="size-3.5 text-primary" />
                </Button>
              </div>
            </div>

            {currentRoute.googleMapsUrl && (
              <a
                href={currentRoute.googleMapsUrl}
                target="_blank"
                rel="noreferrer"
                className="flex items-center justify-center gap-2 rounded-2xl bg-primary text-primary-foreground py-3 text-sm font-bold"
              >
                <ExternalLink className="size-4" />
                Start navigation · Google Maps
              </a>
            )}
            <p className="text-xs text-muted-foreground">
              Road information comes from mapped data and may be incomplete. It
              does not guarantee safety.
            </p>
            {/* Per-leg summary if multi-stop */}
            {currentRoute.legs && currentRoute.legs.length > 1 && (
              <div className="space-y-1.5 pt-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  Legs Breakdown
                </span>
                {currentRoute.legs.map((leg) => (
                  <div
                    key={leg.legIndex}
                    className="flex items-center justify-between p-2 rounded-xl bg-secondary/30 text-xs border border-border/30"
                  >
                    <span className="font-semibold text-foreground truncate max-w-[200px]">
                      {leg.fromName} → {leg.toName}
                    </span>
                    <span className="font-mono text-muted-foreground shrink-0">
                      {formatDistance(leg.distanceMeters)} · ~
                      {Math.ceil(leg.durationSeconds / 60)}m
                    </span>
                  </div>
                ))}
              </div>
            )}

            {/* Safety Reasons */}
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block mb-1">
                Mapped road information
              </span>
              <ul className="space-y-1 text-xs text-foreground/90">
                {currentRoute.reasons.map((reason, idx) => (
                  <li
                    key={idx}
                    className="flex items-start gap-1.5 leading-snug"
                  >
                    <span className="text-primary font-bold mt-0.5">•</span>
                    <span>{reason}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Turn-by-turn maneuvers */}
            <RouteManeuversList
              steps={currentRoute.steps}
              showDirections={showDirections}
              setShowDirections={setShowDirections}
              activeStepIndex={activeStepIndex}
              onStepClick={onStepClick}
            />
          </div>
        </div>
      )}
    </>
  );
}
