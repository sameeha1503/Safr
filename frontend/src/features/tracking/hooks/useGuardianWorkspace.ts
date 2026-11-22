import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { getTrackingWorkspace } from "@/lib/location-sharing.functions";
import { trackingFailureKind } from "@/lib/tracking-errors";
import {
  sampleSchema,
  mergeTrackingSnapshot,
  applyLiveMember,
  type GuardianState,
} from "@/lib/companion-tracking";
export const trackingKey = ["tracking-workspace"];
const liveMember = z.object({
  id: z.string().uuid(),
  revision: z.string().length(64),
  name: z.string().max(100),
  status: z.literal("accepted"),
  paused: z.literal(false),
  sample: sampleSchema,
});
export function useGuardianWorkspace(listen = false) {
  const load = useServerFn(getTrackingWorkspace),
    client = useQueryClient();
  const query = useQuery({
    queryKey: trackingKey,
    queryFn: async () => {
      const state = await load({ data: {} });
      const current = client.getQueryData<GuardianState>(trackingKey);
      return mergeTrackingSnapshot(current, state);
    },
    retry: (count, error) =>
      trackingFailureKind(error) === "temporary" && count < 1,
    staleTime: 10000,
    refetchInterval: (query) =>
      query.state.error &&
      trackingFailureKind(query.state.error) !== "temporary"
        ? false
        : 30000,
    refetchOnWindowFocus: (query) =>
      !query.state.error ||
      trackingFailureKind(query.state.error) === "temporary",
  });
  const connection = useQuery({
    queryKey: ["tracking-connection"],
    queryFn: async () => "connecting",
    initialData: "connecting",
    enabled: false,
  });
  const tripId = query.data?.trip.id;
  useEffect(() => {
    if (!listen || !tripId) return;
    let disposed = false;
    client.setQueryData(["tracking-connection"], "connecting");
    const channel = supabase.channel(`trip_tracking_${tripId}`, {
      config: { private: true },
    });
    void supabase.auth
      .getSession()
      .then(({ data }) => {
        if (disposed || !data.session) return;
        return supabase.realtime.setAuth(data.session.access_token).then(() => {
          if (disposed) return;
          channel
            .on("broadcast", { event: "tracking" }, ({ payload }) => {
              if (payload?.kind === "location") {
                const parsed = liveMember.safeParse(payload.member);
                if (!parsed.success) return;
                client.setQueryData<GuardianState>(trackingKey, (old) => {
                  if (!old || old.trip.id !== tripId) return old;
                  const member = parsed.data,
                    index = old.members.findIndex(
                      (item) => item.id === member.id,
                    );
                  if (index < 0) {
                    void client.invalidateQueries({ queryKey: trackingKey });
                    return old;
                  }
                  return applyLiveMember(old, member);
                });
              } else void client.invalidateQueries({ queryKey: trackingKey });
            })
            .subscribe((status) => {
              client.setQueryData(
                ["tracking-connection"],
                status === "SUBSCRIBED" ? "live" : "delayed",
              );
              if (status === "SUBSCRIBED")
                void client.invalidateQueries({ queryKey: trackingKey });
            });
        });
      })
      .catch(() => {
        client.setQueryData(["tracking-connection"], "delayed");
      });
    return () => {
      disposed = true;
      void supabase.removeChannel(channel);
    };
  }, [listen, tripId, client]);
  return { ...query, connection: connection.data };
}
