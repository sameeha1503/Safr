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
        <div className="flex items-center justify-between border-b border-orange-100/70 pb-4 text-[10px] font-semibold uppercase tracking-[0.2em] sm:text-xs">
          <span className="flex items-center gap-2 text-stone-700">
            <span className="h-2 w-2 rounded-full bg-gradient-to-r from-[#ff5e28] to-[#ff2b58]" /> The Goa
            edition
          </span>
          <span className="rounded-full bg-orange-100/80 text-orange-800 px-2.5 py-0.5 font-bold border border-orange-200/50">
            Explore / Wander / Belong
          </span>
        </div>

        <section className="py-7 sm:py-10" aria-labelledby="dashboard-heading">
          <p className="mb-3 text-sm text-stone-600 font-medium">
            {trip?.traveller_name
              ? `Make it your kind of trip, ${trip.traveller_name}.`
              : "A change of scene starts here."}
          </p>
          <h2
            id="dashboard-heading"
            className="max-w-xl font-display text-[clamp(2.8rem,7vw,4.6rem)] leading-[1.04] tracking-[-0.045em] font-black text-stone-900"
          >
            Go a little further.
            <br />
            <span className="bg-gradient-to-r from-[#ff5400] via-[#ff3344] to-[#e60067] bg-clip-text text-transparent italic">
              Stay a little longer.
            </span>
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
          className="relative mb-8 rounded-3xl border border-stone-200/70 bg-white/80 backdrop-blur-xl p-6 shadow-sm hover:shadow-md transition-all"
          aria-labelledby="trip-heading"
        >
          <div className="mb-5 flex items-center justify-between">
            <h3
              id="trip-heading"
              className="text-[10px] font-semibold uppercase tracking-[0.2em] text-stone-500"
            >
              Your travel notes
            </h3>
            <span
              className="h-2.5 w-2.5 rounded-full bg-gradient-to-r from-[#ff5e28] to-[#ff2b58]"
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
              <h4 className="break-words font-display text-3xl font-black text-stone-900">
                {trip.destination}
              </h4>
              <p className="mt-2 text-xs text-stone-600">
                {trip.days} day{trip.days === 1 ? "" : "s"} ·{" "}
                {trip.travel_style === "group"
                  ? "Travelling together"
                  : "Your own adventure"}
              </p>
              {trip.start_date && (
                <p className="mt-4 text-sm font-medium text-stone-800">
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
                <p className="mt-3 flex items-center gap-2 text-xs text-stone-600">
                  <Users className="size-4 text-orange-500" />
                  {travellers.length} registered companion
                  {travellers.length === 1 ? "" : "s"}
                </p>
              )}
              <Link
                to="/setup"
                className="mt-5 flex min-h-11 items-center justify-between border-t border-dashed border-stone-200 pt-3 text-xs font-semibold text-[#ff5e28] hover:text-[#e60067] transition-colors"
              >
                Edit trip details <ArrowUpRight className="size-4" />
              </Link>
            </>
          ) : (
            <>
              <h4 className="font-display text-3xl font-black text-stone-900">
                Every trip starts
                <br />
                with an idea.
              </h4>
              <p className="mt-3 text-sm leading-relaxed text-stone-600">
                Add your destination and the people coming along.
              </p>
              <Link
                to="/setup"
                className="mt-5 flex min-h-11 items-center justify-between border-t border-dashed border-stone-200 pt-3 text-sm font-semibold text-[#ff5e28] hover:text-[#e60067] transition-colors"
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
            className="rounded-3xl border border-stone-200/70 bg-white/80 backdrop-blur-xl p-6 shadow-sm hover:shadow-md transition-all"
          >
            <p className="text-xs uppercase tracking-[0.14em] text-stone-500 font-semibold">
              Your day, thoughtfully planned
            </p>
            <div className="mt-2 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <h3 className="font-display text-2xl sm:text-3xl text-stone-900 font-bold">
                  A few hours. A whole lot of Goa.
                </h3>
                <p className="mt-1 text-sm text-stone-600 font-normal">
                  Build an itinerary around the time you have.
                </p>
              </div>
              <Link
                to="/itinerary"
                className="inline-flex min-h-10 items-center justify-center self-start sm:self-auto shrink-0 rounded-full btn-warm-gradient px-5 py-2.5 text-xs font-bold text-white shadow-md active:scale-95 transition-all"
              >
                Build my itinerary →
              </Link>
            </div>

            <div className="mt-4 border-t border-stone-200/70 pt-3.5 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-stone-600">
              <span className="inline-flex items-center gap-1.5 font-medium text-stone-700">
                <Sun className="size-4 text-orange-500 shrink-0" aria-hidden="true" />
                <span>Today: 31°C, sunny</span>
              </span>
              <span>•</span>
              <span>Tomorrow: 29°C, afternoon showers</span>
              <Link
                to="/explore"
                className="inline-flex items-center gap-0.5 font-semibold text-teal-600 hover:text-teal-700 hover:underline focus-visible:outline-2 focus-visible:outline-teal-600"
              >
                Full forecast
                <ArrowUpRight className="size-3.5" aria-hidden="true" />
              </Link>
            </div>
          </section>

          {/* Somewhere worth a detour */}
          <section aria-labelledby="places-heading">
            <div className="mb-2 flex items-baseline justify-between gap-3">
              <h3 id="places-heading" className="font-display text-2xl font-bold text-stone-900">
                Somewhere worth a detour
              </h3>
              <Link
                to="/explore"
                className="inline-flex items-center gap-0.5 text-xs sm:text-sm font-semibold text-teal-600 hover:text-teal-700 hover:underline focus-visible:outline-2 focus-visible:outline-teal-600"
              >
                Explore all <ArrowUpRight className="size-4" />
              </Link>
            </div>
            <div className="divide-y divide-stone-200/70 border-b border-stone-200/70">
              {PLACES.map((place) => (
                <Link
                  key={place.name}
                  to="/explore"
                  search={{ place: place.name }}
                  className="group grid grid-cols-[48px_1fr_24px] sm:grid-cols-[56px_1fr_24px] items-center py-4 px-2 -mx-2 rounded-xl transition-colors hover:bg-orange-50/60 focus-visible:outline-2 focus-visible:outline-teal-600"
                >
                  <span className="font-display text-3xl italic text-orange-400/80 select-none">
                    {place.number}
                  </span>
                  <div className="min-w-0 pr-2">
                    <p className="text-[11px] uppercase tracking-[0.14em] text-stone-500 font-semibold">
                      {place.category}
                    </p>
                    <h4 className="mt-0.5 font-display text-2xl text-stone-900 transition-colors group-hover:text-orange-600">
                      {place.name}
                    </h4>
                  </div>
                  <ArrowUpRight className="size-5 text-teal-600 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                </Link>
              ))}
            </div>
          </section>

          {/* Travel with peace of mind */}
          <section aria-labelledby="safety-heading">
            <p
              id="safety-heading"
              className="text-xs uppercase tracking-[0.14em] text-stone-500 font-semibold mb-3"
            >
              Travel with peace of mind
            </p>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              {SAFETY_CARDS.map((card) => {
                const Icon = card.icon;
                return (
                  <div
                    key={card.title}
                    className="flex flex-col justify-between rounded-2xl bg-white/75 backdrop-blur-xl border border-stone-200/70 p-5 shadow-sm hover:shadow-lg hover:border-orange-200/80 transition-all hover:-translate-y-0.5"
                  >
                    <div>
                      <div className="size-10 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center mb-3">
                        <Icon className="size-5 text-teal-600" aria-hidden="true" />
                      </div>
                      <h4 className="text-base font-bold text-stone-900 font-display">
                        {card.title}
                      </h4>
                      <p className="mt-1 text-xs text-stone-600 leading-relaxed font-normal">
                        {card.description}
                      </p>
                    </div>
                    <Link
                      to={card.to}
                      className="mt-4 inline-flex items-center gap-1 text-xs font-semibold text-teal-600 hover:text-teal-700 hover:underline focus-visible:outline-2 focus-visible:outline-teal-600"
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
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-teal-600 hover:text-teal-700 hover:underline focus-visible:outline-2 focus-visible:outline-teal-600"
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
