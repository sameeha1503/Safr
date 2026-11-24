/* Minimalist Coastal Doodle SVGs matching the home page reference aesthetic */
export function SunDoodle({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 64 64"
      fill="none"
      className={className}
      stroke="currentColor"
      aria-hidden="true"
    >
      <circle cx="32" cy="32" r="14" strokeWidth="2.8" strokeLinecap="round" />
      <line x1="32" y1="6" x2="32" y2="12" strokeWidth="3" strokeLinecap="round" />
      <line x1="32" y1="52" x2="32" y2="58" strokeWidth="3" strokeLinecap="round" />
      <line x1="6" y1="32" x2="12" y2="32" strokeWidth="3" strokeLinecap="round" />
      <line x1="52" y1="32" x2="58" y2="32" strokeWidth="3" strokeLinecap="round" />
      <line x1="13.5" y1="13.5" x2="18" y2="18" strokeWidth="3" strokeLinecap="round" />
      <line x1="46" y1="46" x2="50.5" y2="50.5" strokeWidth="3" strokeLinecap="round" />
      <line x1="13.5" y1="50.5" x2="18" y2="46" strokeWidth="3" strokeLinecap="round" />
      <line x1="46" y1="18" x2="50.5" y2="13.5" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

export function UmbrellaDoodle({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 64 64"
      fill="none"
      className={className}
      stroke="currentColor"
      aria-hidden="true"
    >
      <line x1="32" y1="9" x2="32" y2="6" strokeWidth="2.8" strokeLinecap="round" />
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

export function PalmTreeDoodle({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 64 64"
      fill="none"
      className={className}
      stroke="currentColor"
      aria-hidden="true"
    >
      <path d="M32 58 C31 46 29 36 26 26" strokeWidth="3.2" strokeLinecap="round" />
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

export function WavesDoodle({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 64 64"
      fill="none"
      className={className}
      stroke="currentColor"
      aria-hidden="true"
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

export function ShellDoodle({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 64 64"
      fill="none"
      className={className}
      stroke="currentColor"
      aria-hidden="true"
    >
      <path
        d="M32 32 C32 28 28 26 25 28 C21 31 22 37 26 40 C32 44 40 40 42 33 C44 24 36 16 27 17 C16 18 10 29 12 40 C14 52 28 58 41 55 C53 52 59 38 56 25 C53 11 38 4 23 7"
        strokeWidth="2.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

/**
 * Full-page Ambient Pastel Aurora Mesh and Coastal Doodles Atmosphere
 * matching the signature home page aesthetic.
 */
export function CoastalAtmosphere() {
  return (
    <div className="no-print pointer-events-none fixed inset-0 overflow-hidden z-0">
      {/* Ambient Pastel Aurora Mesh Lighting Layers */}
      <div className="absolute -top-24 -left-20 h-[580px] w-[580px] rounded-full bg-[radial-gradient(circle_at_center,rgba(254,243,199,0.75)_0%,rgba(254,215,170,0.35)_45%,transparent_70%)] blur-[95px] animate-aurora-1" />
      <div className="absolute top-1/4 -left-28 h-[640px] w-[640px] rounded-full bg-[radial-gradient(circle_at_center,rgba(209,250,229,0.75)_0%,rgba(167,243,208,0.35)_45%,transparent_70%)] blur-[105px] animate-aurora-2" />
      <div className="absolute -top-20 right-0 h-[660px] w-[660px] rounded-full bg-[radial-gradient(circle_at_center,rgba(255,228,230,0.85)_0%,rgba(254,205,211,0.35)_45%,transparent_70%)] blur-[110px] animate-aurora-1" />
      <div className="absolute bottom-1/3 -right-24 h-[560px] w-[560px] rounded-full bg-[radial-gradient(circle_at_center,rgba(224,231,255,0.6)_0%,rgba(207,250,254,0.35)_45%,transparent_70%)] blur-[100px] animate-aurora-2" />
      <div className="absolute -bottom-32 left-1/3 h-[520px] w-[520px] rounded-full bg-[radial-gradient(circle_at_center,rgba(254,243,199,0.55)_0%,rgba(209,250,229,0.3)_45%,transparent_70%)] blur-[90px]" />

      {/* Floating Animated Coast Doodles in the margins */}
      <div
        className="absolute top-16 left-[4%] text-[#f6c08b] animate-doodle-sun doodle-interactive hidden xl:block"
        title="Sunny Goa"
      >
        <SunDoodle className="size-16" />
      </div>

      <div
        className="absolute top-28 left-[16%] text-[#a5c8e4] animate-doodle-umbrella doodle-interactive hidden 2xl:block"
        title="Beach Parasol"
      >
        <UmbrellaDoodle className="size-12" />
      </div>

      <div
        className="absolute top-24 right-[7%] text-[#c4b5fd] animate-doodle-wave doodle-interactive hidden xl:block"
        title="Ocean Swells"
      >
        <WavesDoodle className="w-16 h-12" />
      </div>

      <div
        className="absolute top-1/2 right-[4%] text-[#fca5a5] animate-doodle-shell doodle-interactive hidden 2xl:block"
        title="Goan Seashell"
      >
        <ShellDoodle className="size-12" />
      </div>

      <div
        className="absolute bottom-24 left-[3%] text-[#9cd7b9] animate-doodle-palm doodle-interactive hidden xl:block"
        title="Coastal Palms"
      >
        <PalmTreeDoodle className="size-20" />
      </div>

      <div
        className="absolute bottom-24 right-[5%] text-[#99d5c9] animate-doodle-palm doodle-interactive hidden xl:block"
        title="Palm Shadows"
      >
        <PalmTreeDoodle className="size-20 scale-x-[-1]" />
      </div>
    </div>
  );
}
