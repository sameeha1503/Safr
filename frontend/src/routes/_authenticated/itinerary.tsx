import { itineraryDate } from "@/lib/itinerary-dates";
import { ItinerarySummary } from "@/features/itinerary/components/ItinerarySummary";
import {
  SavedItineraries,
  type SavedItinerary,
} from "@/features/itinerary/components/SavedItineraries";
import { resolvedCentre } from "@/lib/resolved-centre";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
  Calendar,
  CheckCircle2,
  Circle,
  Clock,
  ExternalLink,
  Loader2,
  MapPin,
  MapPinned,
  Navigation,
  Printer,
  Radio,
  Sparkles,
  Zap,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { GOA_PLACES, type Itinerary } from "@/lib/goa-schemas";
import { generateItinerary, getCurrentArea } from "@/lib/goa.functions";
import { supabase } from "@/integrations/supabase/client";
import { itineraryMapHandoff, parseSavedItinerary } from "@/lib/itinerary-map";

export const Route = createFileRoute("/_authenticated/itinerary")({
  validateSearch: (
    search: Record<string, unknown>,
  ): { place?: string; state?: string; lat?: number; lng?: number } => ({
    place: typeof search["place"] === "string" ? search["place"] : "",
    state: typeof search["state"] === "string" ? search["state"] : "Goa",
    ...resolvedCentre(search["lat"], search["lng"]),
  }),
  component: ItineraryPage,
});

const INTERESTS = [
  "History & heritage",
  "Local food",
  "Beaches & sunsets",
  "Nightlife",
  "Nature & wildlife",
  "Markets & shopping",
  "Churches & temples",
  "Water sports",
];

const typeEmoji: Record<string, string> = {
  food: "🍤",
  sight: "🏛️",
  activity: "🎯",
  beach: "🏖️",
  rest: "😌",
  travel: "🛵",
};

const getTodayDate = () => itineraryDate("today");
const getTomorrowDate = () => itineraryDate("tomorrow");
const getWeekendDate = () => itineraryDate("weekend");

