import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Compass,
  ShieldCheck,
  ChevronRight,
  Sparkles,
  QrCode,
  Waves,
} from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { GoogleTranslate } from "@/components/GoogleTranslate";
import { SafrLogo } from "@/components/SafrLogo";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Safr — AI Travel Safety Companion | Goa" },
      {
        name: "description",
        content:
          "Plan safer trips across India: road maps, visitor guidance, QR safety tags for kids and elders, and AI itineraries. Currently piloted in Goa.",
      },
      { property: "og:title", content: "Safr — AI Travel Safety Companion" },
      {
        property: "og:description",
        content:
          "Road routes, visitor guidance, QR safety tags and AI itineraries — piloted in Goa, built for India.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Landing,
});

/* Minimalist Coastal Doodle SVGs matching the reference aesthetic */
function SunDoodle({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 64 64"
      fill="none"
      className={className}
      stroke="currentColor"
    >
      <circle cx="32" cy="32" r="14" strokeWidth="2.8" strokeLinecap="round" />
      <line
        x1="32"
        y1="6"
        x2="32"
        y2="12"
        strokeWidth="3"
        strokeLinecap="round"
      />
      <line
        x1="32"
        y1="52"
        x2="32"
        y2="58"
        strokeWidth="3"
        strokeLinecap="round"
      />
      <line
        x1="6"
        y1="32"
        x2="12"
        y2="32"
        strokeWidth="3"
        strokeLinecap="round"
      />
      <line
        x1="52"
        y1="32"
        x2="58"
        y2="32"
        strokeWidth="3"
        strokeLinecap="round"
      />
      <line
        x1="13.5"
        y1="13.5"
        x2="18"
        y2="18"
        strokeWidth="3"
        strokeLinecap="round"
      />
      <line
        x1="46"
        y1="46"
        x2="50.5"
        y2="50.5"
        strokeWidth="3"
        strokeLinecap="round"
      />
      <line
        x1="13.5"
        y1="50.5"
        x2="18"
        y2="46"
        strokeWidth="3"
        strokeLinecap="round"
      />
      <line
        x1="46"
        y1="18"
        x2="50.5"
        y2="13.5"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  );
}

