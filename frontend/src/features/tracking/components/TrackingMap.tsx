import "maplibre-gl/dist/maplibre-gl.css";
import { useEffect, useRef, useState } from "react";
import type { Marker } from "maplibre-gl";
import { useMapInstance } from "@/features/map/hooks/useMapInstance";
import {
  getDefaultStyleId,
  MAP_STYLES,
  GOA_CENTER,
  addCustomLayers,
} from "@/lib/map-config";
import { Button } from "@/components/ui/button";
import type { Coordinate } from "@/lib/geo";
export type TrackingPin = Coordinate & {
  id: string;
  label: string;
  kind: "member" | "meeting" | "me";
  stale?: boolean;
};
export function TrackingMap({
  pins,
  selecting = false,
  onPick,
  onSelect,
}: {
  pins: TrackingPin[];
  selecting?: boolean;
  onPick?: (point: Coordinate) => void;
  onSelect?: (id: string) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null),
    markers = useRef(new Map<string, Marker>()),
    fitted = useRef(false);
  const [style, setStyle] = useState(getDefaultStyleId),
    [is3d, set3d] = useState(false);
  const pick = useRef(onPick),
    select = useRef(onSelect),
    selectingRef = useRef(selecting);
  pick.current = onPick;
  select.current = onSelect;
  selectingRef.current = selecting;
  const {
    mapRef,
    maplibreRef,
    ready,
    isLoadingMap,
    mapLoadError,
    retry,
    appliedStyleIdRef,
  } = useMapInstance({
    containerRef,
    activeStyleId: style,
    is3d,
    onStyleChange: setStyle,
    onToggle3d: () => set3d((value) => !value),
    onResetView: () => {
      mapRef.current?.flyTo({
        center: GOA_CENTER,
        zoom: 11,
        pitch: 0,
        bearing: 0,
      });
    },
    routeDataFn: () => {},
    onMapInit: (map) => {
      map.on("click", (event) => {
        if (selectingRef.current)
          pick.current?.({ lat: event.lngLat.lat, lng: event.lngLat.lng });
      });
    },
  });
  useEffect(() => {
    const map = mapRef.current,
      entry = MAP_STYLES.find((item) => item.id === style);
    if (!map || !entry || !ready) return;
    if (appliedStyleIdRef.current !== style) {
      appliedStyleIdRef.current = style;
      map.setStyle(entry.style);
    } else if (map.isStyleLoaded())
      addCustomLayers(map, { is3d, isVector: entry.isVector });
    map.easeTo({ pitch: is3d ? 45 : 0, duration: 400 });
  }, [style, is3d, ready, mapRef, appliedStyleIdRef]);
  useEffect(() => {
    if (!ready || !mapRef.current || !maplibreRef.current) return;
    const map = mapRef.current,
      ml = maplibreRef.current;
    const ids = new Set(pins.map((pin) => pin.id));
    markers.current.forEach((marker, id) => {
      if (!ids.has(id)) {
        marker.remove();
        markers.current.delete(id);
      }
    });
    for (const pin of pins) {
      let marker = markers.current.get(pin.id);
      if (!marker) {
        const element = document.createElement("button");
        element.type = "button";
        element.addEventListener("click", (event) => {
          event.stopPropagation();
          select.current?.(pin.id);
        });
        marker = new ml.Marker({ element })
          .setLngLat([pin.lng, pin.lat])
          .addTo(map);
        markers.current.set(pin.id, marker);
      }
      const element = marker.getElement();
      element.textContent = `${pin.kind === "meeting" ? "★" : pin.kind === "me" ? "●" : "●"} ${pin.label}`;
      element.setAttribute("aria-label", pin.label);
      element.style.cssText = `border:2px solid white;border-radius:14px;padding:7px 10px;color:white;font-weight:700;font-size:12px;background:${pin.stale ? "#64748b" : pin.kind === "meeting" ? "#a16207" : pin.kind === "me" ? "#2563eb" : "#0f766e"};box-shadow:0 2px 10px #0003;transition:transform 1s linear;`;
      marker.setLngLat([pin.lng, pin.lat]);
    }
    if (!fitted.current && pins.length) {
      const bounds = new ml.LngLatBounds();
      pins.forEach((pin) => bounds.extend([pin.lng, pin.lat]));
      map.fitBounds(bounds, { padding: 65, maxZoom: 14 });
      fitted.current = true;
    }
  }, [pins, ready, mapRef, maplibreRef]);
  useEffect(
    () => () => {
      markers.current.forEach((marker) => marker.remove());
      markers.current.clear();
    },
    [],
  );
  return (
    <div className="relative h-[420px] overflow-hidden rounded-3xl border bg-secondary sm:h-[540px]">
      <div
        ref={containerRef}
        className="h-full w-full"
        aria-label="Companion and meeting point map"
      />
      {selecting && (
        <div
          role="status"
          className="absolute bottom-5 inset-x-5 rounded-xl bg-background p-3 text-center text-sm shadow"
        >
          Tap a location on the map for your meeting spot.
        </div>
      )}
      {isLoadingMap && (
        <div
          role="status"
          className="absolute inset-0 grid place-items-center bg-background/80"
        >
          Loading map…
        </div>
      )}
      {mapLoadError && (
        <div
          role="alert"
          className="absolute inset-0 grid place-content-center gap-3 bg-background/90 p-6 text-center"
        >
          Map unavailable. Your companion list and directions still work.
          <Button onClick={retry}>Retry map</Button>
        </div>
      )}
    </div>
  );
}
