import { makeRedirectUri } from "expo-auth-session";
import { Platform } from "react-native";
import { createSessionFromUrl } from "@/lib/oauth";
import { supabase } from "@/lib/supabase";

/**
 * Where Supabase sends the user back to after they tap the recovery link.
 * On native this is the `rork-app://reset-password` deep link; on web
 * `makeRedirectUri` returns `<origin>/reset-password`. In both cases the app
 * detects the recovery token and shows the "set a new password" screen.
 */
export const resetRedirectTo: string = makeRedirectUri({
  scheme: "rork-app",
  path: "reset-password",
});

/**
 * Sends the "reset your password" email. Supabase always responds without an
 * error even when the address is unknown (so we never leak which emails exist),
 * so the UI just tells the user to check their inbox.
 */
export async function sendPasswordReset(email: string): Promise<void> {
  const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
    redirectTo: resetRedirectTo,
  });
  if (error) throw error;
}

/** True when an incoming URL is a Supabase password-recovery callback. */
export function isRecoveryUrl(url: string): boolean {
  return /type=recovery/i.test(url) || /reset-password/i.test(url);
}

/**
 * Establishes the short-lived recovery session from a recovery deep link.
 *
 * Web is a no-op: `detectSessionInUrl` (see lib/supabase.ts) already parses the
 * URL and fires the `PASSWORD_RECOVERY` auth event automatically. On native we
 * must parse the returned `code` / `access_token` ourselves. Returns true when a
 * session was created.
 */
export async function establishRecoverySession(url: string): Promise<boolean> {
  if (Platform.OS === "web") return true;
  return createSessionFromUrl(url);
}
