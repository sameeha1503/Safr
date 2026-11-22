import { useState } from "react";
import { Button } from "@/components/ui/button";

export function DestinationPrecision({
  lat,
  lng,
  onChange,
}: {
  lat: number;
  lng: number;
  onChange: (point: { lat: number; lng: number }) => void;
}) {
  const [latitude, setLatitude] = useState(String(lat));
  const [longitude, setLongitude] = useState(String(lng));
  return (
    <details className="rounded-xl border p-3 text-sm">
      <summary className="cursor-pointer min-h-11 font-semibold">
        Adjust destination pin
      </summary>
      <p className="mb-2 text-xs text-muted-foreground">
        Drag the destination marker, or enter the coordinates of an entrance you
        have verified. A place centre may not be an accessible entrance.
      </p>
      <form
        className="space-y-2"
        onSubmit={(event) => {
          event.preventDefault();
          const lat = Number(latitude),
            lng = Number(longitude);
          if (Number.isFinite(lat) && Number.isFinite(lng))
            onChange({ lat, lng });
        }}
      >
        <label className="block">
          Latitude
          <input
            required
            type="number"
            min="14.8"
            max="15.9"
            step="any"
            className="block min-h-11 w-full rounded border bg-background px-2"
            value={latitude}
            onChange={(event) => setLatitude(event.target.value)}
          />
        </label>
        <label className="block">
          Longitude
          <input
            required
            type="number"
            min="73.6"
            max="74.4"
            step="any"
            className="block min-h-11 w-full rounded border bg-background px-2"
            value={longitude}
            onChange={(event) => setLongitude(event.target.value)}
          />
        </label>
        <Button type="submit" variant="outline">
          Route to this pin
        </Button>
      </form>
    </details>
  );
}
