import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ChevronLeft, Lightbulb, Lock, Plus, Settings, Sparkles, Users } from "lucide-react-native";
import React from "react";
import { RefreshControl, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { EpisodePoster } from "@/components/EpisodeCard";
import { ObserverNotice, PendingObserversNotice } from "@/components/ObserverNotice";
import { AvatarStack } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { Button, IconButton } from "@/components/ui/Button";
import { Card, SectionHeader } from "@/components/ui/Card";
import { Loader } from "@/components/ui/Feedback";
import { FadeIn, PressableScale, Pulse } from "@/components/ui/motion";
import { AppText } from "@/components/ui/Text";
import { colors, radius, shadows, spacing } from "@/constants/theme";
import { formatDate, getSeasonStatus } from "@/lib/format";
import { canParticipate, effectiveRole, isOwner } from "@/lib/types";
import { useEpisodes } from "@/hooks/useEpisodes";
import { useMembers } from "@/hooks/useMembers";
import { useIdeas } from "@/hooks/useSocial";
import { useSpace } from "@/hooks/useSpaces";

function StatTile({ label, value, icon, onPress }: { label: string; value: number; icon: React.ReactNode; onPress: () => void }) {
  return (
    <PressableScale onPress={onPress} scaleTo={0.95} style={{ flex: 1, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, paddingVertical: spacing.md, alignItems: "center", gap: 4 }}>
      {icon}
      <AppText style={{ fontSize: 22, fontWeight: "800", color: colors.text }}>{value}</AppText>
      <AppText variant="caption">{label}</AppText>
    </PressableScale>
  );
}

export default function SpaceDashboard() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const { data: space, isLoading, refetch, isRefetching } = useSpace(id);
  const { data: episodes } = useEpisodes(id);
  const { data: members } = useMembers(id);
  const { data: ideas } = useIdeas(id);

  if (isLoading || !space) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg }}>
        <Loader label="Ouverture de l'espace…" />
      </View>
    );
  }

  const status = getSeasonStatus(space);
  const owner = isOwner(space.membership);
  const participate = canParticipate(space.membership);
  const featured = (episodes ?? []).slice(0, 8);

  // Role limbo, surfaced on both sides: the newcomer learns why things are
  // greyed out, the owner learns someone is waiting on them.
  const isObserver = effectiveRole(space.membership) === "observer";
  const ownerName = (members ?? []).find((m) => m.role === "owner")?.profile?.name ?? null;
  const pendingObservers = owner
    ? (members ?? []).filter((m) => m.role !== "owner" && effectiveRole(m) === "observer").length
    : 0;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: spacing.xxxl }}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.primary} progressViewOffset={insets.top + 40} />}
      >
        {/* Hero */}
        <View style={{ height: 300 }}>
          {space.cover_url ? (
            <Image source={{ uri: space.cover_url }} style={{ position: "absolute", width: "100%", height: "100%" }} contentFit="cover" transition={250} />
          ) : (
            <LinearGradient colors={["#3A1418", "#1A1012"]} style={{ position: "absolute", width: "100%", height: "100%" }} />
          )}
          <LinearGradient colors={["rgba(8,8,9,0.4)", "rgba(8,8,9,0.1)", colors.bg]} locations={[0, 0.45, 1]} style={{ position: "absolute", width: "100%", height: "100%" }} />

          <View style={{ position: "absolute", top: insets.top + 6, left: spacing.lg, right: spacing.lg, flexDirection: "row", justifyContent: "space-between" }}>
            <IconButton icon={<ChevronLeft size={22} color="#fff" />} onPress={() => router.back()} size={42} style={{ backgroundColor: "rgba(0,0,0,0.4)" }} />
            {owner ? (
              <IconButton icon={<Settings size={20} color="#fff" />} onPress={() => router.push({ pathname: "/space-settings/[spaceId]", params: { spaceId: id } })} size={42} style={{ backgroundColor: "rgba(0,0,0,0.4)" }} />
            ) : null}
          </View>

          <View style={{ position: "absolute", bottom: spacing.lg, left: spacing.lg, right: spacing.lg, gap: spacing.sm }}>
            {status.state === "unlocked" ? (
              <Badge label="Saison débloquée" tone="gold" icon={<Sparkles size={12} color={colors.accent} />} />
            ) : (
              <Badge label={status.label} tone={status.state === "ending" || status.state === "ended" ? "primary" : "muted"} />
            )}
            <AppText style={{ fontSize: 30, fontWeight: "800", letterSpacing: -0.8, color: "#fff" }} numberOfLines={2}>
              {space.name}
            </AppText>
            {space.description ? (
              <AppText numberOfLines={2} style={{ color: "rgba(255,255,255,0.75)", fontSize: 14.5, fontWeight: "500" }}>
                {space.description}
              </AppText>
            ) : null}
          </View>
        </View>

        <View style={{ paddingHorizontal: spacing.lg, gap: spacing.xxl, marginTop: spacing.lg }}>
          {/* Role limbo — highest position on purpose: it explains why the rest
              of the screen is partly out of reach. */}
          {isObserver ? (
            <FadeIn>
              <ObserverNotice spaceName={space.name} ownerName={ownerName} />
            </FadeIn>
          ) : null}

          {pendingObservers > 0 ? (
            <FadeIn>
              <PendingObserversNotice
                count={pendingObservers}
                onManage={() => router.push({ pathname: "/space/[id]/members", params: { id } })}
              />
            </FadeIn>
          ) : null}

          {/* Season card */}
          <FadeIn>
            <Card elevated style={{ gap: spacing.md }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                <AppText variant="overline">Saison</AppText>
                <AppText variant="caption">
                  {space.season_start ? formatDate(space.season_start) : "—"} → {space.season_end ? formatDate(space.season_end) : "—"}
                </AppText>
              </View>

              <View style={{ height: 7, backgroundColor: colors.surface, borderRadius: radius.pill, overflow: "hidden" }}>
                <LinearGradient colors={[colors.primary, colors.primaryDark]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ width: `${Math.max(4, status.progress * 100)}%`, height: "100%" }} />
              </View>

              {status.state === "unlocked" ? (
                <Button title="Voir le bilan de la saison" variant="gold" icon={<Sparkles size={18} color="#1A1607" />} onPress={() => router.push({ pathname: "/space/[id]/recap", params: { id } })} />
              ) : status.state === "ended" ? (
                owner ? (
                  <Pulse>
                    <Button title="Débloquer la saison" icon={<Lock size={18} color={colors.primaryFg} />} onPress={() => router.push({ pathname: "/space/[id]/recap", params: { id } })} fullWidth />
                  </Pulse>
                ) : (
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8, justifyContent: "center", paddingVertical: 6 }}>
                    <Lock size={15} color={colors.textMuted} />
                    <AppText variant="bodyMuted">En attente du déverrouillage par le propriétaire</AppText>
                  </View>
                )
              ) : (
                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                  <AppText variant="bodyMuted">{status.daysLeft !== null ? `${status.daysLeft} j avant la révélation` : "Saison en cours"}</AppText>
                  <Button title="Aperçu du bilan" variant="ghost" size="sm" onPress={() => router.push({ pathname: "/space/[id]/recap", params: { id } })} />
                </View>
              )}
            </Card>
          </FadeIn>

          {/* Stats */}
          <FadeIn delay={80}>
            <View style={{ flexDirection: "row", gap: spacing.md }}>
              <StatTile label="Épisodes" value={episodes?.length ?? 0} icon={<Sparkles size={18} color={colors.primary} />} onPress={() => router.push({ pathname: "/space/[id]/episodes", params: { id } })} />
              <StatTile label="Membres" value={members?.length ?? 0} icon={<Users size={18} color={colors.accent} />} onPress={() => router.push({ pathname: "/space/[id]/members", params: { id } })} />
              <StatTile label="Idées" value={ideas?.length ?? 0} icon={<Lightbulb size={18} color="#5B8DEF" />} onPress={() => router.push({ pathname: "/space/[id]/ideas", params: { id } })} />
            </View>
          </FadeIn>

          {/* Featured episodes */}
          <FadeIn delay={140}>
            <View>
              <SectionHeader
                title="À la une"
                action={
                  <PressableScale onPress={() => router.push({ pathname: "/space/[id]/episodes", params: { id } })} withHaptic={false}>
                    <AppText style={{ color: colors.primary, fontWeight: "700", fontSize: 13 }}>Tout voir</AppText>
                  </PressableScale>
                }
              />
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.md, paddingRight: spacing.sm }}>
                {participate ? (
                  <PressableScale
                    onPress={() => router.push({ pathname: "/create-episode/[spaceId]", params: { spaceId: id } })}
                    scaleTo={0.96}
                    style={[{ width: 144, height: 216, borderRadius: radius.lg, borderWidth: 1.5, borderColor: colors.borderStrong, borderStyle: "dashed", backgroundColor: colors.card, alignItems: "center", justifyContent: "center", gap: 10 }]}
                  >
                    <View style={{ width: 46, height: 46, borderRadius: 23, backgroundColor: colors.primarySoft, alignItems: "center", justifyContent: "center" }}>
                      <Plus size={24} color={colors.primary} />
                    </View>
                    <AppText style={{ color: colors.textMuted, fontWeight: "600", fontSize: 13 }}>Nouvel épisode</AppText>
                  </PressableScale>
                ) : null}
                {featured.map((ep, i) => (
                  <EpisodePoster key={ep.id} episode={ep} index={i} onPress={() => router.push({ pathname: "/episode/[episodeId]", params: { episodeId: ep.id } })} />
                ))}
                {featured.length === 0 && !participate ? (
                  <View style={{ width: 240, height: 216, borderRadius: radius.lg, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, alignItems: "center", justifyContent: "center", padding: spacing.lg }}>
                    <AppText variant="bodyMuted" center>Aucun épisode pour l&apos;instant.</AppText>
                  </View>
                ) : null}
              </ScrollView>
            </View>
          </FadeIn>

          {/* Members preview */}
          <FadeIn delay={200}>
            <PressableScale onPress={() => router.push({ pathname: "/space/[id]/members", params: { id } })} scaleTo={0.98} style={[{ flexDirection: "row", alignItems: "center", gap: spacing.md, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, padding: spacing.md }, shadows.card]}>
              <AvatarStack profiles={(members ?? []).map((m) => m.profile)} size={34} />
              <View style={{ flex: 1 }}>
                <AppText variant="h3">{members?.length ?? 0} membre{(members?.length ?? 0) > 1 ? "s" : ""}</AppText>
                <AppText variant="caption">{owner ? "Gère les rôles et les invitations" : "Voir qui partage l'aventure"}</AppText>
              </View>
              <AppText style={{ color: colors.primary, fontWeight: "700", fontSize: 13 }}>{owner ? "Gérer" : "Voir"}</AppText>
            </PressableScale>
          </FadeIn>
        </View>
      </ScrollView>
    </View>
  );
}
