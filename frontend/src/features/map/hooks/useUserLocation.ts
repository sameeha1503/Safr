import { useCallback, useEffect, useRef, useState } from "react";
import type { Map as MapLibreMap, Marker as MapLibreMarker } from "maplibre-gl";
import { toast } from "sonner";
import {
  metersPerPixel,
  normalizeHeading,
  angleDelta,
  smoothAngle,
  haversineDistanceMeters,
} from "../lib/geo-math";
import {
  acceptGpsSample,
  deriveNavigationProgress,
  type NavigationPoint,
} from "../lib/navigation-progress";

export type FollowMode = "free" | "follow" | "heading";
export type GeolocationStatus =
  "idle" | "prompt" | "granted" | "denied" | "unsupported";

export interface UserLocationResult {
  status: GeolocationStatus;
  position: { lat: number; lng: number } | null;
  accuracy: number | null;
  lastUpdated: number | null;
  heading: number | null;
  followMode: FollowMode;
  pannedAway: boolean;
  cycleFollow: () => void;
  recenter: () => void;
  start: () => void;
  setRoutePath: (path: NavigationPoint[]) => void;
}

export interface UseUserLocationOptions {
  mapRef: React.RefObject<MapLibreMap | null>;
  ready: boolean;
  maplibreRef?: React.RefObject<typeof import("maplibre-gl") | null>;
}

