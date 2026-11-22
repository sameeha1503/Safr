import {
  EMERGENCY_CONTACTS,
  EMERGENCY_SOURCES,
  EMERGENCY_LAST_VERIFIED,
} from "@/lib/emergency-contacts";
import { createFileRoute } from "@tanstack/react-router";
import {
  Phone,
  ShieldAlert,
  ShieldCheck,
  Siren,
  HeartPulse,
  Waves,
  ArrowUpRight,
  Search,
  MapPin,
  Share2,
  Map,
} from "lucide-react";
import { useState, useEffect } from "react";
import { AppShell } from "@/components/app-shell";

export const Route = createFileRoute("/emergency")({
  component: Emergency,
});

const categoryOrder = [
  "Emergency",
  "Police",
  "Medical",
  "Coastal",
  "Travel",
  "Support",
];

function getCategoryIcon(cat: string) {
  switch (cat.toLowerCase()) {
    case "emergency":
      return <Siren className="size-4 text-destructive" />;
    case "medical":
      return <HeartPulse className="size-4 text-coral" />;
    case "coastal":
      return <Waves className="size-4 text-cyan" />;
    case "police":
      return <ShieldCheck className="size-4 text-primary" />;
    default:
      return <Phone className="size-4 text-muted-foreground" />;
  }
}

