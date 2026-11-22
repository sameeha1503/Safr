import type { Database } from "../integrations/supabase/types";

type SaveArguments =
  Database["public"]["Functions"]["save_trip_with_travellers"]["Args"];
type TripClient = {
  rpc: (
    name: "save_trip_with_travellers",
    args: SaveArguments,
  ) => PromiseLike<{
    data: string | null;
    error: { code?: string; message: string } | null;
  }>;
};

/** One database transaction; never fall back to deleting and reinserting separately. */
export async function saveTripAtomically(
  client: TripClient,
  args: SaveArguments,
): Promise<string> {
  const { data, error } = await client.rpc("save_trip_with_travellers", args);
  if (error) {
    if (error.code === "PGRST202" || error.code === "42883") {
      throw new Error(
        "Trip saving needs a database update. Your existing trip has not been changed.",
      );
    }
    throw new Error(error.message);
  }
  if (!data) throw new Error("Your trip could not be saved. Please try again.");
  return data;
}
