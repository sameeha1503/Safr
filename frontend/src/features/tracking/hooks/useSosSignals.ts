import { useEffect, useRef } from "react";
export function useSosSignals(incidents: readonly { id: string }[]) {
  const seen = useRef(new Set<string>());
  useEffect(() => {
    const fresh = incidents.some((incident) => !seen.current.has(incident.id));
    incidents.forEach((incident) => seen.current.add(incident.id));
    if (!fresh) return;
    try {
      navigator.vibrate?.([200, 100, 200]);
      const audio = new AudioContext();
      if (audio.state !== "running") {
        void audio.close();
        return;
      }
      const oscillator = audio.createOscillator(),
        gain = audio.createGain();
      oscillator.connect(gain);
      gain.connect(audio.destination);
      gain.gain.value = 0.08;
      oscillator.frequency.value = 880;
      oscillator.start();
      oscillator.stop(audio.currentTime + 0.25);
      oscillator.onended = () => void audio.close();
    } catch {
      /* Sound and haptics depend on browser support and user interaction. */
    }
  }, [incidents]);
}
