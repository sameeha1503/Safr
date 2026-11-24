import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowRight,
  ArrowUpRight,
  Compass,
  LocateFixed,
  MapPin,
  QrCode,
  Sun,
  Users,
} from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { SafeTagAlertBanner } from "@/components/safetag-alert-banner";
import { supabase } from "@/integrations/supabase/client";
import { CoastalArtwork } from "@/features/dashboard/components/CoastalArtwork";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: Dashboard,
});
const PLACES = [
  { name: "Palolem Beach", category: "For a coastal escape", number: "01" },
  { name: "Fort Aguada", category: "For a little history", number: "02" },
  {
    name: "Anjuna Flea Market",
    category: "For a different kind of find",
    number: "03",
  },
];
const SAFETY_CARDS = [
  {
    to: "/live-tracking",
    icon: LocateFixed,
    title: "Find your people",
    description: "Shared locations and meeting spots",
    label: "Open Reunite",
  },
  {
    to: "/safety-tags",
    icon: QrCode,
    title: "Keep them connected",
    description: "QR wristbands for your companions",
    label: "Get SafeTags",
  },
  {
    to: "/map",
    icon: MapPin,
    title: "Safe routes",
    description: "Directions scored for safety",
    label: "Plan a route",
  },
] as const;

function Dashboard() {
  const {
    data: trip,
    isPending,
    isError,
    refetch,
  } = useQuery({
    queryKey: ["trip"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("trips")
        .select("*, travellers(*)")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
  const travellers = trip?.travellers ?? [];
  return (
    <AppShell title="Your getaway" subtitle="Goa, at your own pace">
      <SafeTagAlertBanner />
      <div className="pb-16 sm:pb-24">
        {/* The Goa edition bar: kept at the very top of the screen */}
        <div className="flex items-center justify-between border-b border-border pb-4 text-[10px] font-semibold uppercase tracking-[0.2em] sm:text-xs">
          <span className="flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-primary" /> The Goa
            edition
          </span>
          <span className="text-muted-foreground">
            Explore / Wander / Belong
          </span>
        </div>

        <section className="py-7 sm:py-10" aria-labelledby="dashboard-heading">
          <p className="mb-3 text-sm text-muted-foreground">
            {trip?.traveller_name
              ? `Make it your kind of trip, ${trip.traveller_name}.`
              : "A change of scene starts here."}
          </p>
          <h2
            id="dashboard-heading"
            className="max-w-xl font-display text-[clamp(2.8rem,7vw,4.6rem)] leading-[1.04] tracking-[-0.045em]"
          >
            Go a little further.
            <br />
            <span className="italic text-primary">Stay a little longer.</span>
          </h2>
        </section>

        {/* Full-width Scenic Way Banner */}
        <Link
          to="/map"
          className="group relative isolate mb-8 flex min-h-[260px] w-full flex-col justify-between overflow-hidden rounded-2xl bg-[#123f3b] p-6 text-[#fff9eb] focus-visible:outline-4 focus-visible:outline-offset-4 focus-visible:outline-primary sm:min-h-[320px] sm:rounded-3xl sm:p-8 lg:h-[360px]"
        >
          <CoastalArtwork />
          <div className="relative flex items-center justify-between">
            <span className="text-xs uppercase tracking-[0.2em]">
              Take the scenic way
            </span>
            <Compass className="size-6 opacity-80" aria-hidden="true" />
          </div>
          <div className="relative max-w-md pt-6 sm:pt-10">
            <h3 className="font-display text-[2rem] leading-[1.05] sm:text-[2.5rem]">
              Less searching.
              <br />
              More exploring.
            </h3>
            <p className="mt-3 max-w-xs text-sm leading-relaxed text-[#e2ece5] sm:max-w-sm">
              Find a place, trace your route, and see where the day takes
              you.
            </p>
            <span className="mt-5 inline-flex min-h-11 items-center gap-4 border-b border-white/60 pb-1 text-sm font-semibold sm:mt-6 sm:gap-5">
              Open your map{" "}
              <ArrowUpRight className="size-5 transition-transform group-hover:translate-x-1 group-hover:-translate-y-1 motion-reduce:transform-none" />
            </span>
          </div>
        </Link>

        {/* Travel notes card: placed under Take the scenic way */}
        <section
          className="relative mb-8 border border-border bg-card p-5 shadow-[4px_4px_0_0_var(--secondary)]"
          aria-labelledby="trip-heading"
        >
          <div className="mb-5 flex items-center justify-between">
            <h3
              id="trip-heading"
              className="text-[10px] font-semibold uppercase tracking-[0.2em]"
            >
              Your travel notes
            </h3>
            <span
              className="h-2 w-2 rounded-full border border-primary"
              aria-hidden="true"
            />
          </div>
          {isPending ? (
            <div role="status" className="space-y-3">
              <span className="sr-only">Loading your trip</span>
              <div className="h-8 w-2/3 animate-pulse bg-muted motion-reduce:animate-none" />
              <div className="h-14 animate-pulse bg-muted motion-reduce:animate-none" />
            </div>
          ) : isError ? (
            <div>
              <p className="text-sm">Your trip details couldn’t load.</p>
              <button
                className="mt-3 min-h-11 text-sm font-semibold underline"
                onClick={() => void refetch()}
              >
                Try again
              </button>
            </div>
          ) : trip ? (
            <>
              <h4 className="break-words font-display text-3xl">
                {trip.destination}
              </h4>
              <p className="mt-2 text-xs text-muted-foreground">
                {trip.days} day{trip.days === 1 ? "" : "s"} ·{" "}
                {trip.travel_style === "group"
                  ? "Travelling together"
                  : "Your own adventure"}
              </p>
              {trip.start_date && (
                <p className="mt-4 text-sm">
                  {new Date(
                    `${trip.start_date.slice(0, 10)}T12:00:00`,
                  ).toLocaleDateString("en-IN", {
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  })}
                </p>
              )}
              {travellers.length > 0 && (
                <p className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
                  <Users className="size-4" />
                  {travellers.length} registered companion
                  {travellers.length === 1 ? "" : "s"}
                </p>
              )}
              <Link
                to="/setup"
                className="mt-5 flex min-h-11 items-center justify-between border-t border-dashed border-border pt-3 text-xs font-semibold"
              >
                Edit trip details <ArrowUpRight className="size-4" />
              </Link>
            </>
          ) : (
            <>
              <h4 className="font-display text-3xl">
                Every trip starts
                <br />
                with an idea.
              </h4>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                Add your destination and the people coming along.
              </p>
              <Link
                to="/setup"
                className="mt-5 flex min-h-11 items-center justify-between border-t border-dashed border-border pt-3 text-sm font-semibold text-primary"
              >
                Set up your trip <ArrowRight className="size-4" />
              </Link>
            </>
          )}
        </section>

        {/* Lower section layout: Single-column stack matching Image 2 */}
        <div className="space-y-8">
          {/* Trip Card with Weather */}
          <section
            aria-label="Trip planner"
            className="rounded-2xl border border-border bg-card p-5 sm:p-6"
          >
            <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">
              Your day, thoughtfully planned
            </p>
            <div className="mt-2 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <h3 className="font-display text-2xl sm:text-3xl text-foreground">
                  A few hours. A whole lot of Goa.
                </h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Build an itinerary around the time you have.
                </p>
              </div>
              <Link
                to="/itinerary"
                className="inline-flex min-h-10 items-center justify-center self-start sm:self-auto shrink-0 rounded-lg bg-foreground px-4 text-xs font-semibold text-background transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-primary"
              >
                Build my itinerary →
              </Link>
            </div>

            <div className="mt-4 border-t border-border pt-3.5 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <Sun className="size-4 text-primary shrink-0" aria-hidden="true" />
                <span>Today: 31°C, sunny</span>
              </span>
              <span>•</span>
              <span>Tomorrow: 29°C, afternoon showers</span>
              <Link
                to="/explore"
                className="inline-flex items-center gap-0.5 font-medium text-primary hover:underline focus-visible:outline-2 focus-visible:outline-primary"
              >
                Full forecast
                <ArrowUpRight className="size-3.5" aria-hidden="true" />
              </Link>
            </div>
          </section>

          {/* Somewhere worth a detour */}
          <section aria-labelledby="places-heading">
            <div className="mb-2 flex items-baseline justify-between gap-3">
              <h3 id="places-heading" className="font-display text-2xl text-foreground">
                Somewhere worth a detour
              </h3>
              <Link
                to="/explore"
                className="inline-flex items-center gap-0.5 text-xs sm:text-sm font-semibold text-primary hover:underline focus-visible:outline-2 focus-visible:outline-primary"
              >
                Explore all <ArrowUpRight className="size-4" />
              </Link>
            </div>
            <div className="divide-y divide-border border-b border-border">
              {PLACES.map((place) => (
                <Link
                  key={place.name}
                  to="/explore"
                  search={{ place: place.name }}
                  className="group grid grid-cols-[48px_1fr_24px] sm:grid-cols-[56px_1fr_24px] items-center py-4 px-2 -mx-2 rounded-lg transition-colors hover:bg-muted/40 focus-visible:outline-2 focus-visible:outline-primary"
                >
                  <span className="font-display text-3xl italic text-muted-foreground/60 select-none">
                    {place.number}
                  </span>
                  <div className="min-w-0 pr-2">
                    <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                      {place.category}
                    </p>
                    <h4 className="mt-0.5 font-display text-2xl text-foreground transition-colors group-hover:text-primary">
                      {place.name}
                    </h4>
                  </div>
                  <ArrowUpRight className="size-5 text-primary transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                </Link>
              ))}
            </div>
          </section>

          {/* Travel with peace of mind */}
          <section aria-labelledby="safety-heading">
            <p
              id="safety-heading"
              className="text-xs uppercase tracking-[0.14em] text-muted-foreground mb-3"
            >
              Travel with peace of mind
            </p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              {SAFETY_CARDS.map((card) => {
                const Icon = card.icon;
                return (
                  <div
                    key={card.title}
                    className="flex flex-col justify-between rounded-xl bg-card border border-border/60 p-4 transition-colors"
                  >
                    <div>
                      <Icon className="size-5 text-primary" aria-hidden="true" />
                      <h4 className="mt-2 text-sm sm:text-base font-medium text-foreground">
                        {card.title}
                      </h4>
                      <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                        {card.description}
                      </p>
                    </div>
                    <Link
                      to={card.to}
                      className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline focus-visible:outline-2 focus-visible:outline-primary"
                    >
                      <span>{card.label}</span>
                      <ArrowUpRight className="size-3.5" aria-hidden="true" />
                    </Link>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Explore & your bucket list link */}
          <div className="pt-2">
            <Link
              to="/explore"
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline focus-visible:outline-2 focus-visible:outline-primary"
            >
              Explore & your bucket list <ArrowRight className="size-4" />
            </Link>
          </div>
        </div>
        <div className="mt-10 flex items-center justify-between border-t border-border pt-5 text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
          <span>Made for the journey.</span>
          <span>Go with Safr.</span>
        </div>
      </div>
    </AppShell>
  );
}
