import { useMutation, useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  CheckCircle,
  ExternalLink,
  MapPin,
  Phone,
  ShieldAlert,
  Clock,
} from "lucide-react";
import { useEffect } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

type ScanAlertRow = {
  id: string;
  safety_tag_id: string;
  finder_note: string | null;
  finder_contact: string | null;
  lat: number | null;
  lng: number | null;
  delivery_status: Record<string, { status?: string; error?: string }> | null;
  is_resolved: boolean;
  scanned_at: string;
  safety_tags?: {
    id: string;
    person_name: string;
    token: string;
  } | null;
};

export function SafeTagAlertBanner() {
  const { data: alerts = [], refetch } = useQuery({
    queryKey: ["active-safetag-alerts"],
    queryFn: async () => {
      // First get user's safety tags
      const { data: tags, error: tagsErr } = await supabase
        .from("safety_tags")
        .select("id, person_name, token");
      if (tagsErr || !tags || tags.length === 0) return [];

      const tagMap = new Map(tags.map((t) => [t.id, t]));
      const tagIds = tags.map((t) => t.id);

      const { data: scans, error: scansErr } = await supabase
        .from("safety_tag_scans")
        .select("*")
        .in("safety_tag_id", tagIds)
        .eq("is_resolved", false)
        .order("scanned_at", { ascending: false });

      if (scansErr) throw scansErr;

      return (scans ?? []).map((s) => ({
        ...s,
        delivery_status: s.delivery_status as Record<
          string,
          { status?: string; error?: string }
        > | null,
        safety_tags: tagMap.get(s.safety_tag_id) || null,
      })) as ScanAlertRow[];
    },
    refetchInterval: 5000,
  });

  useEffect(() => {
    const channel = supabase
      .channel("safetag-scans-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "safety_tag_scans" },
        () => {
          refetch();
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [refetch]);

  const resolveMutation = useMutation({
    mutationFn: async (scanId: string) => {
      const { error } = await supabase
        .from("safety_tag_scans")
        .update({ is_resolved: true, resolved_at: new Date().toISOString() })
        .eq("id", scanId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Alert marked as resolved.");
      refetch();
    },
    onError: (e) =>
      toast.error(e instanceof Error ? e.message : "Failed to resolve alert"),
  });

  if (alerts.length === 0) return null;

  return (
    <div className="space-y-4 mb-6 animate-in slide-in-from-top duration-300">
      {alerts.map((alert) => {
        const childName = alert.safety_tags?.person_name || "Family Member";
        const code = alert.safety_tags?.token || "TAG";
        const hasCoords = alert.lat != null && alert.lng != null;
        const mapsUrl = hasCoords
          ? `https://www.google.com/maps?q=${alert.lat},${alert.lng}`
          : null;

        const timeFormatted = new Date(alert.scanned_at).toLocaleString(
          "en-IN",
          {
            timeZone: "Asia/Kolkata",
            day: "numeric",
            month: "short",
            hour: "2-digit",
            minute: "2-digit",
            hour12: true,
          },
        );

        return (
          <div
            key={alert.id}
            className="relative overflow-hidden rounded-3xl border-2 border-destructive/80 bg-destructive/10 backdrop-blur-2xl p-6 shadow-xl"
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-destructive/20 pb-4">
              <div className="flex items-center gap-3">
                <div className="size-10 rounded-2xl bg-destructive text-destructive-foreground flex items-center justify-center shrink-0 animate-pulse">
                  <ShieldAlert className="size-6" />
                </div>
                <div>
                  <span className="inline-flex items-center gap-1 rounded-full bg-destructive text-destructive-foreground px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider">
                    <AlertTriangle className="size-3" /> URGENT FINDER ALERT
                  </span>
                  <h3 className="text-xl font-bold font-display text-foreground mt-0.5">
                    {childName} (Tag: {code}) Has Been Found!
                  </h3>
                </div>
              </div>

              <Button
                onClick={() => resolveMutation.mutate(alert.id)}
                disabled={resolveMutation.isPending}
                className="rounded-full bg-emerald hover:bg-emerald/90 text-white font-bold text-xs px-5 py-2 shrink-0 shadow-md transition-all"
              >
                <CheckCircle className="size-4 mr-1.5" /> Mark as resolved
              </Button>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2 text-xs sm:text-sm">
              <div className="space-y-1">
                <span className="font-bold text-muted-foreground flex items-center gap-1">
                  <MapPin className="size-3.5 text-destructive" /> Location
                  Reported:
                </span>
                <p className="font-semibold text-foreground bg-background/60 p-2.5 rounded-xl border border-border/40">
                  {alert.finder_note || "No location text provided by finder"}
                </p>
              </div>

              <div className="space-y-1">
                <span className="font-bold text-muted-foreground flex items-center gap-1">
                  <Phone className="size-3.5 text-primary" /> Finder Contact:
                </span>
                <p className="font-semibold text-foreground bg-background/60 p-2.5 rounded-xl border border-border/40">
                  {alert.finder_contact || "No contact info provided"}
                </p>
              </div>
            </div>

            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs pt-2 border-t border-destructive/15 text-muted-foreground">
              <div className="flex items-center gap-3">
                <span className="flex items-center gap-1 font-medium">
                  <Clock className="size-3.5" /> {timeFormatted} IST
                </span>
                {mapsUrl && (
                  <a
                    href={mapsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 font-bold text-primary hover:underline bg-primary/10 px-2.5 py-1 rounded-full border border-primary/20"
                  >
                    <ExternalLink className="size-3" /> View on Google Maps
                  </a>
                )}
              </div>

              {alert.delivery_status && (
                <div className="flex items-center gap-2 text-[11px] font-bold">
                  {alert.delivery_status["whatsapp"] && (
                    <span className="rounded-md bg-emerald/10 text-emerald px-2 py-0.5 border border-emerald/20">
                      WhatsApp: {alert.delivery_status["whatsapp"].status}
                    </span>
                  )}
                  {alert.delivery_status["sms"] && (
                    <span className="rounded-md bg-cyan/10 text-cyan px-2 py-0.5 border border-cyan/20">
                      SMS: {alert.delivery_status["sms"].status}
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
