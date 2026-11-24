import { Link } from "@tanstack/react-router";
import {
  ArrowRight,
  ArrowUpRight,
  LocateFixed,
  MapPin,
  Phone,
  QrCode,
  Sun,
} from "lucide-react";
import type { ElementType } from "react";

/**
 * Configurable data arrays for easy swapping with API/live data.
 */
export interface DestinationItem {
  id: string;
  number: string;
  eyebrow: string;
  title: string;
  href: string;
}

export interface SafetyCardItem {
  id: string;
  icon: ElementType;
  title: string;
  description: string;
  linkLabel: string;
  href: string;
}

export interface WeatherInfo {
  today: string;
  tomorrow: string;
  forecastHref: string;
}

export const EMERGENCY_CONFIG = {
  title: "Emergency help",
  subtitle: "Local numbers and nearest support, one tap away",
  buttonText: "Call 112",
  phoneUrl: "tel:112",
};

export const TRIP_CARD_CONFIG = {
  eyebrow: "Your day, thoughtfully planned",
  headline: "A few hours. A whole lot of Goa.",
  subtitle: "Build an itinerary around the time you have.",
  buttonText: "Build my itinerary →",
  buttonHref: "/itinerary",
};

export const WEATHER_CONFIG: WeatherInfo = {
  today: "Today: 31°C, sunny",
  tomorrow: "Tomorrow: 29°C, afternoon showers",
  forecastHref: "/explore",
};

export const DESTINATIONS_CONFIG: DestinationItem[] = [
  {
    id: "palolem",
    number: "01",
    eyebrow: "For a coastal escape",
    title: "Palolem Beach",
    href: "/explore?place=Palolem+Beach",
  },
  {
    id: "aguada",
    number: "02",
    eyebrow: "For a little history",
    title: "Fort Aguada",
    href: "/explore?place=Fort+Aguada",
  },
  {
    id: "anjuna",
    number: "03",
    eyebrow: "For a different kind of find",
    title: "Anjuna Flea Market",
    href: "/explore?place=Anjuna+Flea+Market",
  },
];

export const SAFETY_CARDS_CONFIG: SafetyCardItem[] = [
  {
    id: "reunite",
    icon: LocateFixed,
    title: "Find your people",
    description: "Shared locations and meeting spots",
    linkLabel: "Open Reunite",
    href: "/live-tracking",
  },
  {
    id: "safetags",
    icon: QrCode,
    title: "Keep them connected",
    description: "QR wristbands for your companions",
    linkLabel: "Get SafeTags",
    href: "/safety-tags",
  },
  {
    id: "routes",
    icon: MapPin,
    title: "Safe routes",
    description: "Directions scored for safety",
    linkLabel: "Plan a route",
    href: "/map",
  },
];

export const FOOTER_CONFIG = {
  label: "Explore and your bucket list →",
  href: "/explore",
};

