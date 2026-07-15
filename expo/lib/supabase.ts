import "react-native-url-polyfill/auto";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient } from "@supabase/supabase-js";
import { AppState, Platform } from "react-native";

/**
 * Connects to the existing "Gather" Supabase backend.
 * Credentials come from public env vars (EXPO_PUBLIC_*) so nothing is hardcoded
 * in source. The anon key is a public client key by design — it ships inside the
 * app and is guarded server-side by Row Level Security, not by being kept secret.
 */
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? "";
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? "";

/**
 * True only when both public env vars were inlined at build time. The UI gates
 * on this and shows a setup screen instead of crashing the whole app.
 */
export const hasSupabaseConfig: boolean = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

export const MEDIA_BUCKET = "episode-media";

// Harmless non-functional placeholders keep createClient from throwing at import
// time when config is missing (a throw here would white-screen the entire app).
// These are NOT real credentials — the real values come from EXPO_PUBLIC_* env vars.
export const supabase = createClient(
  SUPABASE_URL || "https://placeholder.supabase.co",
  SUPABASE_ANON_KEY || "public-anon-placeholder",
  {
    auth: {
      storage: AsyncStorage,
      autoRefreshToken: true,
      persistSession: true,
      // Web uses a full-page OAuth redirect, so the client must parse the
      // returning URL to establish the session. Native handles the code/token
      // manually after an in-app browser session, so it stays disabled there.
      detectSessionInUrl: Platform.OS === "web",
    },
  },
);

// Keep the session token fresh while the app is foregrounded.
if (Platform.OS !== "web") {
  AppState.addEventListener("change", (state) => {
    if (state === "active") {
      supabase.auth.startAutoRefresh();
    } else {
      supabase.auth.stopAutoRefresh();
    }
  });
}
