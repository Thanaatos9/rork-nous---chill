import Constants from "expo-constants";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { supabase } from "@/lib/supabase";

/**
 * Push notification token registration.
 *
 * The existing backend uses a Web Push (VAPID) `push_subscriptions` table with
 * `endpoint` / `p256dh` / `auth` columns. On mobile there is no browser
 * PushSubscription — instead Expo issues an Expo push token
 * (e.g. `ExponentPushToken[...]`). We store that token in the `endpoint`
 * column (it is trivially distinguishable from a web-push URL, which starts
 * with `https://`), leaving the VAPID key columns empty. A backend sender can
 * branch on the token shape to deliver through the Expo Push API.
 */

/** Resolve the EAS project id needed to mint an Expo push token. */
function getProjectId(): string | undefined {
  const fromExtra = Constants.expoConfig?.extra?.eas?.projectId as string | undefined;
  const fromEasConfig = (Constants as { easConfig?: { projectId?: string } }).easConfig?.projectId;
  return fromExtra ?? fromEasConfig ?? undefined;
}

/**
 * Requests permission (if needed) and returns the device's Expo push token, or
 * null when it cannot be obtained (simulator, denied permission, no EAS
 * project id). Never throws — push is always best-effort.
 */
export async function getExpoPushToken(): Promise<string | null> {
  try {
    // Cloud simulators and emulators cannot register for remote push.
    if (!Device.isDevice) return null;

    const settings = await Notifications.getPermissionsAsync();
    let granted = settings.granted;
    if (!granted && settings.canAskAgain) {
      const requested = await Notifications.requestPermissionsAsync();
      granted = requested.granted;
    }
    if (!granted) return null;

    const projectId = getProjectId();
    const token = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined,
    );
    return token.data ?? null;
  } catch {
    return null;
  }
}

/**
 * Registers this device's Expo push token for the given user, de-duplicating so
 * the same token is never stored twice.
 */
export async function registerPushToken(userId: string): Promise<void> {
  const token = await getExpoPushToken();
  if (!token) return;
  try {
    const { data: existing } = await supabase
      .from("push_subscriptions")
      .select("id")
      .eq("user_id", userId)
      .eq("endpoint", token)
      .maybeSingle();
    if (existing) return;

    await supabase.from("push_subscriptions").insert({
      user_id: userId,
      endpoint: token,
      p256dh: "",
      auth: "",
    });
  } catch {
    // Best-effort: RLS or a schema mismatch should never crash the app.
  }
}

/** Removes this device's Expo push token for the given user (e.g. on sign-out). */
export async function unregisterPushToken(userId: string): Promise<void> {
  try {
    const token = await getExpoPushToken();
    if (!token) return;
    await supabase
      .from("push_subscriptions")
      .delete()
      .eq("user_id", userId)
      .eq("endpoint", token);
  } catch {
    // Best-effort.
  }
}
