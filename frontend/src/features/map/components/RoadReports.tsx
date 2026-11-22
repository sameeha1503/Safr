import { useEffect, useMemo, useRef, useState } from "react";
import type { Map as MapLibreMap, GeoJSONSource, MapMouseEvent } from "maplibre-gl";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getRoadReports, submitRoadReport } from "@/lib/road-reports.functions";
import type { RoadReportInput } from "@/lib/road-reports";
import {
  getRoadSafetyReviews,
  submitRoadSafetyReview,
  type RoadSafetyReviewInput,
} from "@/lib/road-safety-reviews.functions";

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export function RoadReports({
  point,
  onLocate,
  map,
}: {
  point: { lat: number; lng: number; name: string } | null;
  onLocate: (point: { lat: number; lng: number }) => void;
  map: MapLibreMap | null;
}) {
  const get = useServerFn(getRoadReports);
  const submit = useServerFn(submitRoadReport);
  const getReviews = useServerFn(getRoadSafetyReviews);
  const submitReview = useServerFn(submitRoadSafetyReview);

  const [detail, setDetail] = useState("");
  const [kind, setKind] = useState<RoadReportInput["kind"]>("obstruction");
  const [now, setNow] = useState(Date.now);

  const [showReviewForm, setShowReviewForm] = useState(false);
  const [reviewRating, setReviewRating] = useState<number>(5);
  const [reviewComment, setReviewComment] = useState("");
  const [selectedReview, setSelectedReview] = useState<{
    coords: [number, number];
    avgRating: number;
    count: number;
    comments: Array<{ rating: number; comment: string; createdAt: string }>;
  } | null>(null);

  const popupRef = useRef<import("maplibre-gl").Popup | null>(null);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(timer);
  }, []);

  const query = useQuery({
    queryKey: ["road-reports"],
    queryFn: () => get(),
    staleTime: 60_000,
    refetchInterval: 60_000,
    retry: false,
  });

  const mutation = useMutation({
    mutationFn: (data: RoadReportInput) => submit({ data }),
    onSuccess: (result) => {
      if (result.ok) {
        toast.success(result.message);
        setDetail("");
        void query.refetch();
      } else toast.error(result.message);
    },
    onError: () =>
      toast.error("Unable to submit. Check your connection and try again."),
  });

  const reviewsQuery = useQuery({
    queryKey: ["road-safety-reviews"],
    queryFn: () => getReviews(),
    staleTime: 60_000,
    refetchInterval: 60_000,
    retry: false,
  });

  const reviewMutation = useMutation({
    mutationFn: (data: RoadSafetyReviewInput) => submitReview({ data }),
    onSuccess: (result) => {
      if (result.ok) {
        toast.success(result.message);
        setReviewComment("");
        setShowReviewForm(false);
        void reviewsQuery.refetch();
      } else {
        toast.error(result.message);
      }
    },
    onError: () =>
      toast.error("Unable to submit review. Check your connection and try again."),
  });

  const reports = (query.data?.reports ?? []).filter(
    (report) => Date.parse(report.expires_at) > now,
  );

  const features = useMemo<GeoJSON.FeatureCollection<GeoJSON.Point>>(
    () => ({
      type: "FeatureCollection",
      features: (query.data?.reports ?? [])
        .filter(
          (report) =>
            report.status === "approved" && Date.parse(report.expires_at) > now,
        )
        .map((report) => ({
          type: "Feature",
          geometry: { type: "Point", coordinates: [report.lng, report.lat] },
          properties: { kind: report.kind },
        })),
    }),
    [query.data, now],
  );

  const reviewFeatures = useMemo<GeoJSON.FeatureCollection<GeoJSON.Point>>(
    () => ({
      type: "FeatureCollection",
      features: (reviewsQuery.data?.reviews ?? []).map((review) => ({
        type: "Feature",
        geometry: { type: "Point", coordinates: [review.lng, review.lat] },
        properties: {
          id: review.id,
          safety_rating: review.safety_rating,
          comment: review.comment || "",
          created_at: review.created_at,
        },
      })),
    }),
    [reviewsQuery.data],
  );

  // Sync MapLibre layers & sources for both road reports and safety reviews
  useEffect(() => {
    if (!map) return;
    const sync = () => {
      if (!map.isStyleLoaded()) return;

      // 1. Road reports source and layer
      const reportSource = map.getSource("safr-road-reports") as
        GeoJSONSource | undefined;
      if (reportSource) reportSource.setData(features);
      else
        map.addSource("safr-road-reports", { type: "geojson", data: features });
      if (!map.getLayer("safr-road-reports-pins"))
        map.addLayer({
          id: "safr-road-reports-pins",
          type: "circle",
          source: "safr-road-reports",
          paint: {
            "circle-radius": 10,
            "circle-color": "#b45309",
            "circle-stroke-width": 3,
            "circle-stroke-color": "#fff",
          },
        });

      // 2. Safety reviews source and clustered layers
      const reviewSource = map.getSource("safr-safety-reviews") as
        GeoJSONSource | undefined;
      if (reviewSource) {
        reviewSource.setData(reviewFeatures);
      } else {
        map.addSource("safr-safety-reviews", {
          type: "geojson",
          data: reviewFeatures,
          cluster: true,
          clusterRadius: 50,
          clusterMaxZoom: 14,
        });
      }

      if (!map.getLayer("safr-safety-reviews-clusters")) {
        map.addLayer({
          id: "safr-safety-reviews-clusters",
          type: "circle",
          source: "safr-safety-reviews",
          filter: ["has", "point_count"],
          paint: {
            "circle-color": "#7c3aed",
            "circle-radius": [
              "step",
              ["get", "point_count"],
              16,
              5,
              22,
              15,
              28,
            ],
            "circle-stroke-width": 2.5,
            "circle-stroke-color": "#f59e0b",
          },
        });
      }

      if (!map.getLayer("safr-safety-reviews-pins")) {
        map.addLayer({
          id: "safr-safety-reviews-pins",
          type: "circle",
          source: "safr-safety-reviews",
          filter: ["!", ["has", "point_count"]],
          paint: {
            "circle-radius": 11,
            "circle-color": "#f59e0b",
            "circle-stroke-width": 2.5,
            "circle-stroke-color": "#ffffff",
          },
        });
      }

      if (map.getStyle().glyphs) {
        if (!map.getLayer("safr-safety-reviews-cluster-label")) {
          map.addLayer({
            id: "safr-safety-reviews-cluster-label",
            type: "symbol",
            source: "safr-safety-reviews",
            filter: ["has", "point_count"],
            layout: {
              "text-field": "{point_count_abbreviated}★",
              "text-size": 11,
            },
            paint: {
              "text-color": "#ffffff",
            },
          });
        }
        if (!map.getLayer("safr-safety-reviews-pin-label")) {
          map.addLayer({
            id: "safr-safety-reviews-pin-label",
            type: "symbol",
            source: "safr-safety-reviews",
            filter: ["!", ["has", "point_count"]],
            layout: {
              "text-field": "★",
              "text-size": 12,
            },
            paint: {
              "text-color": "#ffffff",
            },
          });
        }
      }
    };

    const onClusterClick = async (event: MapMouseEvent) => {
      const clusterFeatures = map.queryRenderedFeatures(event.point, {
        layers: ["safr-safety-reviews-clusters"],
      });
      if (!clusterFeatures.length || clusterFeatures[0]?.geometry.type !== "Point") return;
      const feature = clusterFeatures[0];
      const props = feature.properties || {};
      const clusterId = Number(props["cluster_id"]);
      const source = map.getSource("safr-safety-reviews") as GeoJSONSource | undefined;
      if (!source || !Number.isFinite(clusterId)) return;

      try {
        const leaves = await source.getClusterLeaves(clusterId, 100, 0);
        if (!leaves || !leaves.length) return;
        const ratings = leaves
          .map((l: GeoJSON.Feature) => Number(l.properties?.["safety_rating"]) || 0)
          .filter((r: number) => r > 0);
        const avg = ratings.length
          ? ratings.reduce((a: number, b: number) => a + b, 0) / ratings.length
          : 0;

        const recentComments = leaves
          .filter(
            (l: GeoJSON.Feature) =>
              typeof l.properties?.["comment"] === "string" &&
              l.properties["comment"].trim().length > 0,
          )
          .sort(
            (a: GeoJSON.Feature, b: GeoJSON.Feature) =>
              Date.parse(String(b.properties?.["created_at"])) -
              Date.parse(String(a.properties?.["created_at"])),
          )
          .slice(0, 5)
          .map((l: GeoJSON.Feature) => ({
            rating: Number(l.properties?.["safety_rating"]) || 0,
            comment: String(l.properties?.["comment"]),
            createdAt: String(l.properties?.["created_at"]),
          }));

        setSelectedReview({
          coords: (feature.geometry as GeoJSON.Point).coordinates.slice() as [number, number],
          avgRating: avg,
          count: ratings.length,
          comments: recentComments,
        });
      } catch {
        /* ignore cluster fetch error */
      }
    };

    const onPinClick = (event: MapMouseEvent) => {
      const pinFeatures = map.queryRenderedFeatures(event.point, {
        layers: ["safr-safety-reviews-pins"],
      });
      if (!pinFeatures.length || pinFeatures[0]?.geometry.type !== "Point") return;
      const feature = pinFeatures[0];
      const props = feature.properties || {};
      const rating = Number(props["safety_rating"]) || 5;
      const comment = props["comment"] ? String(props["comment"]) : "";
      const createdAt = String(props["created_at"] || "");

      setSelectedReview({
        coords: (feature.geometry as GeoJSON.Point).coordinates.slice() as [number, number],
        avgRating: rating,
        count: 1,
        comments: comment ? [{ rating, comment, createdAt }] : [],
      });
    };

    const onMouseEnter = () => {
      map.getCanvas().style.cursor = "pointer";
    };
    const onMouseLeave = () => {
      map.getCanvas().style.cursor = "";
    };

    const onceReady = () => {
      if (map.isStyleLoaded()) {
        sync();
        map.off("idle", onceReady);
      }
    };
    sync();
    map.on("style.load", sync);
    if (!map.isStyleLoaded()) map.on("idle", onceReady);

    map.on("click", "safr-safety-reviews-clusters", onClusterClick);
    map.on("click", "safr-safety-reviews-pins", onPinClick);
    map.on("mouseenter", "safr-safety-reviews-clusters", onMouseEnter);
    map.on("mouseleave", "safr-safety-reviews-clusters", onMouseLeave);
    map.on("mouseenter", "safr-safety-reviews-pins", onMouseEnter);
    map.on("mouseleave", "safr-safety-reviews-pins", onMouseLeave);

    return () => {
      map.off("style.load", sync);
      map.off("idle", onceReady);
      map.off("click", "safr-safety-reviews-clusters", onClusterClick);
      map.off("click", "safr-safety-reviews-pins", onPinClick);
      map.off("mouseenter", "safr-safety-reviews-clusters", onMouseEnter);
      map.off("mouseleave", "safr-safety-reviews-clusters", onMouseLeave);
      map.off("mouseenter", "safr-safety-reviews-pins", onMouseEnter);
      map.off("mouseleave", "safr-safety-reviews-pins", onMouseLeave);

      if (map.getLayer("safr-road-reports-pins"))
        map.removeLayer("safr-road-reports-pins");
      if (map.getSource("safr-road-reports"))
        map.removeSource("safr-road-reports");

      if (map.getLayer("safr-safety-reviews-pin-label"))
        map.removeLayer("safr-safety-reviews-pin-label");
      if (map.getLayer("safr-safety-reviews-cluster-label"))
        map.removeLayer("safr-safety-reviews-cluster-label");
      if (map.getLayer("safr-safety-reviews-pins"))
        map.removeLayer("safr-safety-reviews-pins");
      if (map.getLayer("safr-safety-reviews-clusters"))
        map.removeLayer("safr-safety-reviews-clusters");
      if (map.getSource("safr-safety-reviews"))
        map.removeSource("safr-safety-reviews");
    };
  }, [map, features, reviewFeatures]);

  // Synchronize on-map popup with selectedReview
  useEffect(() => {
    if (!map) return;
    if (popupRef.current) {
      popupRef.current.remove();
      popupRef.current = null;
    }
    if (!selectedReview) return;

    void import("maplibre-gl").then((ml) => {
      if (!map) return;
      const container = document.createElement("div");
      container.className = "p-2 font-sans text-xs space-y-1.5 max-w-[240px]";

      const header = document.createElement("div");
      header.className =
        "flex items-center gap-1.5 font-bold text-amber-600 dark:text-amber-400 text-sm";
      header.innerHTML = `<span>★</span><span>${selectedReview.avgRating.toFixed(1)} / 5.0</span><span class="text-[11px] font-normal text-muted-foreground">(${selectedReview.count} review${selectedReview.count > 1 ? "s" : ""})</span>`;
      container.appendChild(header);

      const badge = document.createElement("div");
      badge.className =
        "text-[10px] font-bold uppercase tracking-wider text-purple-600 dark:text-purple-400";
      badge.textContent = "Traveler Opinion (Informational)";
      container.appendChild(badge);

      if (selectedReview.comments.length > 0) {
        const commentSection = document.createElement("div");
        commentSection.className =
          "mt-2 pt-1.5 border-t border-border/60 space-y-1 max-h-36 overflow-y-auto";
        selectedReview.comments.forEach((c) => {
          const item = document.createElement("div");
          item.className = "p-1 rounded bg-muted/40";
          item.innerHTML = `<div class="font-bold text-amber-600 text-[10px]">${"★".repeat(c.rating)}${"☆".repeat(5 - c.rating)}</div><div class="text-[11px] text-foreground/90">${escapeHtml(c.comment)}</div>`;
          commentSection.appendChild(item);
        });
        container.appendChild(commentSection);
      } else {
        const noComments = document.createElement("p");
        noComments.className = "text-[11px] text-muted-foreground italic mt-1";
        noComments.textContent = "No written comments yet.";
        container.appendChild(noComments);
      }

      popupRef.current = new ml.Popup({ closeButton: true, maxWidth: "260px" })
        .setLngLat(selectedReview.coords)
        .setDOMContent(container)
        .addTo(map);

      popupRef.current.on("close", () => {
        setSelectedReview(null);
      });
    });
  }, [map, selectedReview]);

  return (
    <details className="rounded-xl border p-3 text-sm">
      <summary className="min-h-11 cursor-pointer font-semibold">
        Community road reports & safety reviews
      </summary>
      <p className="mb-3 text-xs text-muted-foreground">
        Reviewed visitor reports (amber) and traveler road safety ratings (purple/gold star),
        not official alerts. Purely informational.
      </p>

      {/* Selected cluster or review details view */}
      {selectedReview && (
        <div className="mb-4 rounded-2xl border border-purple-300 dark:border-purple-800 bg-purple-50/70 dark:bg-purple-950/40 p-3 shadow-sm animate-in fade-in">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <span className="text-lg text-amber-500 font-bold">★</span>
              <span className="font-bold text-sm text-foreground">
                {selectedReview.avgRating.toFixed(1)} / 5.0
              </span>
              <span className="text-[11px] text-muted-foreground">
                ({selectedReview.count} review{selectedReview.count > 1 ? "s" : ""})
              </span>
            </div>
            <button
              onClick={() => setSelectedReview(null)}
              className="text-xs text-muted-foreground hover:text-foreground font-semibold px-1.5 py-0.5 rounded"
            >
              ✕
            </button>
          </div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-purple-700 dark:text-purple-300 mt-0.5">
            Traveler Opinion · Informational Only
          </p>

          <div className="mt-2.5 space-y-1.5 border-t border-purple-200 dark:border-purple-800/60 pt-2">
            <p className="text-xs font-semibold text-foreground">
              Most recent comments:
            </p>
            {selectedReview.comments.length === 0 ? (
              <p className="text-xs text-muted-foreground italic">
                No written comments for this location.
              </p>
            ) : (
              selectedReview.comments.map((c, i) => (
                <div
                  key={i}
                  className="rounded-lg bg-background/80 p-2 text-xs border border-border/50"
                >
                  <div className="flex items-center justify-between text-[10px] text-muted-foreground mb-0.5">
                    <span className="font-bold text-amber-600">
                      {"★".repeat(c.rating)}
                      {"☆".repeat(5 - c.rating)}
                    </span>
                    <span>
                      {c.createdAt
                        ? new Date(c.createdAt).toLocaleDateString()
                        : ""}
                    </span>
                  </div>
                  <p className="text-foreground/90">{c.comment}</p>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Action to leave a safety review */}
      <div className="mb-4">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="w-full gap-1.5 font-semibold text-xs border-purple-300 dark:border-purple-800 text-purple-700 dark:text-purple-300 hover:bg-purple-50 dark:hover:bg-purple-950/40"
          onClick={() => setShowReviewForm((v) => !v)}
        >
          <Star className="size-3.5 fill-amber-400 text-amber-500" />
          {showReviewForm ? "Close review form" : "Leave a safety review"}
        </Button>

        {showReviewForm && (
          <form
            className="mt-3 space-y-3 rounded-2xl border border-purple-200 dark:border-purple-900/60 bg-purple-50/40 dark:bg-purple-950/20 p-3 text-xs"
            onSubmit={(e) => {
              e.preventDefault();
              const targetCoords = point
                ? { lat: point.lat, lng: point.lng }
                : map
                  ? { lat: map.getCenter().lat, lng: map.getCenter().lng }
                  : null;
              if (!targetCoords) {
                toast.error(
                  "Unable to determine location. Pan map or select a destination pin.",
                );
                return;
              }
              reviewMutation.mutate({
                lat: Number(targetCoords.lat.toFixed(5)),
                lng: Number(targetCoords.lng.toFixed(5)),
                safety_rating: reviewRating,
                comment: reviewComment.trim() || undefined,
              });
            }}
          >
            <div>
              <span className="font-bold text-foreground">
                Review location:
              </span>{" "}
              <span className="text-muted-foreground">
                {point
                  ? `${point.name} (${point.lat.toFixed(4)}, ${point.lng.toFixed(4)})`
                  : map
                    ? `Map center (${map.getCenter().lat.toFixed(4)}, ${map.getCenter().lng.toFixed(4)})`
                    : "Select a point on the map"}
              </span>
            </div>

            <div>
              <label className="block font-semibold mb-1">
                Road Safety Rating: {reviewRating} / 5
              </label>
              <div className="flex items-center gap-1">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setReviewRating(star)}
                    className="p-1 transition-transform hover:scale-110 focus:outline-none"
                    aria-label={`${star} star${star > 1 ? "s" : ""}`}
                  >
                    <Star
                      className={`size-5 ${
                        star <= reviewRating
                          ? "fill-amber-400 text-amber-500"
                          : "text-muted-foreground/30"
                      }`}
                    />
                  </button>
                ))}
                <span className="ml-2 text-[11px] text-muted-foreground font-medium">
                  {reviewRating === 1
                    ? "Very Unsafe"
                    : reviewRating === 2
                      ? "Poor Safety"
                      : reviewRating === 3
                        ? "Average"
                        : reviewRating === 4
                          ? "Good / Safe"
                          : "Very Safe"}
                </span>
              </div>
            </div>

            <div>
              <label htmlFor="review-comment" className="block font-semibold mb-1">
                Optional comment (≤280 chars)
              </label>
              <textarea
                id="review-comment"
                value={reviewComment}
                maxLength={280}
                onChange={(e) => setReviewComment(e.target.value)}
                placeholder="Share traveler observations (lighting, road condition, traffic speed, shoulder width)..."
                className="w-full rounded-xl border bg-background p-2 text-xs min-h-[55px]"
              />
              <div className="flex justify-end text-[10px] text-muted-foreground">
                {reviewComment.length}/280
              </div>
            </div>

            <Button
              type="submit"
              size="sm"
              disabled={reviewMutation.isPending}
              className="w-full font-bold bg-purple-600 hover:bg-purple-700 text-white"
            >
              {reviewMutation.isPending ? "Submitting…" : "Submit Safety Review"}
            </Button>
          </form>
        )}
      </div>

      {/* Community road reports list */}
      <h4 className="font-semibold text-xs uppercase tracking-wider text-muted-foreground mb-1">
        Live Road Issues
      </h4>
      {query.isPending ? (
        <p role="status">Loading reports…</p>
      ) : query.isError || !query.data?.available ? (
        <div>
          <p>Road reports are temporarily unavailable.</p>
          <Button variant="outline" onClick={() => void query.refetch()}>
            Retry
          </Button>
        </div>
      ) : (
        <>
          {reports.length === 0 && (
            <p>
              No recent reports available. This does not confirm roads are
              clear.
            </p>
          )}
          <ul className="max-h-60 overflow-y-auto">
            {reports.map((report) => (
              <li key={report.id} className="my-3 rounded-lg border p-2">
                <strong className="capitalize">{report.kind}</strong> ·{" "}
                {report.status === "approved"
                  ? "Reviewed community report"
                  : `Your report: ${report.status}`}
                <p>{report.detail}</p>
                <p className="text-xs">
                  Reported {new Date(report.created_at).toLocaleString()} ·
                  expires {new Date(report.expires_at).toLocaleTimeString()}
                </p>
                <Button
                  variant="outline"
                  className="mt-2 min-h-11"
                  onClick={() => onLocate(report)}
                >
                  Show location
                </Button>
              </li>
            ))}
          </ul>
          {point ? (
            <form
              className="mt-4 space-y-3"
              onSubmit={(event) => {
                event.preventDefault();
                mutation.mutate({
                  lat: point.lat,
                  lng: point.lng,
                  kind,
                  detail,
                });
              }}
            >
              <p>
                Report at {point.name} ({point.lat.toFixed(5)},{" "}
                {point.lng.toFixed(5)}). Select or adjust a destination pin to
                change this location.
              </p>
              <label className="block">
                Issue
                <select
                  className="block min-h-11 w-full rounded-lg border bg-background px-2"
                  value={kind}
                  onChange={(event) =>
                    setKind(event.target.value as RoadReportInput["kind"])
                  }
                >
                  {["obstruction", "closure", "flooding", "roadworks"].map(
                    (value) => (
                      <option key={value}>{value}</option>
                    ),
                  )}
                </select>
              </label>
              <label className="block">
                What did you observe?
                <textarea
                  required
                  minLength={10}
                  maxLength={300}
                  className="block w-full rounded-lg border bg-background p-2"
                  value={detail}
                  onChange={(event) => setDetail(event.target.value)}
                  placeholder="Describe the road issue. Do not include personal details."
                />
              </label>
              <Button
                disabled={mutation.isPending || detail.trim().length < 10}
                type="submit"
              >
                {mutation.isPending ? "Submitting…" : "Submit for review"}
              </Button>
            </form>
          ) : (
            <p className="mt-3">
              Select a destination to report a road issue at that pin.
            </p>
          )}
        </>
      )}
    </details>
  );
}
