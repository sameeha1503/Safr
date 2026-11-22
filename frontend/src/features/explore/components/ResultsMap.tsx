import { useEffect, useRef, useState } from "react";
import type { Map as LibreMap, Marker } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { MAP_STYLES } from "@/lib/map-config";
import type { Coordinate } from "@/lib/geo";
import { Button } from "@/components/ui/button";

export type ResultPin = Coordinate & { name: string };
import { resultKey } from "@/lib/explore-results";

/** Separate map lifecycle so the saved-places map keeps its existing behaviour. */
export function ResultsMap({
  centre,
  places,
  onSelect,
}: {
  centre: ResultPin;
  places: ResultPin[];
  onSelect: (key: string) => void;
}) {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<LibreMap | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let disposed = false;
    let instance: LibreMap | undefined;
    setError(false);
    setReady(false);
    void (async () => {
      try {
        const libre = await import("maplibre-gl");
        const worker =
          await import("maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url");
        if (disposed || !container.current) return;
        libre.setWorkerUrl(worker.default);
        instance = new libre.Map({
          container: container.current,
          style: MAP_STYLES[0]!.style,
          center: [73.9, 15.4],
          zoom: 10,
        });
        map.current = instance;
        instance.addControl(new libre.NavigationControl(), "top-right");
        instance.on("load", () => {
          if (!disposed) setReady(true);
        });
        instance.on("error", () => {
          if (!disposed) setError(true);
        });
      } catch {
        if (!disposed) setError(true);
      }
    })();
    return () => {
      disposed = true;
      instance?.remove();
      map.current = null;
    };
  }, [attempt]);
  useEffect(() => {
    if (!ready || !map.current) return;
    let disposed = false;
    const markers: Marker[] = [];
    void import("maplibre-gl")
      .then((libre) => {
        if (disposed || !map.current) return;
        const bounds = new libre.LngLatBounds();
        const addPin = (place: ResultPin, isCentre: boolean) => {
          const button = document.createElement("button");
          button.type = "button";
          button.textContent = isCentre ? "◎" : "●";
          button.title = place.name;
          button.setAttribute(
            "aria-label",
            `${isCentre ? "Searched place" : "Select"}: ${place.name}`,
          );
          button.className =
            "rounded-full border-2 border-white bg-primary text-primary-foreground shadow-lg w-8 h-8 text-lg";
          if (!isCentre)
            button.addEventListener("click", () => onSelect(resultKey(place)));
          markers.push(
            new libre.Marker({ element: button })
              .setLngLat([place.lng, place.lat])
              .addTo(map.current!),
          );
          bounds.extend([place.lng, place.lat]);
        };
        addPin(centre, true);
        places.forEach((place) => addPin(place, false));
        map.current.fitBounds(bounds, {
          padding: 45,
          maxZoom: 15,
          duration: 0,
        });
      })
      .catch(() => {
        if (!disposed) setError(true);
      });
    return () => {
      disposed = true;
      markers.forEach((marker) => marker.remove());
    };
  }, [ready, centre, places, onSelect]);
  return (
    <section className="space-y-2">
      <div
        ref={container}
        className="h-96 w-full rounded-2xl overflow-hidden border"
        aria-label="Nearby places map"
      />
      {!ready && !error && (
        <p role="status" className="text-sm">
          Loading map…
        </p>
      )}
      {error && (
        <div className="text-sm">
          Some map data could not be loaded. The list remains available.{" "}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setAttempt((value) => value + 1)}
          >
            Retry map
          </Button>
        </div>
      )}
    </section>
  );
}