function ItineraryPage() {
  const queryClient = useQueryClient();
  const searchParams = Route.useSearch();
  const [place, setPlace] = useState<string>(
    searchParams.place || "Anjuna Beach",
  );
  const [state, setState] = useState(searchParams.state || "Goa");
  const [origin, setOrigin] = useState<
    { lat: number; lng: number } | undefined
  >(() => resolvedCentre(searchParams.lat, searchParams.lng));
  useEffect(() => {
    if (searchParams.place) setPlace(searchParams.place);
    if (searchParams.state) setState(searchParams.state);
    setOrigin(resolvedCentre(searchParams.lat, searchParams.lng));
  }, [
    searchParams.place,
    searchParams.state,
    searchParams.lat,
    searchParams.lng,
  ]);
  const [returnToStart, setReturnToStart] = useState(false);
  const [locating, setLocating] = useState(false);
  const currentArea = useServerFn(getCurrentArea);
  const handleCurrentLocation = () => {
    if (!navigator.geolocation) {
      toast.error("Location is unavailable in this browser");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const result = await currentArea({
            data: {
              lat: position.coords.latitude,
              lng: position.coords.longitude,
            },
          });
          setPlace(result.name);
          setState(result.state);
          setOrigin({ lat: result.lat, lng: result.lng });
        } catch (error) {
          toast.error(
            error instanceof Error
              ? error.message
              : "Could not detect your area",
          );
        } finally {
          setLocating(false);
        }
      },
      () => {
        setLocating(false);
        toast.error(
          "Location permission unavailable. Enter a destination and state instead.",
        );
      },
      { enableHighAccuracy: true, maximumAge: 0, timeout: 10000 },
    );
  };
  const handleTripDestination = async () => {
    const { data, error } = await supabase
      .from("trips")
      .select("destination")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error || !data) {
      toast.error("Save a trip destination in Trip setup first.");
      return;
    }
    setPlace(data.destination);
    setState("Goa");
    setOrigin(undefined);
  };
  const [date, setDate] = useState<string>(getTodayDate());
  const [hours, setHours] = useState(6);
  const [startTime, setStartTime] = useState("09:00");
  const [pace, setPace] = useState<"relaxed" | "balanced" | "packed">(
    "balanced",
  );
  const [interests, setInterests] = useState<string[]>([
    "Local food",
    "Beaches & sunsets",
  ]);
  const [notes, setNotes] = useState("");

  const [visitedStops, setVisitedStops] = useState<Record<number, boolean>>({});

  const [result, setResult] = useState<Itinerary>();
  const [editing, setEditing] = useState(true);
  const [saveStatus, setSaveStatus] = useState<"saved" | "failed" | "none">(
    "none",
  );
  const resultRef = useRef<HTMLElement>(null);
  useEffect(() => {
    if (!result) return;
    resultRef.current?.focus({ preventScroll: true });
    resultRef.current?.scrollIntoView({ block: "start" });
  }, [result]);
  const generate = useServerFn(generateItinerary);

  const savedPlans = useQuery({
    queryKey: ["saved-itineraries"],
    queryFn: async (): Promise<SavedItinerary[]> => {
      const { data: userData, error: authError } =
        await supabase.auth.getUser();
      if (authError || !userData.user)
        throw new Error("Sign in to view plans.");
      const { data, error } = await supabase
        .from("itineraries")
        .select("id, created_at, place, hours, pace, interests, plan")
        .eq("user_id", userData.user.id)
        .order("created_at", { ascending: false })
        .limit(12);
      if (error) throw error;
      return (data ?? []).flatMap((row) => {
        const itinerary = parseSavedItinerary(row.plan);
        return itinerary ? [{ ...row, itinerary }] : [];
      });
    },
    staleTime: 60_000,
  });

  const deletePlan = useMutation({
    mutationFn: async (id: string) => {
      const { data: userData, error: authError } =
        await supabase.auth.getUser();
      if (authError || !userData.user)
        throw new Error("Sign in to delete plans.");
      const { error } = await supabase
        .from("itineraries")
        .delete()
        .eq("id", id)
        .eq("user_id", userData.user.id);
      if (error) throw error;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["saved-itineraries"] });
      toast.success("Saved itinerary deleted.");
    },
    onError: (error) =>
      toast.error(
        error instanceof Error ? error.message : "Could not delete itinerary",
      ),
  });

  const plan = useMutation({
    mutationFn: async () => {
      const result = (await generate({
        data: {
          place,
          state,
          date,
          hours,
          interests,
          pace,
          startTime,
          notes: notes.trim() || undefined,
          origin,
          returnToStart,
        },
      })) as Itinerary;
      // A storage outage must not discard a successfully generated day.
      try {
        const { data: userData, error: authError } =
          await supabase.auth.getUser();
        if (authError || !userData.user)
          throw new Error("Sign in to save your itinerary.");
        const { error } = await supabase.from("itineraries").insert({
          user_id: userData.user.id,
          place,
          hours,
          pace,
          interests,
          plan: result as unknown as never,
        });
        if (error) throw error;
        setSaveStatus("saved");
        await queryClient.invalidateQueries({
          queryKey: ["saved-itineraries"],
        });
      } catch {
        setSaveStatus("failed");
        toast.warning(
          "Your plan is ready, but could not be saved. Print it to keep a copy.",
        );
      }
      return result;
    },
    onSuccess: (itinerary) => {
      setResult(itinerary);
      setVisitedStops({});
      setEditing(false);
    },
    onError: (e) =>
      toast.error(e instanceof Error ? e.message : "Could not build itinerary"),
  });

  const handlePrint = () => {
    window.print();
  };

  const toggleVisited = (index: number) => {
    setVisitedStops((prev) => ({ ...prev, [index]: !prev[index] }));
  };

  const applySavedSettings = (saved: SavedItinerary) => {
    setPlace(saved.place);
    setHours(saved.hours);
    if (["relaxed", "balanced", "packed"].includes(saved.pace)) {
      setPace(saved.pace as "relaxed" | "balanced" | "packed");
    }
    setInterests(saved.interests);
    setOrigin(saved.itinerary.origin);
    setReturnToStart((saved.itinerary.returnMinutes ?? 0) > 0);
    if (saved.itinerary.date && saved.itinerary.date >= getTodayDate()) {
      setDate(saved.itinerary.date);
    }
  };

  const resumeSavedPlan = (saved: SavedItinerary) => {
    applySavedSettings(saved);
    setResult(saved.itinerary);
    setVisitedStops({});
    setSaveStatus("saved");
    setEditing(false);
  };

  const reuseSavedSettings = (saved: SavedItinerary) => {
    applySavedSettings(saved);
    setEditing(true);
    requestAnimationFrame(() =>
      document.getElementById("itinerary-preferences")?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      }),
    );
  };

  const currentMapHandoff = result ? itineraryMapHandoff(result, place) : null;

  return (
    <AppShell
      title="AI Itinerary Planner"
      subtitle="Map-based schedules for your destination and current location"
      back
    >
      {result && (
        <div className="mb-4 flex items-center justify-between gap-3 print:hidden">
          <p className="text-sm text-muted-foreground">
            Your day is ready. Adjust your preferences to make a new plan.
          </p>
          <Button
            variant="outline"
            aria-expanded={editing}
            aria-controls="itinerary-preferences"
            onClick={() => setEditing(!editing)}
          >
            {editing ? "Hide preferences" : "Edit preferences"}
          </Button>
        </div>
      )}
      <SavedItineraries
        plans={savedPlans.data ?? []}
        loading={savedPlans.isLoading}
        error={savedPlans.isError}
        deletingId={deletePlan.isPending ? deletePlan.variables : undefined}
        onRetry={() => void savedPlans.refetch()}
        onResume={resumeSavedPlan}
        onReuseSettings={reuseSavedSettings}
        onDelete={(id) => deletePlan.mutate(id)}
      />
      {/* Configuration Form Card */}
      <form
        id="itinerary-preferences"
        hidden={!editing}
        className="print:hidden space-y-5 rounded-3xl border border-border/60 bg-card/75 backdrop-blur-2xl p-6 sm:p-8 shadow-sm"
        onSubmit={(e) => {
          e.preventDefault();
          if (interests.length === 0) {
            toast.error("Please select at least one travel interest");
            return;
          }
          if (!plan.isPending) plan.mutate();
        }}
      >
        <fieldset disabled={plan.isPending} className="space-y-5 min-w-0">
          <div className="flex items-center justify-between border-b border-border/40 pb-4">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-primary">
                Time-Budget Planner
              </span>
              <h3 className="text-xl font-bold font-display text-foreground">
                Plan Your Day
              </h3>
            </div>
            <Sparkles className="size-6 text-primary" />
          </div>

          {/* Location Dropdown */}
          <div className="space-y-1.5">
            <Label
              htmlFor="place"
              className="font-semibold text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-1.5"
            >
              <MapPin className="size-3.5 text-primary" /> Destination or
              Starting Area
            </Label>
            <Input
              id="place"
              list="goa-destinations"
              required
              maxLength={120}
              value={place}
              onChange={(e) => {
                setPlace(e.target.value);
                setOrigin(undefined);
              }}
            />
            <datalist id="goa-destinations">
              {GOA_PLACES.map((p) => (
                <option key={p} value={p} />
              ))}
            </datalist>
            <Label htmlFor="state">State in India</Label>
            <Input
              id="state"
              required
              maxLength={80}
              value={state}
              onChange={(e) => {
                setState(e.target.value);
                setOrigin(undefined);
              }}
            />
            <div className="flex flex-wrap gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                disabled={locating}
                onClick={handleCurrentLocation}
              >
                {locating
                  ? "Finding your area…"
                  : "Use my current location & state"}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => void handleTripDestination()}
              >
                Use saved trip destination
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              {origin
                ? "The initial drive starts at the selected coordinates."
                : "The initial drive starts at the mapped destination center."}{" "}
              Times use the India time zone and driving routes.
            </p>
            <label className="flex gap-2 text-sm pt-2">
              <input
                type="checkbox"
                checked={returnToStart}
                onChange={(e) => setReturnToStart(e.target.checked)}
              />{" "}
              Include the drive back to my starting point
            </label>
          </div>

          {/* Date of Visit & Quick Date Pills */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label
                htmlFor="date"
                className="font-semibold text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-1.5"
              >
                <Calendar className="size-3.5 text-primary" /> Date of
                Exploration
              </Label>
              <div className="flex gap-1.5">
                {[
                  { label: "Today", fn: getTodayDate },
                  { label: "Tomorrow", fn: getTomorrowDate },
                  { label: "Weekend", fn: getWeekendDate },
                ].map((pill) => {
                  const isSelected = date === pill.fn();
                  return (
                    <button
                      key={pill.label}
                      type="button"
                      onClick={() => setDate(pill.fn())}
                      className={`rounded-full px-2.5 py-0.5 text-xs font-semibold transition-all ${
                        isSelected
                          ? "bg-primary text-primary-foreground shadow-xs"
                          : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
                      }`}
                    >
                      {pill.label}
                    </button>
                  );
                })}
              </div>
            </div>
            <Input
              id="date"
              type="date"
              required
              value={date}
              min={getTodayDate()}
              onChange={(e) => setDate(e.target.value)}
              className="w-full h-11 rounded-2xl bg-secondary/40 border-border/60"
            />
          </div>

          {/* Start Time and Available Duration */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label
                htmlFor="start"
                className="font-semibold text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-1.5"
              >
                <Clock className="size-3.5 text-primary" /> Start Time
              </Label>
              <Input
                id="start"
                type="time"
                required
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="h-11 rounded-2xl bg-secondary/40 border-border/60 font-semibold"
              />
            </div>

            <div className="space-y-1.5">
              <Label
                htmlFor="hours"
                className="font-semibold text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-1.5"
              >
                <Zap className="size-3.5 text-amber" /> Free Hours ({hours}h)
              </Label>
              <Input
                id="hours"
                type="number"
                min={1}
                max={24}
                value={hours}
                onChange={(e) =>
                  setHours(
                    Math.max(1, Math.min(24, Number(e.target.value) || 1)),
                  )
                }
                className="h-11 rounded-2xl bg-secondary/40 border-border/60 font-bold"
              />
            </div>
          </div>

          {/* Pacing Speed Controls */}
          <div className="space-y-2">
            <Label className="font-semibold text-xs uppercase tracking-wider text-muted-foreground">
              Exploration Pace
            </Label>
            <div className="grid grid-cols-3 gap-2.5">
              {(["relaxed", "balanced", "packed"] as const).map((p) => {
                const isSelected = pace === p;
                return (
                  <button
                    key={p}
                    type="button"
                    aria-pressed={isSelected}
                    onClick={() => setPace(p)}
                    className={`rounded-2xl py-2.5 text-xs font-bold capitalize transition-all ${
                      isSelected
                        ? "bg-primary text-primary-foreground shadow-md shadow-primary/20 scale-[1.02]"
                        : "bg-secondary/70 text-secondary-foreground hover:bg-secondary"
                    }`}
                  >
                    {p}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Interest Tags Selector */}
          <div className="space-y-2">
            <Label className="font-semibold text-xs uppercase tracking-wider text-muted-foreground">
              What do you enjoy?
            </Label>
            <div className="flex flex-wrap gap-2">
              {INTERESTS.map((i) => {
                const isSelected = interests.includes(i);
                return (
                  <button
                    key={i}
                    type="button"
                    aria-pressed={isSelected}
                    onClick={() =>
                      setInterests(
                        isSelected
                          ? interests.filter((x) => x !== i)
                          : [...interests, i],
                      )
                    }
                    className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition-all ${
                      isSelected
                        ? "bg-primary text-primary-foreground shadow-xs scale-105"
                        : "bg-secondary/70 text-secondary-foreground hover:bg-secondary"
                    }`}
                  >
                    {i}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Custom Notes / Constraints */}
          <div className="space-y-1.5">
            <Label
              htmlFor="notes"
              className="font-semibold text-xs uppercase tracking-wider text-muted-foreground"
            >
              Special Requests & Notes (optional)
            </Label>
            <Textarea
              id="notes"
              maxLength={400}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Travelling with a toddler, vegetarian only, prefer scooter-accessible spots…"
              className="rounded-2xl bg-secondary/40 border-border/60 text-xs sm:text-sm resize-none"
              rows={2}
            />
          </div>

          {/* Submit Button */}
          <Button
            type="submit"
            disabled={plan.isPending || locating}
            className="w-full h-12 rounded-full font-bold bg-primary text-primary-foreground shadow-md transition-all hover:scale-[1.01] active:scale-95"
          >
            {plan.isPending ? (
              <>
                <Loader2 className="size-4 animate-spin mr-2" /> Planning your
                day…
              </>
            ) : (
              <>
                <Sparkles className="size-4 mr-2" /> Generate AI Itinerary
              </>
            )}
          </Button>
        </fieldset>
      </form>

      {plan.isPending && (
        <p role="status" className="my-6 flex items-center gap-2 text-sm">
          <Loader2 className="size-4 animate-spin" /> Finding mapped places and
          checking road travel times against your time budget…
        </p>
      )}

      {plan.isError && (
        <div
          role="alert"
          className="my-5 rounded-2xl border border-destructive/30 bg-destructive/5 p-4"
        >
          <p className="text-sm">
            {plan.error instanceof Error
              ? plan.error.message
              : "Your itinerary could not be created. Please try again."}
          </p>
          {result && (
            <p className="text-xs mt-2">
              Your previous plan is still available below.
            </p>
          )}
          <Button
            variant="outline"
            className="mt-3"
            onClick={() => setEditing(true)}
          >
            Review preferences
          </Button>
        </div>
      )}
      {/* RESULTING ITINERARY TIMELINE */}
      {result && !plan.isPending && (
        <section
          ref={resultRef}
          tabIndex={-1}
          aria-label="Your planned day"
          className="itinerary-result scroll-mt-24 mt-8 rounded-3xl border border-border/60 bg-card/80 backdrop-blur-2xl p-6 sm:p-8 shadow-sm animate-in fade-in slide-in-from-bottom-6 duration-500"
        >
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/40 pb-5">
            <div>
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-primary/10 text-primary px-3 py-0.5 text-[10px] font-bold uppercase tracking-wider">
                  Time-Budgeted Schedule
                </span>
                <span className="rounded-full bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 px-2.5 py-0.5 text-[10px] font-bold">
                  {result.aiStatus === "used"
                    ? "AI-assisted plan"
                    : "Map-based plan"}
                </span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-bold font-display text-foreground mt-1.5">
                {result.title}
              </h2>
              {result.date && (
                <p className="text-xs font-semibold text-muted-foreground mt-1 flex items-center gap-1.5">
                  <Calendar className="size-3.5 text-primary" />
                  {new Date(result.date).toLocaleDateString("en-US", {
                    timeZone: "Asia/Kolkata",
                    weekday: "long",
                    month: "long",
                    day: "numeric",
                  })}
                </p>
              )}
            </div>

            <div className="flex flex-wrap gap-2 self-start sm:justify-end">
              {currentMapHandoff && (
                <Button
                  asChild
                  variant="outline"
                  size="sm"
                  className="rounded-full font-bold text-xs gap-1.5 shadow-sm hover:border-primary/40"
                >
                  <Link to="/map" search={currentMapHandoff.search}>
                    <MapPinned className="size-3.5" />
                    {currentMapHandoff.includedStopCount <
                    currentMapHandoff.mappedStopCount
                      ? `Map ${currentMapHandoff.includedStopCount} of ${currentMapHandoff.mappedStopCount}`
                      : "Edit route on map"}
                  </Link>
                </Button>
              )}
              <Button
                onClick={handlePrint}
                variant="outline"
                size="sm"
                className="rounded-full font-bold text-xs gap-1.5 shadow-sm hover:border-primary/40"
              >
                <Printer className="size-3.5" /> Print / Save PDF
              </Button>
            </div>
          </div>

          <ItinerarySummary
            itinerary={result}
            visited={Object.values(visitedStops).filter(Boolean).length}
          />
          {saveStatus !== "none" && (
            <p className="mt-3 text-xs text-muted-foreground" role="status">
              {saveStatus === "saved"
                ? "Saved to your account."
                : "Not saved to your account. Use Print / Save PDF to keep this plan."}
            </p>
          )}
          {currentMapHandoff &&
            (currentMapHandoff.includedStopCount <
              currentMapHandoff.mappedStopCount ||
              currentMapHandoff.mappedStopCount < result.stops.length) && (
              <p className="mt-2 text-xs text-muted-foreground">
                The map transfer includes {currentMapHandoff.includedStopCount}{" "}
                of {result.stops.length} stops. The map accepts five
                intermediate stops, and stops without verified coordinates stay
                in this itinerary.
              </p>
            )}
          {/* Live Coastal Telemetry Banner */}
          {(result.liveWeather || result.liveSwell) && (
            <div className="mt-4 flex flex-wrap items-center gap-2 sm:gap-3 rounded-2xl bg-secondary/50 border border-border/50 p-3 text-xs text-foreground">
              {result.liveWeather && (
                <span className="font-semibold flex items-center gap-1.5">
                  {result.liveWeather}
                </span>
              )}
              {result.liveWeather && result.liveSwell && (
                <span className="text-muted-foreground hidden sm:inline">
                  ·
                </span>
              )}
              {result.liveSwell && (
                <span className="font-semibold flex items-center gap-1.5">
                  {result.liveSwell}
                </span>
              )}
            </div>
          )}

          <p className="mt-4 text-sm text-foreground/90 leading-relaxed font-medium">
            {result.overview}
          </p>

          {/* Sequential Timeline Stops */}
          <ol className="mt-8 space-y-6 border-l-2 border-primary/30 pl-6 ml-2">
            {result.stops.map((stop, i) => {
              const isVisited = Boolean(visitedStops[i]);
              return (
                <li key={i} className="relative group">
                  {/* Numbered Step Bubble */}
                  <button
                    type="button"
                    onClick={() => toggleVisited(i)}
                    className={`absolute -left-[33px] top-0.5 flex size-6 items-center justify-center rounded-full text-xs font-bold shadow-sm transition-all ${
                      isVisited
                        ? "bg-emerald-500 text-white scale-110 ring-2 ring-emerald-300"
                        : "bg-primary text-primary-foreground group-hover:scale-110"
                    }`}
                    aria-pressed={isVisited}
                    aria-label={`${isVisited ? "Mark as not visited" : "Mark as visited"}: ${stop.title}`}
                    title={
                      isVisited ? "Mark as not visited" : "Mark as visited"
                    }
                  >
                    {isVisited ? "✓" : i + 1}
                  </button>

                  <div
                    className={`rounded-2xl border p-4 sm:p-5 transition-all ${
                      isVisited
                        ? "border-emerald-500/30 bg-emerald-500/5 opacity-80"
                        : "border-border/60 bg-secondary/30 hover:border-primary/40 hover:bg-secondary/50"
                    }`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full bg-primary/10 text-primary px-2.5 py-0.5 text-xs font-bold font-mono">
                          🕒 {stop.time}
                        </span>
                        <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-bold capitalize text-muted-foreground">
                          {stop.duration}
                        </span>
                        <span className="rounded-full bg-primary/10 text-primary px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider">
                          {typeEmoji[stop.type] ?? "📍"} {stop.type}
                        </span>

                        {/* Real-time Crowd Indicator */}
                        {stop.crowdLevel && (
                          <span
                            className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                              stop.crowdLevel === "low"
                                ? "bg-emerald-500/10 text-emerald-600 border border-emerald-500/20"
                                : stop.crowdLevel === "high"
                                  ? "bg-rose-500/10 text-rose-600 border border-rose-500/20"
                                  : "bg-amber-500/10 text-amber-700 border border-amber-500/20"
                            }`}
                          >
                            <span
                              className={`size-1.5 rounded-full ${
                                stop.crowdLevel === "low"
                                  ? "bg-emerald-500"
                                  : stop.crowdLevel === "high"
                                    ? "bg-rose-500 animate-pulse"
                                    : "bg-amber-500"
                              }`}
                            />
                            {stop.crowdLevel === "low"
                              ? "Low Crowds"
                              : stop.crowdLevel === "high"
                                ? "Peak Crowds"
                                : "Moderate Buzz"}
                          </span>
                        )}

                        {/* Transit Distance pill */}
                        {stop.distanceKm !== undefined &&
                          stop.distanceKm > 0 && (
                            <span className="rounded-full bg-secondary/80 px-2 py-0.5 text-[10px] font-bold text-muted-foreground">
                              📍 {stop.distanceKm} km · ~{stop.transitMin}m
                              travel + buffer
                            </span>
                          )}
                      </div>

                      {/* Direct Turn-by-Turn Safe Route & Google Maps Actions */}
                      <div className="flex items-center gap-1.5">
                        <Button
                          asChild
                          size="sm"
                          variant="ghost"
                          className="h-7 text-xs font-bold text-primary hover:bg-primary/10 rounded-full px-3 gap-1"
                        >
                          <Link
                            to="/map"
                            search={{
                              dest: stop.title,
                              ...(stop.lat != null && stop.lng != null
                                ? {
                                    lat: String(stop.lat),
                                    lng: String(stop.lng),
                                  }
                                : {}),
                            }}
                          >
                            <Navigation className="size-3 mr-0.5" /> Directions
                          </Link>
                        </Button>

                        {stop.lat != null && stop.lng != null && (
                          <a
                            href={`https://www.google.com/maps/dir/?api=1&destination=${stop.lat},${stop.lng}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center justify-center size-7 rounded-full border border-border/70 text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
                            title="Open Google Maps GPS Navigation"
                          >
                            <ExternalLink className="size-3" />
                          </a>
                        )}

                        <button
                          type="button"
                          onClick={() => toggleVisited(i)}
                          className={`text-[10px] font-bold px-2 py-1 rounded-lg border transition-colors ${
                            isVisited
                              ? "bg-emerald-500 text-white border-emerald-500"
                              : "text-muted-foreground border-border/60 hover:bg-secondary"
                          }`}
                        >
                          {isVisited ? "Visited ✓" : "Mark Visited"}
                        </button>
                      </div>
                    </div>

                    <h3 className="mt-2.5 text-base font-bold text-foreground flex items-center gap-2">
                      <span>{typeEmoji[stop.type] ?? "📍"}</span>
                      <span
                        className={
                          isVisited ? "line-through text-muted-foreground" : ""
                        }
                      >
                        {stop.title}
                      </span>
                    </h3>

                    <p className="mt-1 text-xs sm:text-sm text-muted-foreground leading-relaxed">
                      {stop.description}
                    </p>

                    <p className="mt-2.5 text-xs font-semibold text-primary bg-primary/5 px-2.5 py-1 rounded-lg w-fit flex items-center gap-1.5">
                      <span>🛵</span>
                      <span>{stop.travel_note}</span>
                    </p>
                  </div>
                </li>
              );
            })}
          </ol>

          {/* Travel Tips & Good to Know */}
          {result.tips.length > 0 && (
            <div className="mt-8 rounded-2xl bg-primary/5 border border-primary/20 p-5">
              <p className="text-xs font-bold uppercase tracking-wider text-primary flex items-center gap-1.5">
                <span>💡</span> Local Travel Insights & Pro-Tips
              </p>
              <ul className="mt-2.5 space-y-1.5 text-xs sm:text-sm text-foreground/90 leading-relaxed">
                {result.tips.map((t, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    <span className="text-primary font-bold">•</span>
                    <span>{t}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      )}
    </AppShell>
  );
}
