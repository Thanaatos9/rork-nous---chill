import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useVideoPlayer, VideoView } from "expo-video";
import { ChevronLeft, Clapperboard, Film, Lock, Share2, Sparkles, Users } from "lucide-react-native";
import React from "react";
import { Alert, RefreshControl, Share, View } from "react-native";
import { Button, IconButton } from "@/components/ui/Button";
import { Card, Screen } from "@/components/ui/Card";
import { Loader } from "@/components/ui/Feedback";
import { FadeIn, Pulse } from "@/components/ui/motion";
import { AppText } from "@/components/ui/Text";
import { colors, radius, spacing } from "@/constants/theme";
import { friendlyError } from "@/lib/errors";
import { formatDate, getSeasonStatus } from "@/lib/format";
import type { Synthese } from "@/lib/types";
import { isOwner } from "@/lib/types";
import { useEpisodes } from "@/hooks/useEpisodes";
import { useMembers } from "@/hooks/useMembers";
import { useSynthese } from "@/hooks/useProfile";
import { useSpace, useUpdateSpace } from "@/hooks/useSpaces";
import { useToast } from "@/providers/toast";

function extractSummary(synthese: Synthese | null | undefined): string | null {
  if (!synthese) return null;
  const skip = new Set(["id", "space_id", "video_url", "created_at", "updated_at"]);
  for (const [key, value] of Object.entries(synthese)) {
    if (skip.has(key)) continue;
    if (typeof value === "string" && value.trim().length > 20) return value.trim();
  }
  return null;
}

function SouvenirVideo({ url }: { url: string }) {
  const player = useVideoPlayer(url, (p) => {
    p.loop = false;
  });
  return <VideoView player={player} style={{ width: "100%", aspectRatio: 16 / 9, borderRadius: radius.lg, backgroundColor: "#000" }} nativeControls contentFit="contain" />;
}

function StatBox({ label, value, icon }: { label: string; value: number; icon: React.ReactNode }) {
  return (
    <Card style={{ flex: 1, alignItems: "center", gap: 4, paddingVertical: spacing.lg }}>
      {icon}
      <AppText style={{ fontSize: 24, fontWeight: "800", color: colors.text }}>{value}</AppText>
      <AppText variant="caption">{label}</AppText>
    </Card>
  );
}

