import { useLocalSearchParams, useRouter } from "expo-router";
import { Lock, Music, X } from "lucide-react-native";
import { useEffect, useState } from "react";
import { View } from "react-native";
import { RatingStars } from "@/components/RatingStars";
import { Button, IconButton } from "@/components/ui/Button";
import { Card, Screen } from "@/components/ui/Card";
import { Field, Input } from "@/components/ui/Input";
import { FadeIn } from "@/components/ui/motion";
import { AppText } from "@/components/ui/Text";
import { colors, spacing } from "@/constants/theme";
import { friendlyError } from "@/lib/errors";
import { useEpisode } from "@/hooks/useEpisodes";
import { useMyReview, useUpsertReview, type ReviewValues } from "@/hooks/useReviews";
import { useToast } from "@/providers/toast";

export default function ReviewScreen() {
  const { episodeId } = useLocalSearchParams<{ episodeId: string }>();
  const router = useRouter();
  const toast = useToast();

  const { data: episode } = useEpisode(episodeId);
  const { data: myReview } = useMyReview(episodeId);
  const upsert = useUpsertReview();

  const [rating, setRating] = useState<number>(0);
  const [favorite, setFavorite] = useState<string>("");
  const [awkward, setAwkward] = useState<string>("");
  const [quote, setQuote] = useState<string>("");
  const [summary, setSummary] = useState<string>("");
  const [song, setSong] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);
  const [hydrated, setHydrated] = useState<boolean>(false);

  useEffect(() => {
    if (myReview && !hydrated) {
      setRating(myReview.rating ?? 0);
      setFavorite(myReview.favorite_moment ?? "");
      setAwkward(myReview.awkward_moment ?? "");
      setQuote(myReview.funny_quote ?? "");
      setSummary(myReview.summary ?? "");
      setSong(myReview.song ?? "");
      setHydrated(true);
    }
  }, [myReview, hydrated]);

  const onSubmit = async () => {
    if (!episode) return;
    if (rating === 0 && !favorite.trim() && !summary.trim()) {
      toast.error("Mets au moins une note ou quelques mots.");
      return;
    }
    setLoading(true);
    try {
      const values: ReviewValues = {
        // "rating" is NOT NULL in the DB; 0 stands for "no note given".
        rating,
        favorite_moment: favorite.trim() || null,
        awkward_moment: awkward.trim() || null,
        funny_quote: quote.trim() || null,
        summary: summary.trim() || null,
        song: song.trim() || null,
      };
      await upsert.mutateAsync({ episodeId, spaceId: episode.space_id, values });
      toast.success("Review enregistrée 🔒");
      router.back();
    } catch (e) {
      toast.error(friendlyError(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen scroll contentStyle={{ paddingHorizontal: spacing.lg }}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingTop: spacing.sm, marginBottom: spacing.lg }}>
        <View style={{ flex: 1, gap: 2 }}>
          <AppText variant="title">Ma review</AppText>
          <AppText variant="caption" numberOfLines={1}>
            {episode ? `Tes impressions sur « ${episode.title} »` : "Tes impressions, en privé"}
          </AppText>
        </View>
        <IconButton icon={<X size={20} color={colors.text} />} onPress={() => router.back()} size={40} />
      </View>

      <FadeIn>
        <Card glow style={{ flexDirection: "row", gap: 10, alignItems: "center", marginBottom: spacing.xl }}>
          <Lock size={16} color={colors.accent} />
          <AppText variant="caption" style={{ flex: 1, color: colors.textMuted }}>
            Personne ne verra ce que tu écris avant la fin de la saison — ni les autres membres, ni le
            propriétaire. Tout se révèle d&apos;un coup, en même temps.
          </AppText>
        </Card>
      </FadeIn>

      <FadeIn delay={80}>
        <View style={{ gap: spacing.xl }}>
          <View style={{ alignItems: "center", gap: spacing.sm }}>
            <AppText variant="overline">Ta note</AppText>
            <RatingStars value={rating} onChange={setRating} size={34} gap={8} />
          </View>

          <Field label="🤩 Ton moment préféré">
            <Input placeholder="Quand on a…" value={favorite} onChangeText={setFavorite} multiline />
          </Field>

          <Field label="😬 Le moment gênant">
            <Input placeholder="Un petit malaise mémorable ?" value={awkward} onChangeText={setAwkward} multiline />
          </Field>

          <Field label="😂 La citation drôle">
            <Input placeholder="« … »" value={quote} onChangeText={setQuote} multiline />
          </Field>

          <Field label="📝 Ton résumé">
            <Input placeholder="En quelques mots, ce que tu retiens…" value={summary} onChangeText={setSummary} multiline />
          </Field>

          <Field label="Le son de ce moment">
            <Input icon={<Music size={18} color={colors.textFaint} />} placeholder="Titre ou lien musique" value={song} onChangeText={setSong} autoCapitalize="none" />
          </Field>

          <Button title="Enregistrer ma review" size="lg" onPress={onSubmit} loading={loading} />
        </View>
      </FadeIn>
    </Screen>
  );
}
