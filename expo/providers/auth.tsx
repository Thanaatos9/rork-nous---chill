import createContextHook from "@nkzw/create-context-hook";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { Session, User } from "@supabase/supabase-js";
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { setPendingInvite } from "@/lib/pendingInvite";
import { unregisterPushToken } from "@/lib/push";
import type { Profile } from "@/lib/types";

interface SignUpArgs {
  email: string;
  password: string;
  name: string;
  inviteCode?: string | null;
}

export const [AuthProvider, useAuth] = createContextHook(() => {
  const queryClient = useQueryClient();
  const [session, setSession] = useState<Session | null>(null);
  const [initializing, setInitializing] = useState<boolean>(true);

  useEffect(() => {
    let active = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setSession(data.session);
      setInitializing(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      if (!nextSession) {
        queryClient.clear();
      }
    });

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, [queryClient]);

  const userId = session?.user?.id ?? null;

  const profileQuery = useQuery<Profile | null>({
    queryKey: ["profile", userId],
    enabled: !!userId,
    queryFn: async () => {
      if (!userId) return null;
      const { data, error } = await supabase.from("profiles").select("*").eq("id", userId).maybeSingle();
      if (error) throw error;
      if (data) return data as Profile;

      // Auto-provision a profile row if a trigger didn't create one.
      const fallbackName =
        (session?.user?.user_metadata?.name as string | undefined) ??
        session?.user?.email?.split("@")[0] ??
        "Membre";
      const { data: created, error: upsertError } = await supabase
        .from("profiles")
        .upsert({ id: userId, name: fallbackName }, { onConflict: "id" })
        .select("*")
        .single();
      if (upsertError) throw upsertError;
      return created as Profile;
    },
  });

  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (error) throw error;
  }, []);

  const signUp = useCallback(async ({ email, password, name, inviteCode }: SignUpArgs) => {
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: { data: { name: name.trim() } },
    });
    if (error) throw error;
    if (inviteCode) await setPendingInvite(inviteCode);
    return { needsConfirmation: !data.session };
  }, []);

  const resendConfirmation = useCallback(async (email: string) => {
    const { error } = await supabase.auth.resend({ type: "signup", email: email.trim() });
    if (error) throw error;
  }, []);

  const signOut = useCallback(async () => {
    if (userId) {
      try {
        await unregisterPushToken(userId);
      } catch {
        // Ignore — sign-out should proceed regardless.
      }
    }
    await supabase.auth.signOut();
  }, [userId]);

  return {
    session,
    user: (session?.user ?? null) as User | null,
    userId,
    profile: profileQuery.data ?? null,
    isAuthenticated: !!session,
    initializing,
    profileLoading: profileQuery.isLoading,
    signIn,
    signUp,
    signOut,
    resendConfirmation,
    refetchProfile: profileQuery.refetch,
  };
});