function formatDate(isoString: string) {
  return new Date(isoString).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function Emergency() {
  const [searchTerm, setSearchTerm] = useState("");
  const [locationStatus, setLocationStatus] = useState<
    "idle" | "loading" | "success" | "error"
  >("idle");
  const [locationCoords, setLocationCoords] = useState<{
    lat: number;
    lng: number;
  } | null>(null);
  const [locationError, setLocationError] = useState("");
  const [copied, setCopied] = useState(false);
  const [isOffline, setIsOffline] = useState(false);

  useEffect(() => {
    if (typeof navigator !== "undefined") {
      setIsOffline(!navigator.onLine);
    }

    if ("serviceWorker" in navigator && import.meta.env.PROD) {
      navigator.serviceWorker.register("/sw.js").catch(console.error);
    }

    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  const data = EMERGENCY_CONTACTS.filter((c) => c.verified === true).filter(
    (c) => {
      const term = searchTerm.toLowerCase();
      return (
        c.name.toLowerCase().includes(term) ||
        (c.note && c.note.toLowerCase().includes(term)) ||
        c.phone.includes(term)
      );
    },
  );

  const grouped = data.reduce<Record<string, typeof data>>((acc, c) => {
    (acc[c.category] ??= []).push(c);
    return acc;
  }, {});

  const rank = (c: string) => {
    const i = categoryOrder.indexOf(c);
    return i === -1 ? categoryOrder.length : i;
  };
  const categories = Object.keys(grouped).sort((a, b) => rank(a) - rank(b));

  const handleShareLocation = () => {
    setLocationStatus("loading");
    if (!navigator.geolocation) {
      setLocationStatus("error");
      setLocationError("Geolocation is not supported by your browser.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocationStatus("success");
        setLocationCoords({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        });
      },
      (err) => {
        setLocationStatus("error");
        setLocationError(err.message || "Could not fetch location.");
      },
      { timeout: 10000, enableHighAccuracy: true },
    );
  };

  const getShareText = () => {
    if (!locationCoords) return "";
    return `I need help. My location: https://www.google.com/maps?q=${locationCoords.lat},${locationCoords.lng}`;
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(getShareText());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <AppShell
      publicPage
      title="Goa Emergency 112 Hub"
      subtitle="Official state helplines & instant direct dial"
      back
    >
      {isOffline && (
        <div className="mb-4 rounded-xl bg-amber-500/10 border border-amber-500/20 p-3 text-sm text-amber-600 font-medium text-center">
          You are offline. Showing saved numbers.
        </div>
      )}

      {/* Prime 112 Notice Card */}
      <div className="rounded-3xl border border-destructive/30 bg-card/85 backdrop-blur-2xl p-6 sm:p-7 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="size-11 rounded-2xl bg-destructive/10 text-destructive flex items-center justify-center shrink-0">
            <ShieldAlert className="size-6" />
          </div>
          <div>
            <h2 className="text-lg font-bold font-display text-foreground">
              Dial 112 For Immediate Emergency
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
              112 is India's single national emergency hotline — direct dispatch
              to Goa Police, Fire, and 108 Ambulances.
            </p>
          </div>
        </div>

        <a
          href="tel:112"
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-full bg-destructive py-3.5 text-sm font-bold text-destructive-foreground shadow-md transition-transform hover:scale-[1.01] active:scale-95"
        >
          <Phone className="size-4" /> Call 112 National Emergency
        </a>
      </div>

      <p className="mt-2 text-[10px] text-center text-muted-foreground">
        If a short code does not connect from a foreign SIM, dial 112.
      </p>

      {/* Share Location Card */}
      <div className="mt-6 rounded-3xl border border-primary/20 bg-primary/5 p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="size-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
            <MapPin className="size-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-foreground">
              Share my location
            </h3>
            <p className="text-xs text-muted-foreground">
              Quickly send your GPS coords via WhatsApp or SMS
            </p>
          </div>
        </div>

        {locationStatus === "idle" && (
          <button
            onClick={handleShareLocation}
            className="w-full flex items-center justify-center gap-2 rounded-full bg-primary py-3 text-sm font-bold text-primary-foreground shadow-sm transition-transform hover:scale-[1.01] active:scale-95"
          >
            <Share2 className="size-4" /> Get Location
          </button>
        )}

        {locationStatus === "loading" && (
          <div className="text-sm text-center text-muted-foreground py-2 animate-pulse">
            Fetching location... (may take up to 10s)
          </div>
        )}

        {locationStatus === "error" && (
          <div className="text-sm text-center text-destructive py-2">
            {locationError} <br />
            <span className="text-xs mt-1 block">
              Please dial 112 and describe your surroundings.
            </span>
          </div>
        )}

        {locationStatus === "success" && locationCoords && (
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
              <a
                href={`https://wa.me/?text=${encodeURIComponent(getShareText())}`}
                target="_blank"
                rel="noreferrer"
                className="flex-1 flex items-center justify-center gap-2 rounded-full bg-emerald-600 py-2.5 text-xs font-bold text-white transition-transform hover:scale-[1.01] active:scale-95 min-w-[120px]"
              >
                WhatsApp
              </a>
              <a
                href={`sms:?&body=${encodeURIComponent(getShareText())}`}
                className="flex-1 flex items-center justify-center gap-2 rounded-full bg-blue-600 py-2.5 text-xs font-bold text-white transition-transform hover:scale-[1.01] active:scale-95 min-w-[120px]"
              >
                SMS
              </a>
              <button
                onClick={handleCopy}
                className="flex-1 flex items-center justify-center gap-2 rounded-full bg-secondary py-2.5 text-xs font-bold text-foreground transition-transform hover:scale-[1.01] active:scale-95 min-w-[120px]"
              >
                {copied ? "Copied!" : "Copy"}
              </button>
            </div>

            <div className="pt-3 border-t border-primary/10 mt-3 grid grid-cols-2 gap-2">
              <a
                href={`https://www.google.com/maps/search/police+station/@${locationCoords.lat},${locationCoords.lng},14z`}
                target="_blank"
                rel="noreferrer"
                className="flex items-center justify-center gap-1.5 rounded-xl bg-card border border-border py-2 text-xs font-medium text-primary hover:bg-muted"
              >
                <Map className="size-3" /> Find nearest Police
              </a>
              <a
                href={`https://www.google.com/maps/search/hospital/@${locationCoords.lat},${locationCoords.lng},14z`}
                target="_blank"
                rel="noreferrer"
                className="flex items-center justify-center gap-1.5 rounded-xl bg-card border border-border py-2 text-xs font-medium text-coral hover:bg-muted"
              >
                <Map className="size-3 text-coral" /> Find nearest Hospital
              </a>
            </div>
          </div>
        )}
      </div>

      {/* Search */}
      <div className="mt-6 relative">
        <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none text-muted-foreground">
          <Search className="size-4" />
        </div>
        <input
          type="text"
          placeholder="Search contacts..."
          className="w-full rounded-2xl border border-border bg-card py-3 pl-10 pr-4 text-sm outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/50 transition-all"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      {data.length === 0 ? (
        <div className="mt-8 text-center">
          <p className="text-sm text-muted-foreground mb-4">
            No matching contacts.
          </p>
          <a
            href="tel:112"
            className="inline-flex items-center justify-center gap-2 rounded-full bg-destructive py-3 px-6 text-sm font-bold text-destructive-foreground shadow-md transition-transform hover:scale-[1.01] active:scale-95"
          >
            <Phone className="size-4" /> Call 112 instead
          </a>
        </div>
      ) : (
        /* Categorized Contact Cards */
        categories.map((cat) => (
          <section key={cat} className="mt-6">
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5 mb-2.5">
              {getCategoryIcon(cat)}
              {cat} Directory
            </h3>

            <div className="space-y-2.5">
              {(grouped[cat] ?? []).map((c) => (
                <a
                  key={c.id}
                  href={`tel:${c.phone.replace(/[^\d+]/g, "")}`}
                  className="group flex items-center justify-between gap-3 rounded-2xl border border-border/50 bg-card/75 backdrop-blur-xl p-4 shadow-sm transition-all hover:border-primary/40 hover:bg-card/95 hover:shadow-md"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-secondary/80 text-foreground group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                      <Phone className="size-4" />
                    </div>
                    <div className="min-w-0">
                      <span className="block text-sm font-bold text-foreground truncate">
                        {c.name}
                      </span>
                      {c.note && (
                        <span className="block text-xs text-muted-foreground mt-0.5 line-clamp-1">
                          {c.note}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span className="rounded-full bg-primary/10 text-primary px-3 py-1 font-mono font-bold text-xs">
                      {c.phone}
                    </span>
                    <ArrowUpRight className="size-4 text-muted-foreground group-hover:text-primary transition-colors" />
                  </div>
                </a>
              ))}
            </div>
          </section>
        ))
      )}

      <p className="mt-6 text-xs text-muted-foreground">
        Directory checked {formatDate(EMERGENCY_LAST_VERIFIED)}. Short codes are
        intended for use in India.
      </p>
      <div className="flex flex-wrap gap-3 mt-2 text-xs text-primary">
        {EMERGENCY_SOURCES.map((source) => (
          <a
            key={source.url}
            href={source.url}
            target="_blank"
            rel="noreferrer"
          >
            {source.name}
          </a>
        ))}
      </div>
    </AppShell>
  );
}
