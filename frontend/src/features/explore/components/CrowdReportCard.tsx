import { useQuery, useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { useEffect, useState } from "react";
import { getCrowd, submitCrowdReport } from "@/lib/goa.functions";
import { CROWD_LEVELS, type CrowdLevel } from "@/lib/crowd";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

export function CrowdReportCard({ placeKey }: { placeKey: string }) {
  const get = useServerFn(getCrowd);
  const submit = useServerFn(submitCrowdReport);
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(timer);
  }, []);
  const query = useQuery({
    queryKey: ["explore-crowd", placeKey],
    queryFn: () => get({ data: { placeKey } }),
    staleTime: 60000,
    refetchInterval: 300000,
    retry: false,
  });
  const mutation = useMutation({
    mutationFn: (level: CrowdLevel) => submit({ data: { placeKey, level } }),
    onSuccess: (result) => {
      if (result.ok) {
        toast.success(result.message);
        void query.refetch();
      } else toast.error(result.message);
    },
    onError: (error) =>
      toast.error(
        error instanceof Error ? error.message : "Report could not be saved",
      ),
  });
  if (query.isPending)
    return (
      <Skeleton
        className="h-36 rounded-3xl"
        aria-label="Loading crowd reports"
      />
    );
  if (query.isError || !query.data?.available)
    return (
      <section className="rounded-3xl border bg-card p-5">
        <p className="text-sm">Crowd reports are temporarily unavailable.</p>
        <Button variant="outline" onClick={() => void query.refetch()}>
          Retry reports
        </Button>
      </section>
    );
  const crowd = query.data.crowd;
  return (
    <section className="rounded-3xl border border-border bg-card p-6 space-y-3">
      <h3 className="font-bold text-lg">Visitor crowd reports</h3>
      {crowd.band ? (
        <p>
          <span className="capitalize font-semibold">{crowd.band}</span>
          <span className="block text-xs text-muted-foreground">
            {crowd.count} reports, last{" "}
            {Math.max(
              0,
              Math.floor((now - Date.parse(crowd.lastReportAt)) / 60000),
            )}{" "}
            min ago
          </span>
        </p>
      ) : (
        <p className="text-sm text-muted-foreground">No recent reports yet</p>
      )}
      <p className="text-sm">How busy is it right now?</p>
      <div className="flex flex-wrap gap-2">
        {CROWD_LEVELS.map((level) => (
          <Button
            key={level}
            variant="outline"
            size="sm"
            disabled={mutation.isPending}
            onClick={() => mutation.mutate(level)}
            className="capitalize"
          >
            {level}
          </Button>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">
        Community reports from the last 90 minutes. At least two distinct
        visitors are required. One report per place every 30 minutes.
      </p>
    </section>
  );
}
