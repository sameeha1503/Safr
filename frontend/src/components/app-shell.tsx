import { GuardianSafetyStatus } from "@/components/sos/GuardianSafetyStatus";
import {
  Link,
  useNavigate,
  useRouter,
  useLocation,
} from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import {
  ChevronLeft,
  LogOut,
  Phone,
  LayoutDashboard,
  Compass,
  Sparkles,
  CalendarDays,
  QrCode,
  LocateFixed,
  MapPin,
  Waves,
} from "lucide-react";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { GoogleTranslate } from "@/components/GoogleTranslate";
import { SafrLogo } from "@/components/SafrLogo";
import { CoastalAtmosphere } from "@/components/CoastalDoodles";

const NAV_ITEMS = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/map", label: "Map", icon: Compass },
  { to: "/explore", label: "Explore", icon: Sparkles },
  { to: "/itinerary", label: "Itinerary", icon: CalendarDays },
  { to: "/live-tracking", label: "Find People", icon: LocateFixed },
  { to: "/safety-tags", label: "SafeTags", icon: QrCode },
] as const;

export function AppShell({
  title,
  subtitle,
  back,
  publicPage = false,
  wide = false,
  children,
}: {
  title: string;
  subtitle?: string;
  back?: boolean;
  publicPage?: boolean;
  wide?: boolean;
  children: ReactNode;
}) {
  const navigate = useNavigate();
  const router = useRouter();
  const location = useLocation();
  const queryClient = useQueryClient();

  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/", replace: true });
  }

  const currentPath = location.pathname;

  return (
    <div className="min-h-screen bg-background selection:bg-orange-500/20 relative overflow-x-hidden pb-28 text-foreground">
      {/* Signature Coastal Atmosphere: Pastel Aurora Mesh & Coast Doodles */}
      <CoastalAtmosphere />

      {!publicPage && (
        <div className="no-print relative z-30">
          <GuardianSafetyStatus />
        </div>
      )}
      {/* Floating Top Glass Header */}
      <header className="no-print sticky top-0 z-40 border-b border-orange-100/60 bg-[#fffdfa]/80 backdrop-blur-2xl shadow-[0_1px_12px_rgba(0,0,0,0.02)] transition-all">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3.5 sm:px-6">
          <div className="flex items-center gap-3 min-w-0">
            {back ? (
              <button
                onClick={() => router.history.back()}
                aria-label="Go back"
                className="group flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-stone-200/70 bg-white/80 shadow-sm transition-all hover:scale-105 hover:bg-orange-50 hover:border-orange-300 active:scale-95"
              >
                <ChevronLeft className="size-5 text-stone-600 group-hover:text-stone-900 transition-colors" />
              </button>
            ) : (
              <Link
                to="/dashboard"
                className="group shrink-0 transition-transform hover:scale-105 active:scale-95 flex items-center gap-2"
                title="Safr Dashboard"
              >
                <SafrLogo size={40} />
                <span className="hidden sm:inline font-display font-black text-xl text-stone-900">
                  Safr
                </span>
                <span className="ml-0.5 rounded-full bg-orange-100/80 text-orange-800 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider border border-orange-200/50">
                  Goa
                </span>
              </Link>
            )}

            <div className="min-w-0">
              <h1 className="truncate text-lg sm:text-xl font-extrabold font-display tracking-tight text-foreground">
                {title}
              </h1>
              {subtitle && (
                <p className="truncate text-xs font-medium text-muted-foreground">
                  {subtitle}
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <div className="hidden md:block">
              <GoogleTranslate />
            </div>

            <Button
              asChild
              size="icon"
              variant="ghost"
              className="rounded-2xl bg-destructive/10 text-destructive hover:bg-destructive/20 transition-all hover:scale-105"
              aria-label="Emergency 112 directory"
              title="Goa Emergency 112 Directory"
            >
              <Link to="/emergency">
                <Phone className="size-4" />
              </Link>
            </Button>

            {!publicPage && (
              <Button
                size="icon"
                variant="ghost"
                className="rounded-2xl text-muted-foreground hover:text-foreground hover:bg-secondary/60 transition-all hover:scale-105"
                aria-label="Sign out"
                title="Sign out of Safr"
                onClick={signOut}
              >
                <LogOut className="size-4" />
              </Button>
            )}
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main
        className={`relative z-10 mx-auto ${wide ? "max-w-[1600px]" : "max-w-4xl"} px-4 py-6 sm:px-6`}
      >
        {children}
      </main>

      {/* Floating Bottom Navigation Dock (Mobile-First) */}
      <nav className="no-print fixed bottom-4 left-1/2 -translate-x-1/2 z-50 w-[95%] max-w-lg">
        <div className="flex items-center justify-around rounded-3xl border border-orange-200/60 bg-[#fffdfa]/85 p-1.5 sm:p-2 shadow-2xl backdrop-blur-2xl">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive =
              currentPath === item.to ||
              (item.to !== "/dashboard" && currentPath.startsWith(item.to));
            return (
              <Link
                key={item.to}
                to={item.to}
                className={`group relative flex flex-col items-center gap-1 rounded-2xl px-2 py-1.5 sm:px-3 sm:py-2 text-xs font-bold transition-all ${
                  isActive
                    ? "btn-warm-gradient text-white shadow-md shadow-orange-500/30 scale-105"
                    : "text-stone-600 hover:text-stone-900 hover:bg-orange-50/70"
                }`}
              >
                <Icon
                  className={`size-4 transition-transform group-hover:scale-110 ${isActive ? "text-white" : ""}`}
                />
                <span className="text-[10px] tracking-tight whitespace-nowrap">
                  {item.label}
                </span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
