import * as Notifications from "expo-notifications";
import { useRouter } from "expo-router";
import React, { useEffect } from "react";
import { Platform } from "react-native";
import { colors } from "@/constants/theme";
import { registerPushToken } from "@/lib/push";
import { useAuth } from "@/providers/auth";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: true,
  }),
});

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
