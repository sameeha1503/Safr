import { useEffect } from "react";
import type { Map as MapLibreMap } from "maplibre-gl";
import { MAP_STYLES, addCustomLayers } from "@/lib/map-config";

export interface UseMapStyleOptions {
  map: MapLibreMap | null;
  ready: boolean;
  activeStyleId: string;
  is3d: boolean;
  appliedStyleIdRef: React.MutableRefObject<string>;
  routeDataFn: () => void;
}

export function useMapStyle({
  map,
  ready,
  activeStyleId,
  is3d,
  appliedStyleIdRef,
  routeDataFn,
}: UseMapStyleOptions) {
  // Style switching
  useEffect(() => {
    if (!map || !ready) return;

    if (activeStyleId !== appliedStyleIdRef.current) {
      appliedStyleIdRef.current = activeStyleId;
      const entry =
        MAP_STYLES.find((s) => s.id === activeStyleId) ?? MAP_STYLES[0]!;
      map.setStyle(entry.style);
    }

    const btns = map
      .getContainer()
      .querySelectorAll<HTMLButtonElement>(".safr-style-btn");
    btns.forEach((btn, i) => {
      const s = MAP_STYLES[i];
      btn.setAttribute(
        "aria-pressed",
        s?.id === activeStyleId ? "true" : "false",
      );
    });
  }, [map, activeStyleId, ready, appliedStyleIdRef]);

  // 3D pitch and custom layers toggle
  useEffect(() => {
    if (!map || !ready) return;

    const curStyle =
      MAP_STYLES.find((s) => s.id === activeStyleId) ?? MAP_STYLES[0]!;
    map.easeTo({ pitch: is3d ? 60 : 0, duration: 600 });
    addCustomLayers(map, {
      is3d,
      isVector: curStyle.isVector,
      routeDataFn,
    });
  }, [map, is3d, activeStyleId, ready, routeDataFn]);
}
