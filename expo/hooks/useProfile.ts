import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { qk } from "@/lib/keys";
import { supabase } from "@/lib/supabase";
import type { Profile, Synthese } from "@/lib/types";
import { useAuth } from "@/providers/auth";

interface ProfilePatch {
  name?: string;
  avatar_url?: string | null;
  bio?: string | null;
  daily_prompt_enabled?: boolean;
}

export function useUpdateProfile() {
  const { userId, refetchProfile } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (patch: ProfilePatch): Promise<Profile> => {
      const { data, error } = await supabase
        .from("profiles")
        .update({ ...patch, updated_at: new Date().toISOString() })
        .eq("id", userId as string)
        .select("*")
        .single();
      if (error) throw error;
      return data as Profile;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["profile", userId] });
      refetchProfile();
    },
  });
}

/** Latest season synthèse (AI summary + memory video) for a space, if generated. */
export function useSynthese(spaceId: string, enabled = true) {
  return useQuery({
    queryKey: qk.synthese(spaceId),
    enabled: !!spaceId && enabled,
    queryFn: async (): Promise<Synthese | null> => {
      const { data, error } = await supabase
        .from("synthese")
        .select("*")
        .eq("space_id", spaceId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) {
        // Tolerate schemas without created_at ordering / empty tables.
        return null;
      }
      return (data as Synthese | null) ?? null;
    },
  });
}
