import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { qk } from "@/lib/keys";
import { PickedAsset, uploadMedia } from "@/lib/media";
import { supabase } from "@/lib/supabase";
import type { Episode, EpisodeMedia } from "@/lib/types";
import { useAuth } from "@/providers/auth";

interface EpisodeRow extends Episode {
  episode_media: EpisodeMedia[] | null;
}

function mapEpisode(row: EpisodeRow): Episode {
  const media = row.episode_media ?? [];
  return { ...row, media, media_count: media.length };
}

export function useEpisodes(spaceId: string) {
  return useQuery({
    queryKey: qk.episodes(spaceId),
    enabled: !!spaceId,
    queryFn: async (): Promise<Episode[]> => {
      const { data, error } = await supabase
        .from("episodes")
        .select("*, episode_media(id, episode_id, url, type, created_at)")
        .eq("space_id", spaceId)
        .order("date", { ascending: false, nullsFirst: false })
        .order("created_at", { ascending: false });
      if (error) throw error;
      return ((data ?? []) as unknown as EpisodeRow[]).map(mapEpisode);
    },
  });
}

export function useEpisode(episodeId: string) {
  return useQuery({
    queryKey: qk.episode(episodeId),
    enabled: !!episodeId,
    queryFn: async (): Promise<Episode> => {
      const { data, error } = await supabase
        .from("episodes")
        .select("*, episode_media(id, episode_id, url, type, created_at)")
        .eq("id", episodeId)
        .single();
      if (error) throw error;
      return mapEpisode(data as unknown as EpisodeRow);
    },
  });
}

export interface CreateEpisodeInput {
  spaceId: string;
  title: string;
  date: string | null;
  place?: string;
  duration?: number | null;
  tags?: string[];
  assets: PickedAsset[];
}

export function useCreateEpisode() {
  const { userId } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateEpisodeInput): Promise<Episode> => {
      // The episode is created first so uploads can use its id in candidate
      // storage paths; a failed upload rolls the episode back.
      const { data, error } = await supabase
        .from("episodes")
        .insert({
          space_id: input.spaceId,
          title: input.title.trim(),
          date: input.date,
          place: input.place?.trim() || null,
          duration: input.duration ?? null,
          tags: input.tags && input.tags.length > 0 ? input.tags : null,
          cover_url: null,
          created_by: userId,
        })
        .select("*")
        .single();
      if (error) throw error;
      const episode = data as Episode;

      try {
        const uploaded: { url: string; type: string }[] = [];
        let coverUrl: string | null = null;
        for (const asset of input.assets) {
          const url = await uploadMedia(
            { kind: "episodes", spaceId: input.spaceId, userId, episodeId: episode.id },
            asset,
          );
          uploaded.push({ url, type: asset.type });
          if (!coverUrl && asset.type === "image") coverUrl = url;
        }

        if (uploaded.length > 0) {
          const rows = uploaded.map((u) => ({ episode_id: episode.id, url: u.url, type: u.type }));
          const { error: mediaError } = await supabase.from("episode_media").insert(rows);
          if (mediaError) throw mediaError;
        }

        if (coverUrl) {
          await supabase.from("episodes").update({ cover_url: coverUrl }).eq("id", episode.id);
          episode.cover_url = coverUrl;
        }

        return episode;
      } catch (uploadError) {
        // Best-effort rollback so a failed upload doesn't leave an empty episode.
        await supabase.from("episodes").delete().eq("id", episode.id);
        throw uploadError;
      }
    },
    onSuccess: (episode) => {
      queryClient.invalidateQueries({ queryKey: qk.episodes(episode.space_id) });
    },
  });
}

/** Adds extra media to an existing episode (camera/gallery). */
export function useAddEpisodeMedia(episodeId: string, spaceId: string) {
  const { userId } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (assets: PickedAsset[]): Promise<void> => {
      const rows: { episode_id: string; url: string; type: string }[] = [];
      for (const asset of assets) {
        const url = await uploadMedia({ kind: "episodes", spaceId, userId, episodeId }, asset);
        rows.push({ episode_id: episodeId, url, type: asset.type });
      }
      if (rows.length > 0) {
        const { error } = await supabase.from("episode_media").insert(rows);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.episode(episodeId) });
      queryClient.invalidateQueries({ queryKey: qk.episodes(spaceId) });
    },
  });
}

export function useEpisodeLikes(episodeId: string) {
  const { userId } = useAuth();
  return useQuery({
    queryKey: qk.likes(episodeId),
    enabled: !!episodeId,
    queryFn: async (): Promise<{ count: number; liked: boolean }> => {
      const { data, error } = await supabase.from("episode_likes").select("user_id").eq("episode_id", episodeId);
      if (error) throw error;
      const users = (data ?? []).map((r) => (r as { user_id: string }).user_id);
      return { count: users.length, liked: userId ? users.includes(userId) : false };
    },
  });
}

export function useToggleLike(episodeId: string) {
  const { userId } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (currentlyLiked: boolean): Promise<void> => {
      if (currentlyLiked) {
        const { error } = await supabase
          .from("episode_likes")
          .delete()
          .eq("episode_id", episodeId)
          .eq("user_id", userId as string);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("episode_likes").insert({ episode_id: episodeId, user_id: userId });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.likes(episodeId) });
    },
  });
}
