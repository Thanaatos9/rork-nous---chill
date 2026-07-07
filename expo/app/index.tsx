import { useFocusEffect, useRouter } from "expo-router";
import { Bell, Plus, Sparkles, Ticket } from "lucide-react-native";
import { useCallback } from "react";
import { RefreshControl, TouchableOpacity, View } from "react-native";
import { AppHeader } from "@/components/AppHeader";
import { SpaceCard } from "@/components/SpaceCard";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { Screen, SectionHeader } from "@/components/ui/Card";
import { EmptyState, Loader } from "@/components/ui/Feedback";
import { FadeIn, PressableScale } from "@/components/ui/motion";
import { AppText } from "@/components/ui/Text";
import { colors, radius, spacing } from "@/constants/theme";
import { hasSeenOnboarding } from "@/lib/onboarding";
import { clearPendingInvite, getPendingInvite } from "@/lib/pendingInvite";
import { useUnreadCount } from "@/hooks/useNotifications";
import { useMySpaces } from "@/hooks/useSpaces";
import { useAuth } from "@/providers/auth";

export default function HomeScreen() {
  const router = useRouter();
  const { profile, userId } = useAuth();
  const { data: spaces, isLoading, refetch, isRefetching } = useMySpaces();
  const unread = useUnreadCount();

  // First visit → welcome tutorial. Once seen, resume any pending invite.
  // useFocusEffect (not useEffect) so the invite is consumed when the user
  // comes back from the tutorial.
  useFocusEffect(
    useCallback(() => {
      let active = true;
      (async () => {
        if (!userId) return;
        const seen = await hasSeenOnboarding(userId);
        if (!active) return;
        if (!seen) {
          router.push("/onboarding");
          return;
        }
        const code = await getPendingInvite();
        if (active && code) {
          await clearPendingInvite();
          router.push({ pathname: "/join", params: { code } });
        }
      })();
      return () => {
        active = false;
      };
    }, [userId, router])
  );

  const firstName = profile?.name?.split(" ")[0] ?? "toi";

  return (
    <Screen
      scroll
      contentStyle={{ paddingHorizontal: spacing.lg }}
      refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.primary} />}
    >
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingTop: spacing.sm, marginBottom: spacing.xl }}>
        <View style={{ flex: 1 }}>
          <AppText variant="caption" style={{ color: colors.textMuted }}>SALUT 👋</AppText>
          <AppText variant="title" numberOfLines={1}>{firstName}</AppText>
        </View>
        <View style={{ flexDirection: "row", gap: spacing.sm }}>
          <PressableScale
            onPress={() => router.push("/notifications")}
            scaleTo={0.9}
            style={{ width: 44, height: 44, borderRadius: radius.pill, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, alignItems: "center", justifyContent: "center" }}
          >
            <Bell size={20} color={colors.text} />
            {unread > 0 ? (
              <View style={{ position: "absolute", top: 8, right: 8, minWidth: 9, height: 9, borderRadius: 5, backgroundColor: colors.primary, borderWidth: 1.5, borderColor: colors.card }} />
            ) : null}
          </PressableScale>
          <PressableScale onPress={() => router.push("/settings")} scaleTo={0.9}>
            <Avatar profile={profile} size={44} />
          </PressableScale>
        </View>
      </View>

      <FadeIn>
        <View style={{ flexDirection: "row", gap: spacing.md, marginBottom: spacing.xxl }}>
          <Button title="Créer" icon={<Plus size={18} color={colors.primaryFg} />} onPress={() => router.push("/create-space")} style={{ flex: 1 }} />
          <Button title="Rejoindre" variant="secondary" icon={<Ticket size={18} color={colors.text} />} onPress={() => router.push("/join")} style={{ flex: 1 }} />
        </View>
      </FadeIn>

      <SectionHeader title="Tes espaces" />

      {isLoading ? (
        <Loader label="Chargement de tes aventures…" />
      ) : !spaces || spaces.length === 0 ? (
        <EmptyState
          icon={<Sparkles size={30} color={colors.primary} />}
          title="Aucun espace pour l'instant"
          subtitle="Crée ta première aventure partagée, ou rejoins celle d'un proche avec un code d'invitation."
          actionLabel="Créer un espace"
          onAction={() => router.push("/create-space")}
        />
      ) : (
        <View style={{ gap: spacing.lg }}>
          {spaces.map((space, index) => (
            <SpaceCard
              key={space.id}
              space={space}
              index={index}
              onPress={() => router.push({ pathname: "/space/[id]", params: { id: space.id } })}
            />
          ))}
          <TouchableOpacity
            onPress={() => router.push("/join")}
            style={{ alignItems: "center", paddingVertical: spacing.lg }}
          >
            <AppText style={{ color: colors.textMuted, fontWeight: "600" }}>+ Rejoindre un autre espace</AppText>
          </TouchableOpacity>
        </View>
      )}
    </Screen>
  );
}