function UmbrellaDoodle({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 64 64"
      fill="none"
      className={className}
      stroke="currentColor"
    >
      <line
        x1="32"
        y1="9"
        x2="32"
        y2="6"
        strokeWidth="2.8"
        strokeLinecap="round"
      />
      <path
        d="M12 30 C12 18, 21 10, 32 10 C43 10, 52 18, 52 30 C47 28, 42 28, 37 30 C32 28, 27 28, 22 30 C17 28, 12 28, 12 30 Z"
        strokeWidth="2.8"
        strokeLinejoin="round"
      />
      <path
        d="M32 30 L32 46 C32 51 36.5 53 40 50"
        strokeWidth="2.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function PalmTreeDoodle({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 64 64"
      fill="none"
      className={className}
      stroke="currentColor"
    >
      <path
        d="M32 58 C31 46 29 36 26 26"
        strokeWidth="3.2"
        strokeLinecap="round"
      />
      <path
        d="M26 26 C16 22 8 28 6 38 C10 32 18 30 26 28"
        strokeWidth="2.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M26 26 C15 16 7 20 6 26 C12 22 20 22 26 26"
        strokeWidth="2.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M26 26 C34 18 45 18 53 26 C45 24 35 24 26 26"
        strokeWidth="2.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M26 26 C34 26 45 28 49 38 C43 30 33 30 26 28"
        strokeWidth="2.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M26 26 C25 16 27 8 31 6 C31 14 29 20 26 26"
        strokeWidth="2.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function WavesDoodle({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 64 64"
      fill="none"
      className={className}
      stroke="currentColor"
    >
      <path
        d="M6 18 C12 12 18 24 24 18 C30 12 36 24 42 18 C48 12 54 24 60 18"
        strokeWidth="3.2"
        strokeLinecap="round"
      />
      <path
        d="M6 32 C12 26 18 38 24 32 C30 26 36 38 42 32 C48 26 54 38 60 32"
        strokeWidth="3.2"
        strokeLinecap="round"
      />
      <path
        d="M6 46 C12 40 18 52 24 46 C30 40 36 52 42 46 C48 40 56 52 60 46"
        strokeWidth="3.2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function ShellDoodle({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 64 64"
      fill="none"
      className={className}
      stroke="currentColor"
    >
      <path
        d="M32 32 C32 28 28 26 25 28 C21 31 22 37 26 40 C32 44 40 40 42 33 C44 24 36 16 27 17 C16 18 10 29 12 40 C14 52 28 58 41 55 C53 52 59 38 56 25 C53 11 38 4 23 7"
        strokeWidth="2.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function Landing() {
  const [signedIn, setSignedIn] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setSignedIn(Boolean(data.user)));
  }, []);

  return (
    <main className="min-h-screen bg-[#fffdfa] selection:bg-orange-500/20 relative overflow-hidden text-stone-900 font-sans">
      {/* Ambient Pastel Aurora Mesh Lighting Layers */}
      <div className="pointer-events-none absolute -top-24 -left-20 h-[580px] w-[580px] rounded-full bg-[radial-gradient(circle_at_center,rgba(254,243,199,0.75)_0%,rgba(254,215,170,0.35)_45%,transparent_70%)] blur-[95px] animate-aurora-1" />
      <div className="pointer-events-none absolute top-1/4 -left-28 h-[640px] w-[640px] rounded-full bg-[radial-gradient(circle_at_center,rgba(209,250,229,0.75)_0%,rgba(167,243,208,0.35)_45%,transparent_70%)] blur-[105px] animate-aurora-2" />
      <div className="pointer-events-none absolute -top-20 right-0 h-[660px] w-[660px] rounded-full bg-[radial-gradient(circle_at_center,rgba(255,228,230,0.85)_0%,rgba(254,205,211,0.35)_45%,transparent_70%)] blur-[110px] animate-aurora-1" />
      <div className="pointer-events-none absolute bottom-1/3 -right-24 h-[560px] w-[560px] rounded-full bg-[radial-gradient(circle_at_center,rgba(224,231,255,0.6)_0%,rgba(207,250,254,0.35)_45%,transparent_70%)] blur-[100px] animate-aurora-2" />
      <div className="pointer-events-none absolute -bottom-32 left-1/3 h-[520px] w-[520px] rounded-full bg-[radial-gradient(circle_at_center,rgba(254,243,199,0.55)_0%,rgba(209,250,229,0.3)_45%,transparent_70%)] blur-[90px]" />

      {/* Floating Animated Coast Doodles (matching reference layout & pastel palette) */}
      <div
        className="absolute top-14 left-[9%] text-[#f6c08b] animate-doodle-sun doodle-interactive z-10 hidden md:block"
        title="Sunny Goa"
      >
        <SunDoodle className="size-16 lg:size-20" />
      </div>

      <div
        className="absolute top-24 left-[24%] text-[#a5c8e4] animate-doodle-umbrella doodle-interactive z-10 hidden lg:block"
        title="Beach Parasol"
      >
        <UmbrellaDoodle className="size-12 lg:size-15" />
      </div>

      <div
        className="absolute bottom-20 left-[5%] text-[#9cd7b9] animate-doodle-palm doodle-interactive z-10 hidden md:block"
        title="Coastal Palms"
      >
        <PalmTreeDoodle className="size-20 lg:size-28" />
      </div>

      <div
        className="absolute top-20 right-[13%] text-[#c4b5fd] animate-doodle-wave doodle-interactive z-10 hidden md:block"
        title="Ocean Swells"
      >
        <WavesDoodle className="w-16 h-12 lg:w-20 lg:h-14" />
      </div>

      <div
        className="absolute top-1/2 right-[6%] text-[#fca5a5] animate-doodle-shell doodle-interactive z-10 hidden lg:block"
        title="Goan Seashell"
      >
        <ShellDoodle className="size-12 lg:size-15" />
      </div>

      <div
        className="absolute bottom-20 right-[9%] text-[#99d5c9] animate-doodle-palm doodle-interactive z-10 hidden md:block"
        title="Palm Shadows"
      >
        <PalmTreeDoodle className="size-20 lg:size-24 scale-x-[-1]" />
      </div>

      {/* Floating Header */}
      <header className="sticky top-0 z-50 border-b border-orange-100/50 bg-[#fffdfa]/75 backdrop-blur-2xl transition-all shadow-[0_1px_12px_rgba(0,0,0,0.02)]">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link to="/" className="flex items-center gap-2.5 group">
            <SafrLogo size={42} />
            <div>
              <span className="text-xl font-black tracking-tight font-display text-stone-900">
                Safr
              </span>
              <span className="ml-1.5 rounded-full bg-orange-100/80 text-orange-800 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider border border-orange-200/50">
                Goa
              </span>
            </div>
          </Link>

          <div className="flex items-center gap-3">
            <div className="hidden sm:block">
              <GoogleTranslate />
            </div>
            <Button
              asChild
              variant="outline"
              size="sm"
              className="rounded-full btn-warm-teal text-xs py-1.5 px-3.5 shadow-sm active:scale-95"
            >
              <Link to="/find">
                <ShieldCheck className="size-3.5 mr-1 text-teal-600" /> Enter
                OTP
              </Link>
            </Button>
            <Button
              asChild
              size="sm"
              className="rounded-full btn-warm-gradient text-white font-bold text-xs shadow-md active:scale-95 border-0"
            >
              <Link to={signedIn ? "/dashboard" : "/auth"}>
                {signedIn ? "Open Dashboard" : "Sign In"}
              </Link>
            </Button>
          </div>
        </div>
      </header>

      {/* HERO SECTION */}
      <section className="relative pt-12 pb-20 px-6 sm:pt-20 sm:pb-28">
        <div className="mx-auto max-w-4xl text-center relative z-20">
          <h1 className="mt-2 sm:mt-4 text-5xl font-black tracking-tight font-display text-stone-900 sm:text-7xl lg:text-8xl leading-[1.08]">
            Travel safer. <br />
            <span className="bg-gradient-to-r from-[#ff5400] via-[#ff3344] to-[#e60067] bg-clip-text text-transparent">
              Skip the trouble.
            </span>
          </h1>

          <p className="mx-auto mt-6 max-w-2xl text-base sm:text-lg text-stone-600 leading-relaxed font-normal">
            Road routes, local do's and don'ts, printable QR safety tags for
            your family, and an AI plan for every free hour you have — built for
            travel across India, currently piloted in Goa.
          </p>

          {/* Action CTAs: Matching the 3 buttons in the screenshot */}
          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Button
              asChild
              size="lg"
              className="w-full sm:w-auto h-12 sm:h-13 px-8 rounded-full text-sm sm:text-base font-bold btn-warm-gradient text-white border-0"
            >
              <Link to={signedIn ? "/dashboard" : "/auth"}>
                {signedIn ? "Open My Trip Dashboard" : "Start planning"}
              </Link>
            </Button>
            {!signedIn && (
              <Button
                asChild
                size="lg"
                variant="outline"
                className="w-full sm:w-auto h-12 sm:h-13 px-8 rounded-full text-sm sm:text-base font-bold btn-warm-white"
              >
                <Link to="/auth" search={{ mode: "signup" }}>
                  Create an account
                </Link>
              </Button>
            )}
            <Button
              asChild
              size="lg"
              variant="outline"
              className="w-full sm:w-auto h-12 sm:h-13 px-7 rounded-full text-sm sm:text-base font-bold btn-warm-teal"
            >
              <Link to="/find">Found someone? Enter OTP</Link>
            </Button>
          </div>

          {/* Trust Stat Badges */}
          <div className="mt-14 pt-10 border-t border-stone-200/60 grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
            <div className="bg-white/70 backdrop-blur-md rounded-2xl p-4 border border-stone-200/70 shadow-sm hover:shadow-md hover:border-orange-200 hover:-translate-y-0.5 transition-all duration-300">
              <p className="text-2xl font-black font-display text-orange-600">
                100%
              </p>
              <p className="text-xs font-semibold text-stone-600 mt-0.5">
                Zero-Knowledge Privacy
              </p>
            </div>
            <div className="bg-white/70 backdrop-blur-md rounded-2xl p-4 border border-stone-200/70 shadow-sm hover:shadow-md hover:border-rose-200 hover:-translate-y-0.5 transition-all duration-300">
              <p className="text-2xl font-black font-display text-rose-600">
                112 Hub
              </p>
              <p className="text-xs font-semibold text-stone-600 mt-0.5">
                Goa Police & Ambulance
              </p>
            </div>
            <div className="bg-white/70 backdrop-blur-md rounded-2xl p-4 border border-stone-200/70 shadow-sm hover:shadow-md hover:border-teal-200 hover:-translate-y-0.5 transition-all duration-300">
              <p className="text-2xl font-black font-display text-teal-600">
                Weather
              </p>
              <p className="text-xs font-semibold text-stone-600 mt-0.5">
                Forecast & Beach Guidance
              </p>
            </div>
            <div className="bg-white/70 backdrop-blur-md rounded-2xl p-4 border border-stone-200/70 shadow-sm hover:shadow-md hover:border-emerald-200 hover:-translate-y-0.5 transition-all duration-300">
              <p className="text-2xl font-black font-display text-emerald-600">
                10 Languages
              </p>
              <p className="text-xs font-semibold text-stone-600 mt-0.5">
                Indian Languages Support
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* FEATURE PREVIEW BENTO GRID */}
      <section className="relative py-16 px-6 max-w-6xl mx-auto z-20">
        <div className="text-center mb-12">
          <span className="rounded-full bg-orange-100/90 text-orange-800 border border-orange-200/60 px-3.5 py-1 text-xs font-bold uppercase tracking-wider">
            Intelligent Safety Suite
          </span>
          <h2 className="text-3xl sm:text-4xl font-extrabold font-display tracking-tight text-stone-900 mt-3">
            Designed for carefree Goan adventures
          </h2>
          <p className="text-stone-600 text-sm sm:text-base mt-2 max-w-xl mx-auto">
            Everything you need for peace of mind while exploring coastal roads,
            bustling markets, and serene beaches.
          </p>
        </div>

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {/* Card 1: Safe vs Fast Navigation */}
          <div className="group relative overflow-hidden rounded-3xl border border-stone-200/70 bg-white/75 backdrop-blur-xl p-6 shadow-sm transition-all hover:shadow-xl hover:-translate-y-1.5 hover:border-orange-300/80 flex flex-col justify-between">
            <div className="absolute top-0 right-0 w-32 h-32 bg-orange-200/20 rounded-full blur-2xl group-hover:bg-orange-300/30 transition-colors" />
            <div>
              <div className="size-12 rounded-2xl bg-orange-100/80 text-orange-600 flex items-center justify-center mb-4 transition-transform group-hover:scale-110">
                <Compass className="size-6" />
              </div>
              <span className="text-[10px] font-extrabold uppercase tracking-widest text-orange-700">
                OSRM Routing Engine
              </span>
              <h3 className="text-lg font-bold font-display text-stone-900 mt-1">
                Road Routes & Navigation
              </h3>
              <p className="text-xs text-stone-600 leading-relaxed mt-2">
                Find OSRM driving routes with turn-by-turn steps and compare
                route options before you set off.
              </p>
            </div>
            <Link
              to="/map"
              className="mt-5 inline-flex items-center text-xs font-bold text-orange-600 group-hover:text-orange-700"
            >
              Test Route Engine{" "}
              <ChevronRight className="size-3.5 ml-0.5 transition-transform group-hover:translate-x-1" />
            </Link>
          </div>

          {/* Card 2: Marine Swell & Weather */}
          <div className="group relative overflow-hidden rounded-3xl border border-stone-200/70 bg-white/75 backdrop-blur-xl p-6 shadow-sm transition-all hover:shadow-xl hover:-translate-y-1.5 hover:border-teal-300/80 flex flex-col justify-between">
            <div className="absolute top-0 right-0 w-32 h-32 bg-teal-200/20 rounded-full blur-2xl group-hover:bg-teal-300/30 transition-colors" />
            <div>
              <div className="size-12 rounded-2xl bg-teal-100/80 text-teal-600 flex items-center justify-center mb-4 transition-transform group-hover:scale-110">
                <Waves className="size-6" />
              </div>
              <span className="text-[10px] font-extrabold uppercase tracking-widest text-teal-700">
                7-Day Station
              </span>
              <h3 className="text-lg font-bold font-display text-stone-900 mt-1">
                Weather & Beach Guidance
              </h3>
              <p className="text-xs text-stone-600 leading-relaxed mt-2">
                Weather, UV and rain forecasts for your current location. Check
                posted beach flags and local lifeguard advice for swimming
                conditions.
              </p>
            </div>
            <Link
              to="/dashboard"
              className="mt-5 inline-flex items-center text-xs font-bold text-teal-600 group-hover:text-teal-700"
            >
              View Weather{" "}
              <ChevronRight className="size-3.5 ml-0.5 transition-transform group-hover:translate-x-1" />
            </Link>
          </div>

          {/* Card 3: Family SafeTags */}
          <div className="group relative overflow-hidden rounded-3xl border border-stone-200/70 bg-white/75 backdrop-blur-xl p-6 shadow-sm transition-all hover:shadow-xl hover:-translate-y-1.5 hover:border-rose-300/80 flex flex-col justify-between">
            <div className="absolute top-0 right-0 w-32 h-32 bg-rose-200/20 rounded-full blur-2xl group-hover:bg-rose-300/30 transition-colors" />
            <div>
              <div className="size-12 rounded-2xl bg-rose-100/80 text-rose-600 flex items-center justify-center mb-4 transition-transform group-hover:scale-110">
                <QrCode className="size-6" />
              </div>
              <span className="text-[10px] font-extrabold uppercase tracking-widest text-rose-700">
                Zero-Knowledge Privacy
              </span>
              <h3 className="text-lg font-bold font-display text-stone-900 mt-1">
                Family QR Safety Wristbands
              </h3>
              <p className="text-xs text-stone-600 leading-relaxed mt-2">
                Printable QR tags & 6-character OTP codes for kids and seniors.
                Strangers can notify guardians without ever seeing phone numbers
                or private details.
              </p>
            </div>
            <Link
              to="/safety-tags"
              className="mt-5 inline-flex items-center text-xs font-bold text-rose-600 group-hover:text-rose-700"
            >
              Generate SafeTag{" "}
              <ChevronRight className="size-3.5 ml-0.5 transition-transform group-hover:translate-x-1" />
            </Link>
          </div>

          {/* Card 4: AI Itinerary Generator */}
          <div className="group relative overflow-hidden rounded-3xl border border-stone-200/70 bg-white/75 backdrop-blur-xl p-6 shadow-sm transition-all hover:shadow-xl hover:-translate-y-1.5 hover:border-amber-300/80 flex flex-col justify-between">
            <div className="absolute top-0 right-0 w-32 h-32 bg-amber-200/20 rounded-full blur-2xl group-hover:bg-amber-300/30 transition-colors" />
            <div>
              <div className="size-12 rounded-2xl bg-amber-100/80 text-amber-700 flex items-center justify-center mb-4 transition-transform group-hover:scale-110">
                <Sparkles className="size-6" />
              </div>
              <span className="text-[10px] font-extrabold uppercase tracking-widest text-amber-800">
                Smart Time-Budgeting
              </span>
              <h3 className="text-lg font-bold font-display text-stone-900 mt-1">
                AI Hour-by-Hour Schedules
              </h3>
              <p className="text-xs text-stone-600 leading-relaxed mt-2">
                Have 4 or 8 free hours? Instantly build a personalized Goan
                itinerary matching your pace, interests, and transit notes with
                1-click stop navigation.
              </p>
            </div>
            <Link
              to="/itinerary"
              className="mt-5 inline-flex items-center text-xs font-bold text-amber-700 group-hover:text-amber-800"
            >
              Build Itinerary{" "}
              <ChevronRight className="size-3.5 ml-0.5 transition-transform group-hover:translate-x-1" />
            </Link>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="mt-20 border-t border-stone-200/60 bg-white/50 py-10 px-6 backdrop-blur-xl relative z-20">
        <div className="mx-auto max-w-6xl flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-stone-600">
          <div className="flex items-center gap-2">
            <span className="font-bold text-stone-900">
              Safr (Goa Guide Buddy)
            </span>
            <span>·</span>
            <span>Piloted in Goa, built for India.</span>
          </div>
          <div className="flex items-center gap-4">
            <Link
              to="/emergency"
              className="hover:text-stone-900 transition-colors"
            >
              Emergency Directory
            </Link>
            <Link to="/find" className="hover:text-stone-900 transition-colors">
              SafeTag OTP Finder
            </Link>
            <Link to="/auth" className="hover:text-stone-900 transition-colors">
              Account Sign In
            </Link>
          </div>
        </div>
      </footer>
    </main>
  );
}
