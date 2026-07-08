import { QueryClientProvider } from "@tanstack/react-query";
import * as Linking from "expo-linking";
import { Stack, useRouter, useSegments } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import React, { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { BrandSplash } from "@/components/BrandSplash";
import { AppText } from "@/components/ui/Text";
import { colors, spacing } from "@/constants/theme";
import { hasSupabaseConfig } from "@/lib/supabase";
import { queryClient } from "@/lib/queryClient";
import { setPendingInvite } from "@/lib/pendingInvite";
import { AuthProvider, useAuth } from "@/providers/auth";
import { NotificationsProvider } from "@/providers/notifications";
import { ThemeProvider, useThemeMode } from "@/providers/theme";
import { ToastProvider, ToastViewport } from "@/providers/toast";

SplashScreen.preventAutoHideAsync();

function RootNav() {
  const { isAuthenticated, initializing } = useAuth();
  const { resolved } = useThemeMode();
  const segments = useSegments();
  const router = useRouter();
  const [splashVisible, setSplashVisible] = useState<boolean>(true);

  // Auth routing gate.
  useEffect(() => {
    if (initializing) return;
    SplashScreen.hideAsync().catch(() => {});
    const inAuthGroup = segments[0] === "(auth)";
    if (!isAuthenticated && !inAuthGroup) {
      router.replace("/login");
    } else if (isAuthenticated && inAuthGroup) {
      router.replace("/");
    }
  }, [isAuthenticated, initializing, segments, router]);

  // Warm-start invite deep links (app already running). Cold-start links are
  // handled by app/+native-intent.tsx before the tree mounts.
  useEffect(() => {
    const sub = Linking.addEventListener("url", (e) => {
      const parsed = Linking.parse(e.url);
      const code = typeof parsed.queryParams?.code === "string" ? parsed.queryParams.code : null;
      const isJoin = (parsed.path ?? "").toLowerCase().includes("join");
      if (code && isJoin) {
        setPendingInvite(code);
        if (isAuthenticated) {
          router.push({ pathname: "/join", params: { code } });
        }
      }
    });
    return () => sub.remove();
  }, [isAuthenticated, router]);

  return (
    // Remounting on scheme change lets every inline style pick up the new palette.
    <View key={`theme-${resolved}`} style={{ flex: 1, backgroundColor: colors.bg }}>
      <StatusBar style={resolved === "dark" ? "light" : "dark"} />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }}>
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="index" />
        <Stack.Screen name="onboarding" options={{ presentation: "fullScreenModal", gestureEnabled: false, animation: "fade" }} />
        <Stack.Screen name="space/[id]" />
        <Stack.Screen name="space-settings/[spaceId]" options={{ presentation: "modal" }} />
        <Stack.Screen name="episode/[episodeId]" />
        <Stack.Screen name="notifications" />
        <Stack.Screen name="settings" />
        <Stack.Screen name="create-space" options={{ presentation: "modal" }} />
        <Stack.Screen name="join" options={{ presentation: "modal" }} />
        <Stack.Screen name="review/[episodeId]" options={{ presentation: "modal" }} />
        <Stack.Screen name="create-episode/[spaceId]" options={{ presentation: "modal" }} />
      </Stack>
      {splashVisible ? (
        <BrandSplash done={!initializing} onHidden={() => setSplashVisible(false)} />
      ) : null}
    </View>
  );
}

/** Shown only if the Supabase env vars failed to load (e.g. before a rebuild). */
function ConfigMissing() {
  return (
    <View style={styles.configRoot}>
      <StatusBar style="light" />
      <View style={styles.configBadge}>
        <AppText variant="display" color={colors.primary}>
          G
        </AppText>
      </View>
      <AppText variant="h2" center style={styles.configTitle}>
        Configuration en cours
      </AppText>
      <AppText variant="bodyMuted" center>
        La connexion au serveur n&apos;est pas encore prête. Ferme et rouvre
        l&apos;application dans un instant — tout devrait fonctionner.
      </AppText>
    </View>
  );
}

export default function RootLayout() {
  if (!hasSupabaseConfig) {
    return (
      <GestureHandlerRootView style={{ flex: 1 }}>
        <SafeAreaProvider>
          <ConfigMissing />
        </SafeAreaProvider>
      </GestureHandlerRootView>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <GestureHandlerRootView style={{ flex: 1 }}>
          <SafeAreaProvider>
            <AuthProvider>
              <ToastProvider>
                <NotificationsProvider>
                  <RootNav />
                  <ToastViewport />
                </NotificationsProvider>
              </ToastProvider>
            </AuthProvider>
          </SafeAreaProvider>
        </GestureHandlerRootView>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

const styles = StyleSheet.create({
  configRoot: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.bg,
    paddingHorizontal: spacing.xxl,
    gap: spacing.md,
  },
  configBadge: {
    width: 72,
    height: 72,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primarySoft,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.sm,
  },
  configTitle: {
    marginBottom: spacing.xs,
  },
});
