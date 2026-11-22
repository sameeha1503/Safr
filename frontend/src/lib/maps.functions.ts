import { coordinateSchema } from "./travel-schemas";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export const searchPlaces = createServerFn({ method: "POST" })
  .validator((input: unknown) =>
    z.object({ query: z.string().trim().min(2).max(120) }).parse(input),
  )
  .handler(async ({ data }) => {
    const { searchGoaPlaces } = await import("./maps.server");
    return searchGoaPlaces(data.query);
  });

export const waypointSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  name: z.string().optional(),
});

export const getRoutes = createServerFn({ method: "POST" })
  .validator((input: unknown) =>
    z
      .object({
        origin: coordinateSchema.extend({ name: z.string().optional() }),
        destination: coordinateSchema.extend({ name: z.string().optional() }),
        waypoints: z.array(waypointSchema).max(5).default([]),
        mode: z
          .enum(["car", "motor_scooter", "bicycle", "walking"])
          .default("car"),
        isNight: z.boolean().default(false),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const { computeSafeRoutes } = await import("./maps.server");
    return computeSafeRoutes(
      data.origin,
      data.destination,
      data.isNight,
      data.waypoints,
      data.mode,
    );
  });

export const getRoutingConfig = createServerFn({ method: "GET" }).handler(
  async () => {
    const provider = (process.env["ROUTING_PROVIDER"] || "osrm").toLowerCase();
    return {
      provider,
      supportedModes:
        provider === "valhalla"
          ? (["car", "motor_scooter", "bicycle", "walking"] as const)
          : (["car"] as const),
    };
  },
);

export const getPlaceDetails = createServerFn({ method: "POST" })
  .validator((input: unknown) =>
    z
      .object({
        lat: z.number().min(-90).max(90),
        lng: z.number().min(-180).max(180),
        name: z.string().trim().min(1).max(200),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const { getPlaceDetailsServer } = await import("./places.server");
    return getPlaceDetailsServer(data);
  });
