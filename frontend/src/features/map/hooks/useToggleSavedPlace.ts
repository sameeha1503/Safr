import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { kindToCategory, type PickedPlace } from "../lib/place-picking";

export interface SavedPlaceRecord {
  id: string;
  user_id: string;
  place_name: string;
  category: string;
  notes?: string | null;
  image_url?: string | null;
  lat: number | null;
  lng: number | null;
  created_at?: string;
  status?: string;
  priority?: number;
  tags?: string[];
}

export function useToggleSavedPlace() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (place: PickedPlace) => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) {
        toast.error("Please sign in to save places to your bucket list.");
        return;
      }

      const existingPlaces =
        queryClient.getQueryData<SavedPlaceRecord[]>(["saved-places"]) || [];
      const existing = existingPlaces.find(
        (p) => p.place_name.toLowerCase() === place.name.toLowerCase(),
      );

      if (existing) {
        const { error } = await supabase
          .from("saved_places")
          .delete()
          .eq("id", existing.id);
        if (error) throw error;
        toast.info(`Removed ${place.name} from your bucket list`);
        return;
      }

      const category = kindToCategory(place.kindLabel);

      const { error } = await supabase.from("saved_places").insert({
        user_id: userData.user.id,
        place_name: place.name,
        category,
        lat: place.lat,
        lng: place.lng,
        status: "want",
        priority: 0,
        tags: [],
      });

      if (error) {
        // Handle Postgres unique violation (code 23505) gracefully
        if (
          error.code === "23505" ||
          error.message?.includes("idx_saved_places_user_place_name")
        ) {
          toast.info(`${place.name} is already in your bucket list`);
          return;
        }
        throw error;
      }

      toast.success(`Saved ${place.name} to your bucket list ❤️`);
    },
    onMutate: async (place: PickedPlace) => {
      await queryClient.cancelQueries({ queryKey: ["saved-places"] });
      const previous =
        queryClient.getQueryData<SavedPlaceRecord[]>(["saved-places"]) || [];

      const existingIndex = previous.findIndex(
        (p) => p.place_name.toLowerCase() === place.name.toLowerCase(),
      );

      let optimistic: SavedPlaceRecord[];
      if (existingIndex >= 0) {
        optimistic = previous.filter((_, idx) => idx !== existingIndex);
      } else {
        const optimisticEntry: SavedPlaceRecord = {
          id: `temp-${Date.now()}`,
          user_id: "optimistic",
          place_name: place.name,
          category: kindToCategory(place.kindLabel),
          lat: place.lat,
          lng: place.lng,
          status: "want",
          priority: 0,
          tags: [],
        };
        optimistic = [optimisticEntry, ...previous];
      }

      queryClient.setQueryData(["saved-places"], optimistic);
      return { previous };
    },
    onError: (err, place, context) => {
      if (context?.previous) {
        queryClient.setQueryData(["saved-places"], context.previous);
      }
      toast.error(
        err instanceof Error
          ? err.message
          : `Failed to update bucket list for ${place.name}`,
      );
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ["saved-places"] });
    },
  });
}
