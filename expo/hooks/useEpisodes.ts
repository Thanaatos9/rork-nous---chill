import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { qk } from "@/lib/keys";
import { PickedAsset, uploadMedia, uploadMediaAll } from "@/lib/media";
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
  /** The poster. Chosen deliberately, and kept out of the album. */
  cover?: PickedAsset | null;
  /** The album: everything shot that day. */
  assets: PickedAsset[];
}

export interface CreatedEpisode {
  episode: Episode;
  /** Album media that could not be sent. The episode is kept either way. */
  failedMedia: number;
  /** True when a cover was chosen but could not be sent. */
  coverFailed: boolean;
}

export function useCreateEpisode() {
  const { userId } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateEpisodeInput): Promise<CreatedEpisode> => {
      // Episodes carry a sequential, per-space number (#1, #2, …) on a NOT NULL
      // column, so compute the next one from the current highest in this space.
      const { data: last } = await supabase
        .from("episodes")
        .select("number")
        .eq("space_id", input.spaceId)
        .order("number", { ascending: false })
        .limit(1)
        .maybeSingle();
      const nextNumber = ((last?.number as number | null | undefined) ?? 0) + 1;

      // The episode is created first so uploads can use its id in candidate
      // storage paths.
      const { data, error } = await supabase
        .from("episodes")
        .insert({
          space_id: input.spaceId,
          number: nextNumber,
          title: input.title.trim(),
          date: input.date,
          // "place" is NOT NULL in the DB even though the UI marks it optional,
          // so send an empty string rather than null when it is left blank.
          place: input.place?.trim() || "",
          duration: input.duration ?? null,
          tags: input.tags && input.tags.length > 0 ? input.tags : null,
          cover_url: null,
          created_by: userId,
        })
        .select("*")
        .single();
      if (error) throw error;
      const episode = data as Episode;

      // Media is best-effort from here on. Deleting the episode because one
      // photo failed to upload throws away everything the user typed — they can
      // always add the missing media afterwards, so keep the episode and report
      // what did not make it.

      // The cover is uploaded on its own and never lands in `episode_media`:
      // it is the episode's poster, not the first item of its album.
      let coverFailed = false;
      if (input.cover) {
        try {
          const coverUrl = await uploadMedia(
            { kind: "covers", spaceId: input.spaceId, userId, episodeId: episode.id },
            input.cover,
          );
          const { error: coverError } = await supabase
            .from("episodes")
            .update({ cover_url: coverUrl })
            .eq("id", episode.id);
          if (coverError) throw coverError;
          episode.cover_url = coverUrl;
        } catch (e) {
          console.log("[episodes] cover upload failed:", e);
          coverFailed = true;
        }
      }

      const outcomes = await uploadMediaAll(
        { kind: "episodes", spaceId: input.spaceId, userId, episodeId: episode.id },
        input.assets,
      );
      const uploaded: { url: string; type: string }[] = [];
      let failedMedia = 0;
      for (const outcome of outcomes) {
        if (outcome.url) uploaded.push({ url: outcome.url, type: outcome.asset.type });
        else failedMedia += 1;
      }

      if (uploaded.length > 0) {
        const rows = uploaded.map((u) => ({
          episode_id: episode.id,
          space_id: input.spaceId,
          url: u.url,
          filename: u.url.split("/").pop() || "media",
          type: u.type,
          uploaded_by: userId,
        }));
        const { error: mediaError } = await supabase.from("episode_media").insert(rows);
        if (mediaError) {
          console.log("[episodes] media rows insert failed:", mediaError);
          failedMedia += uploaded.length;
        }
      }

      return { episode, failedMedia, coverFailed };
    },
    onSuccess: ({ episode }) => {
      queryClient.invalidateQueries({ queryKey: qk.episodes(episode.space_id) });
    },
  });
}

/**
 * Sets or replaces an episode's cover. The image is uploaded on the "covers"
 * path and no `episode_media` row is created for it: the poster and the album
 * are two different things, and changing one must not touch the other.
 */
export function useSetEpisodeCover(episodeId: string, spaceId: string) {
  const { userId } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (asset: PickedAsset): Promise<string> => {
      const url = await uploadMedia({ kind: "covers", spaceId, userId, episodeId }, asset);
      const { error } = await supabase.from("episodes").update({ cover_url: url }).eq("id", episodeId);
      if (error) throw error;
      return url;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.episode(episodeId) });
      queryClient.invalidateQueries({ queryKey: qk.episodes(spaceId) });
    },
  });
}

/*
 * Adding media to an existing episode used to live here, as a mutation the
 * screen awaited. It moved to lib/uploadQueue: a photo must not depend on its
 * screen staying open, and a mutation cannot outlive the component that started
 * it. Episode *creation* below still uploads inline — the episode has to exist
 * before anyone can be sent to it.
 */

/**
 * Removes one photo or video from an episode's album.
 *
 * The row is deleted with `.select()` on purpose: under RLS, a delete the
 * policies refuse comes back as a success with zero rows, so without it the app
 * would cheerfully report "supprimé" and change nothing.
 */
export function useDeleteEpisodeMedia(episodeId: string, spaceId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (mediaId: string): Promise<void> => {
      const { data, error } = await supabase.from("episode_media").delete().eq("id", mediaId).select("id");
      if (error) throw error;
      if (!data || data.length === 0) {
        throw new Error("Le serveur a refusé la suppression. Tu n'as peut-être pas les droits sur ce média.");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.episode(episodeId) });
      queryClient.invalidateQueries({ queryKey: qk.episodes(spaceId) });
    },
  });
}

/** Deletes an episode and everything hanging off it. */
export function useDeleteEpisode(spaceId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (episodeId: string): Promise<void> => {
      // Children are cleared first so the delete works whether or not the
      // foreign keys were declared ON DELETE CASCADE. Failures are ignored:
      // when the cascade does exist, these calls are simply redundant.
      for (const table of ["episode_media", "episode_comments", "episode_likes", "reviews"]) {
        const { error } = await supabase.from(table).delete().eq("episode_id", episodeId);
        if (error) console.log(`[episodes] could not clear ${table}:`, error.message);
      }

      const { data, error } = await supabase.from("episodes").delete().eq("id", episodeId).select("id");
      if (error) throw error;
      if (!data || data.length === 0) {
        throw new Error("Le serveur a refusé la suppression. Seuls le propriétaire de l'espace et l'auteur de l'épisode peuvent le supprimer.");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.episodes(spaceId) });
      queryClient.invalidateQueries({ queryKey: qk.synthese(spaceId) });
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
