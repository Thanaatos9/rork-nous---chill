import { useRouter } from "expo-router";
import React, { useEffect } from "react";
import { Platform } from "react-native";
import { colors } from "@/constants/theme";
import { loadNotifications, registerPushToken } from "@/lib/push";
import { useAuth } from "@/providers/auth";

/**
 * Sets up local notification handling: permissions, an Android channel, and
 * routing when the user taps a notification. Defensive so it never crashes the
 * app in Expo Go or the cloud simulator.
 */
export function NotificationsProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { userId } = useAuth();

  // Register this device's Expo push token whenever a user is signed in.
  useEffect(() => {
    if (!userId) return;
    registerPushToken(userId);
  }, [userId]);

  useEffect(() => {
    // The web has its own delivery path end to end: the service worker receives
    // the push and handles the click (see public/sw.js). expo-notifications has
    // nothing to add there, and asking it for permissions would pop the browser
    // prompt on load — which is both rude and, in Chrome, a good way to get
    // push denied permanently. The switch in Réglages asks instead.
    if (Platform.OS === "web") return;

    // Null in Expo Go, where notifications are unavailable anyway.
    const Notifications = loadNotifications();
    if (!Notifications) return;

    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: false,
        shouldSetBadge: true,
      }),
    });

    (async () => {
      try {
        if (Platform.OS === "android") {
          await Notifications.setNotificationChannelAsync("default", {
            name: "Gather",
            importance: Notifications.AndroidImportance.DEFAULT,
            lightColor: colors.primary,
            vibrationPattern: [0, 120, 80, 120],
          });
        }
        const settings = await Notifications.getPermissionsAsync();
        if (!settings.granted && settings.canAskAgain) {
          await Notifications.requestPermissionsAsync();
        }
      } catch {
        // Notifications are best-effort; ignore failures in restricted runtimes.
      }
    })();

    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data as { url?: string } | undefined;
      try {
        if (data?.url) {
          router.push(data.url as never);
        } else {
          router.push("/notifications");
        }
      } catch {
        // Ignore navigation errors from background taps.
      }
    });

    return () => sub.remove();
  }, [router]);

  return <>{children}</>;
}
