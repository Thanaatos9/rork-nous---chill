import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { qk } from "@/lib/keys";
import { getProfilesMap } from "@/lib/profiles";
import { supabase } from "@/lib/supabase";
import type { Review } from "@/lib/types";
import { useAuth } from "@/providers/auth";

export interface ReviewValues {
  rating: number | null;
  favorite_moment: string | null;
  awkward_moment: string | null;
  funny_quote: string | null;
  summary: string | null;
  song: string | null;
}

/** All reviews the backend exposes for an episode (own review always; others only after unlock). */
export function useEpisodeReviews(episodeId: string) {
  return useQuery({
    queryKey: qk.reviews(episodeId),
    enabled: !!episodeId,
    queryFn: async (): Promise<Review[]> => {
      const { data, error } = await supabase
        .from("reviews")
        .select("*")
        .eq("episode_id", episodeId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      const reviews = (data ?? []) as Review[];
      const profiles = await getProfilesMap(reviews.map((r) => r.author_id));
      return reviews.map((r) => ({ ...r, profile: profiles[r.author_id] ?? null }));
    },
  });
}

export function useMyReview(episodeId: string) {
  const { userId } = useAuth();
  return useQuery({
    queryKey: qk.myReview(episodeId, userId),
    enabled: !!episodeId && !!userId,
    queryFn: async (): Promise<Review | null> => {
      const { data, error } = await supabase
        .from("reviews")
        .select("*")
        .eq("episode_id", episodeId)
        .eq("author_id", userId as string)
        .maybeSingle();
      if (error) throw error;
      return (data as Review | null) ?? null;
    },
  });
}

interface UpsertReviewInput {
  episodeId: string;
  spaceId: string;
  values: ReviewValues;
}

export function useUpsertReview() {
  const { userId, profile } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ episodeId, spaceId, values }: UpsertReviewInput): Promise<Review> => {
      const { data: existing } = await supabase
        .from("reviews")
        .select("id")
        .eq("episode_id", episodeId)
        .eq("author_id", userId as string)
        .maybeSingle();

      if (existing) {
        const { data, error } = await supabase
          .from("reviews")
          .update({ ...values, updated_at: new Date().toISOString() })
          .eq("id", (existing as { id: string }).id)
          .select("*")
          .single();
        if (error) throw error;
        return data as Review;
      }

      const { data, error } = await supabase
        .from("reviews")
        // "author_name" is NOT NULL: snapshot the profile name at write time.
        .insert({ episode_id: episodeId, author_id: userId, space_id: spaceId, author_name: profile?.name ?? "Membre", ...values })
        .select("*")
        .single();
      if (error) throw error;
      return data as Review;
    },
    onSuccess: (_review, variables) => {
      queryClient.invalidateQueries({ queryKey: qk.reviews(variables.episodeId) });
      queryClient.invalidateQueries({ queryKey: qk.myReview(variables.episodeId, userId) });
    },
  });
}