export function useUserLocation({
  mapRef,
  ready,
  maplibreRef,
}: UseUserLocationOptions): UserLocationResult {
  const [status, setStatus] = useState<GeolocationStatus>("idle");
  const [position, setPosition] = useState<{ lat: number; lng: number } | null>(
    null,
  );
  const [accuracy, setAccuracy] = useState<number | null>(null);
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);
  const [heading, setHeading] = useState<number | null>(null);
  const [followMode, setFollowMode] = useState<FollowMode>("free");
  const [pannedAway, setPannedAway] = useState(false);

  // References for live imperative updates without causing React re-render cascades
  const latestPosRef = useRef<{ lat: number; lng: number } | null>(null);
  const latestAccuracyRef = useRef<number | null>(null);
  const latestHeadingRef = useRef<number | null>(null);
  const smoothedHeadingRef = useRef<number | null>(null);

  const lastEmitTimeRef = useRef<number>(0);
  const lastEmittedPosRef = useRef<{ lat: number; lng: number } | null>(null);
  const lastEmittedAccRef = useRef<number | null>(null);

  const followModeRef = useRef<FollowMode>(followMode);
  followModeRef.current = followMode;

  const watchIdRef = useRef<number | null>(null);
  const isWatchingRef = useRef<boolean>(false);
  const sessionWarnedRef = useRef<boolean>(false);

  // Marker DOM elements and instance
  const markerRef = useRef<MapLibreMarker | null>(null);
  const circleElRef = useRef<HTMLDivElement | null>(null);
  const coneElRef = useRef<HTMLDivElement | null>(null);
  const zoomRafIdRef = useRef<number | null>(null);

  const hasRequestedOrientationPermissionRef = useRef(false);
  const lastBearingUpdateRef = useRef<number>(0);
  const routePathRef = useRef<NavigationPoint[]>([]);
  const previousSampleRef = useRef<
    (NavigationPoint & { timestamp: number; accuracy: number }) | null
  >(null);

  // Check prefers-reduced-motion
  const prefersReducedMotion =
    typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

  // Cleanup marker
  const cleanupMarker = useCallback(() => {
    if (zoomRafIdRef.current !== null) {
      cancelAnimationFrame(zoomRafIdRef.current);
      zoomRafIdRef.current = null;
    }
    markerRef.current?.remove();
    markerRef.current = null;
    circleElRef.current = null;
    coneElRef.current = null;
  }, []);

  // Update accuracy circle size in pixels
  const updateAccuracyCircle = useCallback(() => {
    const map = mapRef.current;
    const pos = latestPosRef.current;
    const acc = latestAccuracyRef.current;
    const circleEl = circleElRef.current;
    if (!map || !pos || acc == null || !circleEl) return;

    const zoom = map.getZoom();
    const mpp = metersPerPixel(pos.lat, zoom);
    // Diameter in px, never smaller than the dot (16px, margin 8px)
    const diameter = Math.max(20, Math.round((2 * acc) / mpp));
    const radius = diameter / 2;

    circleEl.style.width = `${diameter}px`;
    circleEl.style.height = `${diameter}px`;
    circleEl.style.marginLeft = `-${radius}px`;
    circleEl.style.marginTop = `-${radius}px`;
  }, [mapRef]);

  // Ensure DOM marker exists on map
  const ensureMarker = useCallback(
    async (lat: number, lng: number) => {
      const map = mapRef.current;
      if (!map || !ready) return;

      if (!markerRef.current) {
        const ml = maplibreRef?.current || (await import("maplibre-gl"));

        const container = document.createElement("div");
        container.className = "safr-loc-marker-container";

        const accuracyCircle = document.createElement("div");
        accuracyCircle.className = "safr-loc-accuracy-circle";
        circleElRef.current = accuracyCircle;

        const headingCone = document.createElement("div");
        headingCone.className = "safr-loc-heading-cone";
        headingCone.style.display = "none";
        headingCone.innerHTML = `
          <svg viewBox="0 0 120 120" width="120" height="120" style="display:block;overflow:visible;">
            <defs>
              <radialGradient id="safr-loc-cone-grad" cx="60" cy="60" r="60" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stop-color="rgba(37, 99, 235, 0.45)" />
                <stop offset="100%" stop-color="rgba(37, 99, 235, 0)" />
              </radialGradient>
            </defs>
            <path d="M 60 60 L 30 8.04 A 60 60 0 0 1 90 8.04 Z" fill="url(#safr-loc-cone-grad)" />
          </svg>
        `;
        coneElRef.current = headingCone;

        const pulseRing = document.createElement("div");
        pulseRing.className = "safr-loc-pulse-ring";

        const dot = document.createElement("div");
        dot.className = "safr-loc-dot";

        container.append(accuracyCircle, headingCone, pulseRing, dot);

        const marker = new ml.Marker({
          element: container,
          anchor: "center",
          rotationAlignment: "map",
          pitchAlignment: "map",
        });

        marker.setLngLat([lng, lat]).addTo(map);
        markerRef.current = marker;
      } else {
        markerRef.current.setLngLat([lng, lat]);
      }

      updateAccuracyCircle();
    },
    [mapRef, ready, maplibreRef, updateAccuracyCircle],
  );

  // Imperative update on heading change
  const applyHeading = useCallback(
    (rawHeading: number) => {
      const prev = smoothedHeadingRef.current;
      const smoothed =
        prev !== null
          ? smoothAngle(prev, rawHeading, 0.25)
          : normalizeHeading(rawHeading);
      smoothedHeadingRef.current = smoothed;
      latestHeadingRef.current = smoothed;

      if (coneElRef.current) {
        coneElRef.current.style.display = "block";
      }

      if (markerRef.current) {
        markerRef.current.setRotation(smoothed);
      }

      // If followMode === "heading", follow heading with map bearing
      const map = mapRef.current;
      if (map && followModeRef.current === "heading") {
        const now = Date.now();
        if (now - lastBearingUpdateRef.current >= 250) {
          const curBearing = map.getBearing();
          const delta = Math.abs(angleDelta(curBearing, smoothed));
          if (delta > 3) {
            lastBearingUpdateRef.current = now;
            map.easeTo({
              bearing: smoothed,
              duration: prefersReducedMotion ? 0 : 200,
            });
          }
        }
      }
    },
    [mapRef, prefersReducedMotion],
  );

  // Orientation listener setup
  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleOrientation = (e: DeviceOrientationEvent) => {
      let h: number | null = null;
      // iOS Safari compass heading
      if (
        typeof (e as unknown as { webkitCompassHeading?: number })
          .webkitCompassHeading === "number" &&
        !isNaN(
          (e as unknown as { webkitCompassHeading: number })
            .webkitCompassHeading,
        )
      ) {
        h = (e as unknown as { webkitCompassHeading: number })
          .webkitCompassHeading;
      } else if (
        e.absolute === true &&
        typeof e.alpha === "number" &&
        !isNaN(e.alpha)
      ) {
        // Android absolute heading: 360 - alpha
        h = normalizeHeading(360 - e.alpha);
      } else if (typeof e.alpha === "number" && !isNaN(e.alpha)) {
        h = normalizeHeading(360 - e.alpha);
      }

      if (h !== null) {
        applyHeading(h);
      }
    };

    window.addEventListener(
      "deviceorientationabsolute",
      handleOrientation as EventListener,
    );
    window.addEventListener(
      "deviceorientation",
      handleOrientation as EventListener,
    );

    return () => {
      window.removeEventListener(
        "deviceorientationabsolute",
        handleOrientation as EventListener,
      );
      window.removeEventListener(
        "deviceorientation",
        handleOrientation as EventListener,
      );
    };
  }, [applyHeading]);

  // Start watchPosition
  const startWatch = useCallback(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setStatus("unsupported");
      return;
    }

    isWatchingRef.current = true;
    if (watchIdRef.current !== null) return;

    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        const acc = pos.coords.accuracy;
        const sample = {
          lat,
          lng,
          accuracy: acc,
          timestamp: pos.timestamp || Date.now(),
        };
        if (
          !acceptGpsSample({
            previous: previousSampleRef.current,
            next: sample,
          })
        )
          return;
        previousSampleRef.current = sample;
        setLastUpdated(sample.timestamp);
        setStatus("granted");

        latestPosRef.current = { lat, lng };
        latestAccuracyRef.current = acc;

        // Fallback heading from GPS coords if moving > 1 m/s
        if (
          pos.coords.speed != null &&
          pos.coords.speed > 1 &&
          pos.coords.heading != null &&
          !isNaN(pos.coords.heading)
        ) {
          applyHeading(pos.coords.heading);
        }

        const routeProgress = deriveNavigationProgress({
          position: { lat, lng },
          accuracyMeters: acc,
          path: routePathRef.current,
          steps: [],
          durationSeconds: 0,
        });
        const display =
          routeProgress && !routeProgress.offRoute && acc <= 50
            ? routeProgress.snapped
            : { lat, lng };
        void ensureMarker(display.lat, display.lng);

        // Accuracy check: non-blocking warning once per session if > 100m
        if (acc > 100 && !sessionWarnedRef.current) {
          sessionWarnedRef.current = true;
          try {
            if (sessionStorage.getItem("safr_gps_acc_warned") !== "true") {
              sessionStorage.setItem("safr_gps_acc_warned", "true");
              toast.info("Low GPS accuracy: position may be approximate.", {
                duration: 4000,
              });
            }
          } catch {
            // ignore sessionStorage error
          }
        }

        // Active follow modes
        const map = mapRef.current;
        if (map) {
          if (
            followModeRef.current === "follow" ||
            followModeRef.current === "heading"
          ) {
            map.easeTo({
              center: [lng, lat],
              duration: prefersReducedMotion ? 0 : 500,
            });
          }
        }

        // Throttle React state updates to at most once per second and only when moved > 2m or accuracy > 5m
        const now = Date.now();
        const timeDiff = now - lastEmitTimeRef.current;
        if (timeDiff >= 1000) {
          const lastP = lastEmittedPosRef.current;
          const lastA = lastEmittedAccRef.current;
          const moved =
            !lastP ||
            haversineDistanceMeters(lastP.lat, lastP.lng, lat, lng) > 2;
          const accDiff = lastA == null || Math.abs(lastA - acc) > 5;

          if (moved || accDiff || timeDiff > 5000) {
            lastEmitTimeRef.current = now;
            lastEmittedPosRef.current = { lat, lng };
            lastEmittedAccRef.current = acc;
            setPosition({ lat, lng });
            setAccuracy(acc);
            if (latestHeadingRef.current !== null) {
              setHeading(latestHeadingRef.current);
            }
          }
        }
      },
      (err) => {
        if (err.code === err.PERMISSION_DENIED) {
          setStatus("denied");
          cleanupMarker();
        }
      },
      {
        enableHighAccuracy: true,
        maximumAge: 1000,
        timeout: 15000,
      },
    );
  }, [applyHeading, ensureMarker, mapRef, prefersReducedMotion, cleanupMarker]);

  // Initial permission check & visibility handling
  useEffect(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setStatus("unsupported");
      return;
    }

    if (navigator.permissions?.query) {
      navigator.permissions
        .query({ name: "geolocation" })
        .then((pStatus) => {
          setStatus(pStatus.state as GeolocationStatus);
          if (pStatus.state === "granted") {
            startWatch();
          }
          pStatus.onchange = () => {
            setStatus(pStatus.state as GeolocationStatus);
            if (pStatus.state === "granted") {
              startWatch();
            } else if (pStatus.state === "denied") {
              if (watchIdRef.current !== null) {
                navigator.geolocation.clearWatch(watchIdRef.current);
                watchIdRef.current = null;
              }
              cleanupMarker();
            }
          };
        })
        .catch(() => {
          // Fallback if query not supported
        });
    }

    const onVisibilityChange = () => {
      if (document.hidden) {
        if (watchIdRef.current !== null) {
          navigator.geolocation.clearWatch(watchIdRef.current);
          watchIdRef.current = null;
        }
      } else if (isWatchingRef.current && watchIdRef.current === null) {
        startWatch();
      }
    };

    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      cleanupMarker();
    };
  }, [startWatch, cleanupMarker]);

  // Map listeners: zoom (throttled) & user drag/rotate detection
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;

    const onZoom = () => {
      if (zoomRafIdRef.current !== null) return;
      zoomRafIdRef.current = requestAnimationFrame(() => {
        zoomRafIdRef.current = null;
        updateAccuracyCircle();
      });
    };

    // User drag or touch rotate drops follow mode to "free"
    const onUserInteraction = (e: { originalEvent?: unknown }) => {
      if (e.originalEvent) {
        setFollowMode("free");
        setPannedAway(true);
      }
    };

    map.on("zoom", onZoom);
    map.on("dragstart", onUserInteraction);
    map.on("rotatestart", onUserInteraction);

    return () => {
      map.off("zoom", onZoom);
      map.off("dragstart", onUserInteraction);
      map.off("rotatestart", onUserInteraction);
    };
  }, [mapRef, ready, updateAccuracyCircle]);

  // Cycle follow modes
  const cycleFollow = useCallback(() => {
    // Request iOS orientation permission on first user tap
    if (
      !hasRequestedOrientationPermissionRef.current &&
      typeof window !== "undefined" &&
      typeof (
        DeviceOrientationEvent as unknown as {
          requestPermission?: () => Promise<string>;
        }
      ).requestPermission === "function"
    ) {
      hasRequestedOrientationPermissionRef.current = true;
      (
        DeviceOrientationEvent as unknown as {
          requestPermission: () => Promise<string>;
        }
      )
        .requestPermission()
        .catch(() => {});
    }

    const map = mapRef.current;
    const curPos = latestPosRef.current;
    const curMode = followModeRef.current;

    if (!curPos || !map) return;

    if (curMode === "free") {
      setFollowMode("follow");
      setPannedAway(false);
      map.easeTo({
        center: [curPos.lng, curPos.lat],
        zoom: Math.max(map.getZoom(), 15),
        duration: prefersReducedMotion ? 0 : 600,
      });
    } else if (curMode === "follow") {
      setFollowMode("heading");
      setPannedAway(false);
      if (smoothedHeadingRef.current !== null) {
        map.easeTo({
          bearing: smoothedHeadingRef.current,
          duration: prefersReducedMotion ? 0 : 300,
        });
      }
    } else {
      // In heading mode -> tap returns to follow with bearing eased back to 0
      setFollowMode("follow");
      setPannedAway(false);
      map.easeTo({
        bearing: 0,
        duration: prefersReducedMotion ? 0 : 500,
      });
    }
  }, [mapRef, prefersReducedMotion]);

  const recenter = useCallback(() => {
    const map = mapRef.current;
    const curPos = latestPosRef.current;
    if (!map || !curPos) return;

    setFollowMode("follow");
    setPannedAway(false);
    map.easeTo({
      center: [curPos.lng, curPos.lat],
      zoom: Math.max(map.getZoom(), 15),
      duration: prefersReducedMotion ? 0 : 600,
    });
  }, [mapRef, prefersReducedMotion]);

  const setRoutePath = useCallback((path: NavigationPoint[]) => {
    routePathRef.current = path;
  }, []);

  return {
    status,
    position,
    accuracy,
    lastUpdated,
    heading,
    followMode,
    pannedAway,
    cycleFollow,
    recenter,
    start: startWatch,
    setRoutePath,
  };
}
