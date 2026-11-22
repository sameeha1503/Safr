import { useCallback, useEffect, useRef, useState } from "react";
import type { LocationSample } from "@/lib/companion-tracking";
interface BatteryManager extends EventTarget {
  level: number;
}
type BatteryNavigator = Navigator & {
  getBattery?: () => Promise<BatteryManager>;
};
/** GPS is requested only by start(), never on mount. */
export function useDevicePosition() {
  const [sample, setSample] = useState<LocationSample | null>(null),
    [running, setRunning] = useState(false),
    [error, setError] = useState<string | null>(null);
  const watch = useRef<number | undefined>(undefined),
    battery = useRef<number | null>(null),
    generation = useRef(0);
  const batteryCleanup = useRef<() => void>(() => {});
  const stop = useCallback(() => {
    generation.current++;
    if (watch.current !== undefined)
      navigator.geolocation?.clearWatch(watch.current);
    watch.current = undefined;
    batteryCleanup.current();
    setRunning(false);
  }, []);
  useEffect(
    () => () => {
      generation.current++;
      if (watch.current !== undefined)
        navigator.geolocation?.clearWatch(watch.current);
      batteryCleanup.current();
    },
    [],
  );
  const start = useCallback(() => {
    stop();
    setError(null);
    setSample(null);
    battery.current = null;
    if (!navigator.geolocation) {
      setError("This browser does not support location access.");
      return;
    }
    const version = ++generation.current;
    setRunning(true);
    const nav = navigator as BatteryNavigator;
    if (nav.getBattery)
      void nav
        .getBattery()
        .then((manager) => {
          if (generation.current !== version) return;
          const update = () => {
            battery.current =
              Number.isFinite(manager.level) &&
              manager.level >= 0 &&
              manager.level <= 1
                ? Math.round(manager.level * 100)
                : null;
            setSample((old) =>
              old ? { ...old, battery: battery.current } : old,
            );
          };
          update();
          manager.addEventListener("levelchange", update);
          batteryCleanup.current = () =>
            manager.removeEventListener("levelchange", update);
        })
        .catch(() => {});
    watch.current = navigator.geolocation.watchPosition(
      (position) => {
        if (generation.current !== version) return;
        setSample({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracy: position.coords.accuracy,
          battery: battery.current,
          capturedAt: new Date(position.timestamp).toISOString(),
        });
        setError(null);
      },
      (failure) => {
        if (generation.current !== version) return;
        setError(
          failure.code === 1
            ? "Location permission was denied. Allow it in browser settings to share."
            : "Waiting for GPS. Keep this page open and try near a window.",
        );
      },
      { enableHighAccuracy: true, maximumAge: 0, timeout: 15000 },
    );
  }, [stop]);
  return { sample, running, error, start, stop };
}