export default function RecapScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const toast = useToast();

  const { data: space, isLoading, refetch, isRefetching } = useSpace(id);
  const { data: episodes } = useEpisodes(id);
  const { data: members } = useMembers(id);
  const unlocked = !!space?.season_unlocked;
  const { data: synthese } = useSynthese(id, unlocked);
  const updateSpace = useUpdateSpace();

  if (isLoading || !space) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg }}>
        <Loader label="Chargement du bilan…" />
      </View>
    );
  }

  const status = getSeasonStatus(space);
  const owner = isOwner(space.membership);

  const onUnlock = () => {
    Alert.alert(
      "Débloquer la saison ?",
      "Toutes les reviews privées seront révélées à l'ensemble du groupe. Cette action lance le grand moment de vérité 🎬",
      [
        { text: "Annuler", style: "cancel" },
        {
          text: "Débloquer",
          style: "destructive",
          onPress: async () => {
            try {
              await updateSpace.mutateAsync({ spaceId: id, patch: { season_unlocked: true } });
              toast.success("Saison débloquée 🎉");
            } catch (e) {
              toast.error(friendlyError(e));
            }
          },
        },
      ]
    );
  };

  const shareRecap = async () => {
    await Share.share({ message: `On vient de débloquer le bilan de « ${space.name} » sur Gather 🎬✨` });
  };

  const summary = extractSummary(synthese);

  return (
    <Screen scroll contentStyle={{ paddingHorizontal: spacing.lg }} refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.primary} />}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md, paddingTop: spacing.sm, marginBottom: spacing.xl }}>
        <IconButton
          icon={<ChevronLeft size={22} color={colors.text} />}
          variant="secondary"
          size={40}
          onPress={() => (router.canGoBack() ? router.back() : router.replace("/"))}
        />
        <View style={{ flex: 1 }}>
          <AppText variant="title">Bilan de saison</AppText>
          <AppText variant="caption">{space.name}</AppText>
        </View>
      </View>

      {!unlocked ? (
        <FadeIn>
          <View
            style={{ borderRadius: radius.xxl, overflow: "hidden", borderWidth: 1, borderColor: colors.border }}
          >
            <LinearGradient colors={["#2A0E13", "#16100F"]} style={{ padding: spacing.xl, alignItems: "center", gap: spacing.lg }}>
              <Pulse>
                <View style={{ width: 96, height: 96, borderRadius: 48, backgroundColor: colors.primarySoft, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: colors.primary }}>
                  <Lock size={42} color={colors.primary} />
                </View>
              </Pulse>

              <View style={{ alignItems: "center", gap: 6 }}>
                <AppText variant="h2" center>Le bilan est scellé</AppText>
                <AppText variant="bodyMuted" center style={{ maxWidth: 320 }}>
                  {status.daysLeft && status.daysLeft > 0
                    ? `Encore ${status.daysLeft} jour${status.daysLeft > 1 ? "s" : ""} avant la révélation. Toutes les reviews seront dévoilées en même temps.`
                    : "La saison touche à sa fin. Place au grand moment de vérité."}
                </AppText>
              </View>

              {status.daysLeft !== null ? (
                <View style={{ flexDirection: "row", alignItems: "baseline", gap: 8 }}>
                  <AppText style={{ fontSize: 56, fontWeight: "800", color: "#fff", letterSpacing: -2 }}>{status.daysLeft}</AppText>
                  <AppText variant="h3" style={{ color: colors.textMuted }}>jours</AppText>
                </View>
              ) : null}

              {space.season_end ? (
                <AppText variant="caption">Fin prévue le {formatDate(space.season_end)}</AppText>
              ) : null}
            </LinearGradient>
          </View>

          <View style={{ marginTop: spacing.xl }}>
            {owner ? (
              <Button title="Débloquer la saison maintenant" icon={<Sparkles size={18} color={colors.primaryFg} />} onPress={onUnlock} loading={updateSpace.isPending} size="lg" />
            ) : (
              <Card style={{ flexDirection: "row", gap: 10, alignItems: "center" }}>
                <Lock size={18} color={colors.textMuted} />
                <AppText variant="bodyMuted" style={{ flex: 1 }}>Seul le propriétaire peut débloquer la saison. Patience, le grand moment approche !</AppText>
              </Card>
            )}
          </View>

          <View style={{ flexDirection: "row", gap: spacing.md, marginTop: spacing.xl }}>
            <StatBox label="Épisodes" value={episodes?.length ?? 0} icon={<Clapperboard size={18} color={colors.primary} />} />
            <StatBox label="Membres" value={members?.length ?? 0} icon={<Users size={18} color={colors.accent} />} />
          </View>
        </FadeIn>
      ) : (
        <FadeIn>
          <View style={{ gap: spacing.xxl }}>
            <View style={{ alignItems: "center", gap: spacing.sm }}>
              <View style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: colors.accentSoft, alignItems: "center", justifyContent: "center" }}>
                <Sparkles size={36} color={colors.accent} />
              </View>
              <AppText variant="h2" center>Saison révélée ✨</AppText>
              <AppText variant="bodyMuted" center style={{ maxWidth: 320 }}>Toutes les reviews sont désormais visibles. Replongez dans vos épisodes pour les découvrir.</AppText>
            </View>

            {synthese?.video_url ? (
              <View style={{ gap: spacing.sm }}>
                <AppText variant="overline">Votre vidéo souvenir</AppText>
                <SouvenirVideo url={synthese.video_url} />
              </View>
            ) : null}

            {summary ? (
              <Card elevated style={{ gap: spacing.sm }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <Film size={16} color={colors.accent} />
                  <AppText variant="overline">La synthèse de votre saison</AppText>
                </View>
                <AppText variant="body" style={{ lineHeight: 23 }}>{summary}</AppText>
              </Card>
            ) : !synthese?.video_url ? (
              <Card style={{ alignItems: "center", gap: 6 }}>
                <Film size={22} color={colors.textMuted} />
                <AppText variant="bodyMuted" center>La synthèse et la vidéo souvenir seront générées sous peu.</AppText>
              </Card>
            ) : null}

            <View style={{ flexDirection: "row", gap: spacing.md }}>
              <StatBox label="Épisodes" value={episodes?.length ?? 0} icon={<Clapperboard size={18} color={colors.primary} />} />
              <StatBox label="Membres" value={members?.length ?? 0} icon={<Users size={18} color={colors.accent} />} />
            </View>

            <View style={{ gap: spacing.md }}>
              <Button title="Revoir les épisodes" variant="secondary" icon={<Clapperboard size={18} color={colors.text} />} onPress={() => router.push({ pathname: "/space/[id]/episodes", params: { id } })} />
              <Button title="Partager le bilan" variant="gold" icon={<Share2 size={18} color="#1A1607" />} onPress={shareRecap} />
            </View>
          </View>
        </FadeIn>
      )}
    </Screen>
  );
}
