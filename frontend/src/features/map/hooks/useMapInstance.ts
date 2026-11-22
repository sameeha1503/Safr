import { useEffect, useRef, useState, useCallback } from "react";
import type { Map as MapLibreMap, IControl } from "maplibre-gl";
import mapWorkerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url";
import {
  MAP_STYLES,
  GOA_CENTER,
  GOA_BOUNDS,
  addCustomLayers,
  injectMapCSS,
  OSM_RASTER_STYLE,
} from "@/lib/map-config";

export interface UseMapInstanceOptions {
  containerRef: React.RefObject<HTMLDivElement | null>;
  activeStyleId: string;
  is3d: boolean;
  onStyleChange: (styleId: string) => void;
  onToggle3d: () => void;
  onResetView: () => void;
  routeDataFn: () => void;
  onMapInit?: (map: MapLibreMap, ml: typeof import("maplibre-gl")) => void;
}

export function useMapInstance({
  containerRef,
  activeStyleId,
  is3d,
  onStyleChange,
  onToggle3d,
  onResetView,
  routeDataFn,
  onMapInit,
}: UseMapInstanceOptions) {
  const mapRef = useRef<MapLibreMap | null>(null);
  const maplibreRef = useRef<typeof import("maplibre-gl") | null>(null);

  const [ready, setReady] = useState(false);
  const [isLoadingMap, setIsLoadingMap] = useState(true);
  const [mapLoadError, setMapLoadError] = useState(false);
  const [retrySeed, setRetrySeed] = useState(0);
  const loadTimer = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );

  const appliedStyleIdRef = useRef<string>(activeStyleId);

  // Callbacks and state in refs for map events
  const activeStyleIdRef = useRef(activeStyleId);
  activeStyleIdRef.current = activeStyleId;

  const is3dRef = useRef(is3d);
  is3dRef.current = is3d;

  const onStyleChangeRef = useRef(onStyleChange);
  onStyleChangeRef.current = onStyleChange;

  const onToggle3dRef = useRef(onToggle3d);
  onToggle3dRef.current = onToggle3d;

  const onResetViewRef = useRef(onResetView);
  onResetViewRef.current = onResetView;

  const routeDataFnRef = useRef(routeDataFn);
  routeDataFnRef.current = routeDataFn;

  const onMapInitRef = useRef(onMapInit);
  onMapInitRef.current = onMapInit;

  const retry = useCallback(() => {
    setMapLoadError(false);
    setIsLoadingMap(true);
    const map = mapRef.current;
    if (map) {
      appliedStyleIdRef.current = "osm";
      onStyleChangeRef.current("osm");
      map.setStyle(OSM_RASTER_STYLE);
      clearTimeout(loadTimer.current);
      loadTimer.current = setTimeout(() => {
        if (!map.isStyleLoaded()) {
          setMapLoadError(true);
          setIsLoadingMap(false);
        }
      }, 12000);
    } else setRetrySeed((value) => value + 1);
  }, []);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    let cancelled = false;
    setReady(false);

    void import("maplibre-gl")
      .then((ml) => {
        if (cancelled || !containerRef.current) return;
        maplibreRef.current = ml;
        ml.setWorkerUrl(mapWorkerUrl);
        injectMapCSS();

        const initStyle =
          MAP_STYLES.find((s) => s.id === activeStyleIdRef.current) ??
          MAP_STYLES[0]!;
        appliedStyleIdRef.current = initStyle.id;

        const map = new ml.Map({
          container: containerRef.current,
          style: initStyle.style,
          center: GOA_CENTER,
          zoom: 11,
          maxPitch: 70,
          minZoom: 8,
          maxBounds: GOA_BOUNDS,
          attributionControl: { compact: true },
          dragRotate: true,
        });

        mapRef.current = map;

        // Resilient fallback timer: only auto-fallbacks if style fails to initialize within 12 seconds
        loadTimer.current = setTimeout(() => {
          if (!map.isStyleLoaded()) {
            console.warn(
              "[map] Style initialization timed out, falling back to OSM standard tiles...",
            );
            try {
              appliedStyleIdRef.current = "osm";
              onStyleChangeRef.current("osm");
              map.setStyle(OSM_RASTER_STYLE);
              loadTimer.current = setTimeout(() => {
                if (!map.isStyleLoaded()) {
                  setMapLoadError(true);
                  setIsLoadingMap(false);
                }
              }, 12000);
            } catch {
              setMapLoadError(true);
              setIsLoadingMap(false);
            }
          } else {
            setIsLoadingMap(false);
            setMapLoadError(false);
            setReady(true);
          }
        }, 12000);

        map.addControl(
          new ml.NavigationControl({ showCompass: true, showZoom: true }),
          "top-right",
        );
        map.addControl(new ml.FullscreenControl(), "top-right");

        // Style switcher (top-left)
        const switcherDiv = document.createElement("div");
        switcherDiv.className = "safr-style-switcher";
        MAP_STYLES.forEach((s) => {
          const btn = document.createElement("button");
          btn.className = "safr-style-btn";
          btn.textContent = s.icon;
          btn.title = s.label;
          btn.setAttribute("aria-label", `Map style: ${s.label}`);
          btn.setAttribute(
            "aria-pressed",
            s.id === activeStyleIdRef.current ? "true" : "false",
          );
          btn.addEventListener("click", () => {
            onStyleChangeRef.current(s.id);
          });
          switcherDiv.appendChild(btn);
        });

        class StyleSwitcherControl {
          _container?: HTMLElement;
          onAdd() {
            this._container = document.createElement("div");
            this._container.className = "maplibregl-ctrl";
            this._container.appendChild(switcherDiv);
            return this._container;
          }
          onRemove() {
            this._container?.remove();
          }
        }
        map.addControl(new StyleSwitcherControl() as IControl, "top-left");

        // 3D toggle + reset view (top-left under switcher)
        const ctrlsDiv = document.createElement("div");
        ctrlsDiv.className = "maplibregl-ctrl";
        ctrlsDiv.style.cssText = "display:flex;flex-direction:column;gap:4px;";

        const btn3d = document.createElement("button");
        btn3d.className = "safr-map-ctrl-btn";
        btn3d.textContent = "3D";
        btn3d.setAttribute("aria-label", "Toggle 3D buildings and terrain");
        btn3d.setAttribute("aria-pressed", "false");
        btn3d.addEventListener("click", () => {
          onToggle3dRef.current();
        });
        ctrlsDiv.appendChild(btn3d);

        const btnReset = document.createElement("button");
        btnReset.className = "safr-map-ctrl-btn";
        btnReset.textContent = "⌂";
        btnReset.setAttribute("aria-label", "Recenter map view");
        btnReset.addEventListener("click", () => {
          onResetViewRef.current();
        });
        ctrlsDiv.appendChild(btnReset);

        class ExtraControlsControl {
          _container?: HTMLElement;
          onAdd() {
            this._container = document.createElement("div");
            this._container.className = "maplibregl-ctrl";
            this._container.appendChild(ctrlsDiv);
            return this._container;
          }
          onRemove() {
            this._container?.remove();
          }
        }
        map.addControl(new ExtraControlsControl() as IControl, "top-left");

        // Error handler: log resource warnings, never blank screen for minor tile/glyph 404s
        map.on("error", (e) => {
          console.warn("[map resource]", e?.error?.message || e);
        });

        // Style load handler (single place where layers are restored)
        map.on("style.load", () => {
          clearTimeout(loadTimer.current);
          setIsLoadingMap(false);
          setMapLoadError(false);
          setReady(true);

          const curStyle =
            MAP_STYLES.find((s) => s.id === activeStyleIdRef.current) ??
            MAP_STYLES[0]!;
          addCustomLayers(map, {
            is3d: is3dRef.current,
            isVector: curStyle.isVector,
            routeDataFn: () => routeDataFnRef.current(),
          });
        });

        map.on("load", () => {
          clearTimeout(loadTimer.current);
          setIsLoadingMap(false);
          setMapLoadError(false);
          setReady(true);
        });

        if (onMapInitRef.current) {
          onMapInitRef.current(map, ml);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setMapLoadError(true);
          setIsLoadingMap(false);
        }
      });

    return () => {
      cancelled = true;
      clearTimeout(loadTimer.current);
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, [containerRef, retrySeed]);

  return {
    mapRef,
    maplibreRef,
    ready,
    isLoadingMap,
    mapLoadError,
    appliedStyleIdRef,
    retry,
  };
}
