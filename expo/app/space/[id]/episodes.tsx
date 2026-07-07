import { useLocalSearchParams, useRouter } from "expo-router";
import { ChevronLeft, Clapperboard, LayoutGrid, Plus, Rows3 } from "lucide-react-native";
import React, { useState } from "react";
import { Dimensions, RefreshControl, View } from "react-native";
import { EpisodePoster, EpisodeRow } from "@/components/EpisodeCard";
import { IconButton } from "@/components/ui/Button";
import { Screen } from "@/components/ui/Card";
import { EmptyState, Loader } from "@/components/ui/Feedback";
import { FadeIn, PressableScale } from "@/components/ui/motion";
import { AppText } from "@/components/ui/Text";
import { colors, radius, spacing } from "@/constants/theme";
import { canParticipate } from "@/lib/types";
import { useEpisodes } from "@/hooks/useEpisodes";
import { useSpace } from "@/hooks/useSpaces";

type ViewMode = "grid" | "timeline";

const SCREEN_WIDTH = Dimensions.get("window").width;
const CARD_WIDTH = (SCREEN_WIDTH - spacing.lg * 2 - spacing.md) / 2;

function ModeToggle({ mode, onChange }: { mode: ViewMode; onChange: (m: ViewMode) => void }) {
  return (
    <View style={{ flexDirection: "row", backgroundColor: colors.card, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: 3 }}>
      {(["grid", "timeline"] as ViewMode[]).map((m) => {
        const active = mode === m;
        const Icon = m === "grid" ? LayoutGrid : Rows3;
        return (
          <PressableScale
            key={m}
            onPress={() => onChange(m)}
            withHaptic={false}
            style={{ flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 14, paddingVertical: 7, borderRadius: radius.sm, backgroundColor: active ? colors.surface : "transparent" }}
          >
            <Icon size={15} color={active ? colors.text : colors.textFaint} />
            <AppText style={{ fontSize: 13, fontWeight: "600", color: active ? colors.text : colors.textFaint }}>{m === "grid" ? "Grille" : "Timeline"}</AppText>
          </PressableScale>
        );
      })}
    </View>
  );
}

export default function EpisodesScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { data: space } = useSpace(id);
  const { data: episodes, isLoading, refetch, isRefetching } = useEpisodes(id);
  const [mode, setMode] = useState<ViewMode>("grid");

  const participate = canParticipate(space?.membership);
  const openEpisode = (episodeId: string) => router.push({ pathname: "/episode/[episodeId]", params: { episodeId } });
  const create = () => router.push({ pathname: "/create-episode/[spaceId]", params: { spaceId: id } });

  return (
    <Screen
      scroll
      contentStyle={{ paddingHorizontal: spacing.lg }}
      refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.primary} />}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md, paddingTop: spacing.sm, marginBottom: spacing.lg }}>
        <IconButton
          icon={<ChevronLeft size={22} color={colors.text} />}
          variant="secondary"
          size={40}
          onPress={() => (router.canGoBack() ? router.back() : router.replace("/"))}
        />
        <View style={{ flex: 1 }}>
          <AppText variant="title">Épisodes</AppText>
          <AppText variant="caption">{episodes?.length ?? 0} moment{(episodes?.length ?? 0) > 1 ? "s" : ""} vécu{(episodes?.length ?? 0) > 1 ? "s" : ""}</AppText>
        </View>
        {participate ? <IconButton icon={<Plus size={22} color={colors.primaryFg} />} variant="primary" onPress={create} /> : null}
      </View>

      {isLoading ? (
        <Loader label="Chargement des épisodes…" />
      ) : !episodes || episodes.length === 0 ? (
        <EmptyState
          icon={<Clapperboard size={30} color={colors.primary} />}
          title="Pas encore d'épisode"
          subtitle={participate ? "Immortalise votre premier moment ensemble — ajoute des photos, un lieu, des tags." : "Les épisodes apparaîtront ici dès qu'un membre en créera un."}
          actionLabel={participate ? "Créer un épisode" : undefined}
          onAction={participate ? create : undefined}
        />
      ) : (
        <>
          <View style={{ alignItems: "flex-start", marginBottom: spacing.lg }}>
            <ModeToggle mode={mode} onChange={setMode} />
          </View>

          {mode === "grid" ? (
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.md }}>
              {episodes.map((ep, i) => (
                <EpisodePoster key={ep.id} episode={ep} width={CARD_WIDTH} index={i} onPress={() => openEpisode(ep.id)} />
              ))}
            </View>
          ) : (
            <View style={{ gap: spacing.md }}>
              {episodes.map((ep, i) => (
                <EpisodeRow key={ep.id} episode={ep} index={i} onPress={() => openEpisode(ep.id)} />
              ))}
            </View>
          )}
        </>
      )}
    </Screen>
  );
}