export function GoaTripPlannerSection() {
  return (
    <div className="w-full bg-[#FAF7F2] text-[#1C1B19] antialiased">
      <main className="mx-auto w-full max-w-[680px] px-4 py-6 sm:px-6 sm:py-8 font-sans">
        {/* 1. Emergency bar */}
        <section
          aria-label="Emergency help"
          className="flex flex-col sm:flex-row sm:items-center justify-between gap-3.5 rounded-[12px] bg-[#FCEBEB] p-4 text-[#1C1B19]"
        >
          <div className="flex items-start gap-3 min-w-0">
            <span className="flex size-7 shrink-0 items-center justify-center rounded-full text-[#A32D2D] mt-0.5">
              <Phone className="size-4" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <h2 className="text-[14px] font-medium leading-snug text-[#A32D2D]">
                {EMERGENCY_CONFIG.title}
              </h2>
              <p className="mt-0.5 text-[13px] font-normal leading-relaxed text-[#6B665E]">
                {EMERGENCY_CONFIG.subtitle}
              </p>
            </div>
          </div>
          <a
            href={EMERGENCY_CONFIG.phoneUrl}
            className="inline-flex min-h-[38px] items-center justify-center self-start sm:self-auto shrink-0 rounded-[8px] bg-[#E24B4A] px-4 text-[13px] font-medium text-white transition-opacity duration-150 hover:opacity-90 focus-visible:outline-2 focus-visible:outline-[#E24B4A] focus-visible:outline-offset-2"
          >
            {EMERGENCY_CONFIG.buttonText}
          </a>
        </section>

        {/* 2. Trip card */}
        <section
          aria-label="Trip planner"
          className="mt-4 rounded-[12px] border border-[#E6E1D8] bg-white p-4 sm:p-5"
        >
          <p className="text-[12px] font-normal tracking-[0.04em] text-[#9A948A]">
            {TRIP_CARD_CONFIG.eyebrow}
          </p>
          <div className="mt-1.5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="min-w-0">
              <h1 className="font-display text-[22px] sm:text-[24px] font-normal leading-tight text-[#1C1B19]">
                {TRIP_CARD_CONFIG.headline}
              </h1>
              <p className="mt-1 text-[14px] font-normal text-[#6B665E]">
                {TRIP_CARD_CONFIG.subtitle}
              </p>
            </div>
            <Link
              to={TRIP_CARD_CONFIG.buttonHref}
              className="inline-flex min-h-[40px] items-center justify-center self-start sm:self-auto shrink-0 rounded-[8px] bg-[#1C1B19] px-4 text-[13px] font-medium text-[#FAF7F2] transition-opacity duration-150 hover:opacity-90 focus-visible:outline-2 focus-visible:outline-[#1C1B19] focus-visible:outline-offset-2"
            >
              {TRIP_CARD_CONFIG.buttonText}
            </Link>
          </div>

          <div className="mt-4 border-t border-[#E6E1D8] pt-3.5 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[13px] font-normal text-[#6B665E]">
            <span className="inline-flex items-center gap-1.5">
              <Sun className="size-4 text-[#0F6E56] shrink-0" aria-hidden="true" />
              <span>{WEATHER_CONFIG.today}</span>
            </span>
            <span>•</span>
            <span>{WEATHER_CONFIG.tomorrow}</span>
            <Link
              to={WEATHER_CONFIG.forecastHref}
              className="inline-flex items-center gap-0.5 font-medium text-[#0F6E56] hover:underline focus-visible:outline-2 focus-visible:outline-[#0F6E56]"
            >
              Full forecast
              <ArrowUpRight className="size-3.5" aria-hidden="true" />
            </Link>
          </div>
        </section>

        {/* 3. Section header row */}
        <div className="mt-6 flex items-baseline justify-between gap-3">
          <h2 className="font-display text-[20px] font-normal text-[#1C1B19]">
            Somewhere worth a detour
          </h2>
          <Link
            to="/explore"
            className="inline-flex items-center gap-0.5 text-[14px] font-medium text-[#0F6E56] hover:underline focus-visible:outline-2 focus-visible:outline-[#0F6E56]"
          >
            Explore all
            <ArrowUpRight className="size-3.5" aria-hidden="true" />
          </Link>
        </div>

        {/* 4. Destination list (3 items) */}
        <section aria-label="Recommended destinations" className="mt-1">
          {DESTINATIONS_CONFIG.map((item) => (
            <Link
              key={item.id}
              to={item.href}
              className="group grid grid-cols-[56px_1fr_20px] items-center border-b border-[#E6E1D8] py-3.5 px-2 -mx-2 rounded-[8px] transition-colors duration-150 hover:bg-[#F3EFE8] focus-visible:outline-2 focus-visible:outline-[#0F6E56] focus-visible:outline-offset-1"
            >
              <span className="font-display text-[30px] italic leading-none text-[#9A948A] select-none">
                {item.number}
              </span>
              <div className="min-w-0 pr-2">
                <p className="text-[11px] font-normal tracking-[0.06em] text-[#9A948A]">
                  {item.eyebrow}
                </p>
                <h3 className="mt-0.5 font-display text-[20px] font-normal leading-snug text-[#1C1B19] group-hover:text-[#0F6E56] transition-colors duration-150">
                  {item.title}
                </h3>
              </div>
              <ArrowUpRight
                className="size-5 text-[#0F6E56] transition-transform duration-150 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 motion-reduce:transform-none"
                aria-hidden="true"
              />
            </Link>
          ))}
        </section>

        {/* 5. "Travel with peace of mind" safety section */}
        <section aria-labelledby="safety-heading" className="mt-6">
          <p
            id="safety-heading"
            className="text-[12px] font-normal tracking-[0.04em] text-[#9A948A]"
          >
            Travel with peace of mind
          </p>
          <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-3">
            {SAFETY_CARDS_CONFIG.map((card) => {
              const Icon = card.icon;
              return (
                <div
                  key={card.id}
                  className="flex flex-col justify-between rounded-[8px] bg-[#F3EFE8] p-3.5 transition-colors duration-150"
                >
                  <div>
                    <Icon className="size-5 text-[#0F6E56]" aria-hidden="true" />
                    <h3 className="mt-2 text-[15px] font-medium leading-snug text-[#1C1B19]">
                      {card.title}
                    </h3>
                    <p className="mt-1 text-[13px] font-normal leading-relaxed text-[#6B665E]">
                      {card.description}
                    </p>
                  </div>
                  <Link
                    to={card.href}
                    className="mt-3 inline-flex items-center gap-1 text-[13px] font-medium text-[#0F6E56] hover:underline focus-visible:outline-2 focus-visible:outline-[#0F6E56]"
                  >
                    <span>{card.linkLabel}</span>
                    <ArrowUpRight className="size-3.5" aria-hidden="true" />
                  </Link>
                </div>
              );
            })}
          </div>
        </section>

        {/* 6. Footer link */}
        <div className="mt-6 pt-2">
          <Link
            to={FOOTER_CONFIG.href}
            className="inline-flex items-center gap-1.5 text-[14px] font-medium text-[#0F6E56] hover:underline focus-visible:outline-2 focus-visible:outline-[#0F6E56]"
          >
            <span>{FOOTER_CONFIG.label}</span>
          </Link>
        </div>
      </main>
    </div>
  );
}

