import { makeRedirectUri } from "expo-auth-session";
import * as QueryParams from "expo-auth-session/build/QueryParams";
import * as WebBrowser from "expo-web-browser";
import { Platform } from "react-native";
import { supabase } from "@/lib/supabase";

export type OAuthProvider = "google" | "apple";

/** Closes the popup/session on web after the redirect. No-op on native. */
WebBrowser.maybeCompleteAuthSession();

/**
 * Stable deep link the OAuth provider redirects back to. A dedicated path
 * (`auth-callback`) is used rather than the bare scheme to avoid a known
 * Supabase iOS PKCE bug that corrupts the auth code on bare custom schemes.
 * On web `makeRedirectUri` ignores `scheme` and returns the current origin.
 */
export const oauthRedirectTo: string = makeRedirectUri({
  scheme: "rork-app",
  path: "auth-callback",
});

/**
 * Turns the redirect URL returned by the browser into a Supabase session.
 * Handles both PKCE (`?code=…`) and implicit (`#access_token=…`) responses.
 */
async function createSessionFromUrl(url: string): Promise<boolean> {
  const { params, errorCode } = QueryParams.getQueryParams(url);
  if (errorCode) throw new Error(errorCode);

  const { access_token, refresh_token, code } = params;

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) throw error;
    return true;
  }

  if (access_token) {
    const { error } = await supabase.auth.setSession({
      access_token,
      refresh_token,
    });
    if (error) throw error;
    return true;
  }

  return false;
}

/**
 * Runs the full web-based OAuth flow for the given provider against Supabase.
 * Returns `true` when a session was created, `false` when the user cancelled.
 * Throws on any real error (provider not enabled, network, etc.).
 */
export async function signInWithOAuthProvider(provider: OAuthProvider): Promise<boolean> {
  // Web: a full-page redirect is the only reliable flow. Opening a popup (the
  // native path below) is blocked by virtually every browser, which is why the
  // buttons appeared to "do nothing". Supabase navigates the whole page to the
  // provider; on return, the session is picked up from the URL automatically
  // (see `detectSessionInUrl` in lib/supabase.ts).
  if (Platform.OS === "web") {
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: oauthRedirectTo },
    });
    if (error) throw error;
    // The browser is now navigating away; this line is effectively unreachable.
    return true;
  }

  // Native: open an in-app auth session, then exchange the returned code/token.
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo: oauthRedirectTo,
      skipBrowserRedirect: true,
    },
  });
  if (error) throw error;
  if (!data?.url) throw new Error("Impossible de démarrer la connexion.");

  const result = await WebBrowser.openAuthSessionAsync(data.url, oauthRedirectTo);

  if (result.type === "success" && result.url) {
    return createSessionFromUrl(result.url);
  }

  // "cancel" / "dismiss" — the user backed out of the browser.
  return false;
}
