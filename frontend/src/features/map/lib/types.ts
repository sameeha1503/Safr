import type { ScoredRoute } from "@/lib/maps.server";

export interface Hit {
  id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
}

export type Scored = ScoredRoute;
export type TravelMode = "car" | "motor_scooter" | "bicycle" | "walking";

export interface MapSearchParams {
  dest?: string;
  lat?: string;
  lng?: string;
  origin?: string;
  originLat?: string;
  originLng?: string;
  stops?: string;
}
