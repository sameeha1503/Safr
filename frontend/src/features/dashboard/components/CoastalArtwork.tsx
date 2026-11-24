/** Decorative coastline illustration, not geographic or routing data. */
export function CoastalArtwork({
  preserveAspectRatio = "none",
  className = "pointer-events-none absolute inset-0 -z-10 h-full w-full opacity-70",
}: {
  preserveAspectRatio?: string;
  className?: string;
} = {}) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 600 440"
      preserveAspectRatio={preserveAspectRatio}
      className={className}
    >
      <defs>
        <pattern
          id="dashboard-sea-lines"
          width="36"
          height="36"
          patternUnits="userSpaceOnUse"
        >
          <path
            d="M0 18 Q9 12 18 18 T36 18"
            fill="none"
            stroke="#b5c9ba"
            strokeOpacity=".12"
            strokeWidth="1"
          />
        </pattern>
      </defs>
      <rect width="600" height="440" fill="url(#dashboard-sea-lines)" />
      <path
        d="M470 -40 C365 60 500 110 390 200 S440 320 340 480 L650 480 V-40Z"
        fill="#d8ca9f"
      />
      <path
        d="M495 -40 C390 60 525 110 415 200 S465 320 365 480 L650 480 V-40Z"
        fill="#a9b29a"
      />
      <path
        d="M540 -40 C435 60 570 110 460 200 S510 320 410 480"
        fill="none"
        stroke="#f8efda"
        strokeWidth="2"
        strokeDasharray="5 8"
      />
      <path
        d="M444 -40 C339 60 474 110 364 200 S414 320 314 480"
        fill="none"
        stroke="#8cb2a6"
        strokeOpacity=".45"
      />
      <circle cx="477" cy="126" r="15" fill="#123f3b" />
      <circle cx="477" cy="126" r="5" fill="#fff9eb" />
      <circle
        cx="465"
        cy="315"
        r="9"
        fill="#bc633e"
        stroke="#fff9eb"
        strokeWidth="3"
      />
      <path d="m545 45 0 30m-15-15h30" stroke="#123f3b" strokeWidth="1" />
      <circle
        cx="545"
        cy="60"
        r="23"
        fill="none"
        stroke="#123f3b"
        strokeOpacity=".4"
      />
    </svg>
  );
}
