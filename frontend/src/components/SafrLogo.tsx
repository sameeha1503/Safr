import React from "react";

interface SafrLogoProps {
  size?: number;
  className?: string;
  variant?: "image" | "vector";
  showText?: boolean;
}

export function SafrLogo({
  size = 40,
  className = "",
  variant = "image",
  showText = false,
}: SafrLogoProps) {
  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      {variant === "image" ? (
        <div
          className="relative shrink-0 overflow-hidden rounded-2xl shadow-sm shadow-black/10 transition-all duration-300 group-hover:scale-105 group-hover:shadow-md"
          style={{ width: size, height: size }}
        >
          <img
            src="/safr-logo.png"
            alt="Safr - Goa Tourism & Travel Guide"
            width={size}
            height={size}
            className="h-full w-full object-cover select-none"
            loading="eager"
            decoding="async"
          />
        </div>
      ) : (
        <div
          className="relative shrink-0 overflow-hidden rounded-2xl shadow-sm shadow-black/10 transition-transform duration-300 group-hover:scale-105"
          style={{ width: size, height: size }}
        >
          <svg
            viewBox="0 0 48 48"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className="h-full w-full"
          >
            <defs>
              <linearGradient
                id="tourism-sky"
                x1="0%"
                y1="0%"
                x2="100%"
                y2="100%"
              >
                <stop offset="0%" stopColor="#06B6D4" />
                <stop offset="55%" stopColor="#14B8A6" />
                <stop offset="100%" stopColor="#FB7185" />
              </linearGradient>

              <linearGradient
                id="tourism-sun"
                x1="0%"
                y1="0%"
                x2="0%"
                y2="100%"
              >
                <stop offset="0%" stopColor="#FEF08A" />
                <stop offset="100%" stopColor="#F59E0B" />
              </linearGradient>

              <linearGradient
                id="tourism-wave1"
                x1="0%"
                y1="0%"
                x2="100%"
                y2="0%"
              >
                <stop offset="0%" stopColor="#BAE6FD" />
                <stop offset="100%" stopColor="#38BDF8" />
              </linearGradient>

              <linearGradient
                id="tourism-wave2"
                x1="0%"
                y1="0%"
                x2="100%"
                y2="0%"
              >
                <stop offset="0%" stopColor="#38BDF8" />
                <stop offset="100%" stopColor="#0284C7" />
              </linearGradient>
            </defs>

            {/* Squircle Sky Background */}
            <rect
              x="0"
              y="0"
              width="48"
              height="48"
              rx="13"
              fill="url(#tourism-sky)"
            />

            {/* Golden Setting Sun */}
            <circle cx="19" cy="27" r="7.5" fill="url(#tourism-sun)" />

            {/* Sandy Beach Crescent */}
            <path
              d="M 14 36 C 20 37 28 36 37 31 C 37 38 31 43 24 43 C 18 43 14 40 14 36 Z"
              fill="#FDE68A"
            />

            {/* Ocean Waves */}
            <path
              d="M 8 28 C 16 28 20 33 29 29 C 34 27 38 29 40 30 C 37 36 28 38 14 38 C 10 36 8 32 8 28 Z"
              fill="url(#tourism-wave1)"
            />
            <path
              d="M 10 32 C 18 33 23 35 33 31 C 36 33 38 34 39 35 C 33 39 23 40 12 39 Z"
              fill="url(#tourism-wave2)"
            />

            {/* Tropical Palm Tree Trunk */}
            <path
              d="M 33 34 C 32 28 30 21 28 16.5 C 27.3 16.5 27 17.5 27.5 21.5 C 28.5 26.5 29.5 31.5 30.5 34 Z"
              fill="#0F766E"
            />

            {/* Palm Fronds */}
            <path
              d="M 28 17 Q 35 14 37 18 Q 33 18 28 17.5"
              stroke="#0D9488"
              strokeWidth="2.2"
              strokeLinecap="round"
            />
            <path
              d="M 28 17 Q 36 19 37 24 Q 33 22 28 17.5"
              stroke="#0F766E"
              strokeWidth="2.2"
              strokeLinecap="round"
            />
            <path
              d="M 28 17 Q 24 13 21 16 Q 24 17 28 17.5"
              stroke="#0D9488"
              strokeWidth="2.2"
              strokeLinecap="round"
            />
            <path
              d="M 28 17 Q 21 17 20 22 Q 24 21 28 17.5"
              stroke="#0F766E"
              strokeWidth="2.2"
              strokeLinecap="round"
            />
            <path
              d="M 28 17 Q 33 24 32 27"
              stroke="#0F766E"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
        </div>
      )}

      {showText && (
        <div className="flex flex-col">
          <div className="flex items-center gap-1.5">
            <span className="text-xl font-extrabold tracking-tight font-display text-foreground">
              Safr
            </span>
            <span className="rounded-full bg-cyan/10 border border-cyan/30 text-cyan px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider">
              Goa
            </span>
          </div>
          <span className="text-[10px] font-semibold text-muted-foreground tracking-wider uppercase">
            Goa Travel Guide
          </span>
        </div>
      )}
    </div>
  );
}
