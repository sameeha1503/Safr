import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowRight,
  ArrowUpRight,
  CalendarDays,
  Compass,
  LocateFixed,
  Phone,
  QrCode,
  Users,
} from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { SafeTagAlertBanner } from "@/components/safetag-alert-banner";
import { WeatherWidget } from "@/components/WeatherWidget";
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
const COMPANION_TOOLS = [
  {
    to: "/live-tracking",
    icon: LocateFixed,
    title: "Find your people",
    description: "Shared locations & meeting spots",
    label: "Reunite",
  },
  {
    to: "/safety-tags",
    icon: QrCode,
    title: "Keep them connected",
    description: "QR wristbands for your companions",
    label: "SafeTags",
  },
  {
    to: "/emergency",
    icon: Phone,
    title: "Help, when it matters",
    description: "Emergency numbers & local assistance",
    label: "Emergency",
  },
] as const;

function Dashboard() {
  const [showWeather, setShowWeather] = useState(false);
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
      <div>
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
        <div className="grid gap-7 lg:grid-cols-[minmax(0,1fr)_260px] lg:gap-8">
          <div className="min-w-0 space-y-7">
            <Link
              to="/map"
              className="group relative isolate flex min-h-[320px] flex-col justify-between overflow-hidden rounded-[4px_42px_4px_4px] bg-[#123f3b] p-6 text-[#fff9eb] focus-visible:outline-4 focus-visible:outline-offset-4 focus-visible:outline-primary sm:min-h-[350px] sm:p-8"
            >
              <CoastalArtwork />
              <div className="relative flex items-center justify-between">
                <span className="text-xs uppercase tracking-[0.2em]">
                  Take the scenic way
                </span>
                <Compass className="size-6 opacity-80" aria-hidden="true" />
              </div>
              <div className="relative max-w-[300px] pt-14">
                <h3 className="font-display text-[2rem] leading-[1.05] sm:text-[2.5rem]">
                  Less searching.
                  <br />
                  More exploring.
                </h3>
                <p className="mt-3 max-w-44 text-sm leading-relaxed text-[#e2ece5] sm:max-w-52">
                  Find a place, trace your route, and see where the day takes
                  you.
                </p>
                <span className="mt-6 inline-flex min-h-11 items-center gap-5 border-b border-white/60 pb-1 text-sm font-semibold">
                  Open your map{" "}
                  <ArrowUpRight className="size-5 transition-transform group-hover:translate-x-1 group-hover:-translate-y-1 motion-reduce:transform-none" />
                </span>
              </div>
            </Link>
            <Link
              to="/itinerary"
              className="group flex items-center gap-4 border-y border-border py-5 focus-visible:outline-2 focus-visible:outline-primary sm:gap-5"
            >
              <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-[#e8b987]/25 text-foreground">
                <CalendarDays className="size-5" />
              </span>
              <div className="flex-1">
                <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                  Your day, thoughtfully planned
                </p>
                <h3 className="mt-1 font-display text-2xl">
                  A few hours. A whole lot of Goa.
                </h3>
                <p className="mt-1 text-xs text-muted-foreground">
                  Build an itinerary around the time you have.
                </p>
              </div>
              <ArrowRight className="size-5 shrink-0 transition-transform group-hover:translate-x-1 motion-reduce:transform-none" />
            </Link>
            <section aria-labelledby="places-heading">
              <div className="mb-2 flex items-center justify-between gap-3">
                <h3 id="places-heading" className="font-display text-2xl">
                  Somewhere worth a detour.
                </h3>
                <Link
                  to="/explore"
                  className="inline-flex min-h-11 shrink-0 items-center gap-1 text-xs font-semibold text-primary"
                >
                  Explore all <ArrowUpRight className="size-4" />
                </Link>
              </div>
              <div className="divide-y divide-border">
                {PLACES.map((place) => (
                  <Link
                    key={place.name}
                    to="/explore"
                    search={{ place: place.name }}
                    className="group flex min-h-24 items-center gap-5 py-4 focus-visible:outline-2 focus-visible:outline-primary"
                  >
                    <span className="font-display text-3xl italic text-muted-foreground/60">
                      {place.number}
                    </span>
                    <div className="flex-1">
                      <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                        {place.category}
                      </p>
                      <h4 className="mt-1 font-display text-2xl transition-colors group-hover:text-primary">
                        {place.name}
                      </h4>
                    </div>
                    <ArrowUpRight className="size-4 text-muted-foreground" />
                  </Link>
                ))}
              </div>
              <Link
                to="/explore"
                className="mt-2 inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-primary"
              >
                Explore & your bucket list <ArrowRight className="size-4" />
              </Link>
            </section>
          </div>
          <aside className="space-y-7" aria-label="Your trip and companions">
            <section
              className="relative border border-border bg-card p-5 shadow-[4px_4px_0_0_var(--secondary)]"
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
            <section aria-labelledby="company-heading">
              <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                A little peace of mind
              </p>
              <h3 id="company-heading" className="mt-2 font-display text-2xl">
                In good company.
              </h3>
              <div className="mt-3 divide-y divide-border">
                {COMPANION_TOOLS.map((tool) => (
                  <Link
                    key={tool.to}
                    to={tool.to}
                    aria-label={`${tool.label}: ${tool.title}`}
                    className="group flex items-start gap-3 py-4 focus-visible:outline-2 focus-visible:outline-primary"
                  >
                    <tool.icon className="mt-1 size-4 shrink-0 text-primary" />
                    <div className="flex-1">
                      <h4 className="text-sm font-semibold group-hover:text-primary">
                        {tool.title}
                      </h4>
                      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                        {tool.description}
                      </p>
                      <span className="mt-2 inline-block text-[10px] font-semibold uppercase tracking-wider text-primary">
                        {tool.label} ↗
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            </section>
            <details
              className="border-t border-border pt-3"
              onToggle={(event) => setShowWeather(event.currentTarget.open)}
            >
              <summary className="min-h-11 cursor-pointer py-2 text-sm font-semibold">
                Before you head out · Weather
              </summary>
              <div className="mt-3">{showWeather && <WeatherWidget />}</div>
            </details>
          </aside>
        </div>
        <div className="mt-10 flex items-center justify-between border-t border-border pt-5 text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
          <span>Made for the journey.</span>
          <span>Go with Safr.</span>
        </div>
      </div>
    </AppShell>
  );
}
