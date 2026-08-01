import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { Lock, Music, X } from "lucide-react-native";
import { useEffect, useRef, useState } from "react";
import { Alert, View } from "react-native";
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
  const [formError, setFormError] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState<boolean>(false);

  /** What was on screen when the form settled — anything else means unsaved work. */
  const baseline = useRef({ rating: 0, favorite: "", awkward: "", quote: "", summary: "", song: "" });

  useEffect(() => {
    if (myReview && !hydrated) {
      const loaded = {
        rating: myReview.rating ?? 0,
        favorite: myReview.favorite_moment ?? "",
        awkward: myReview.awkward_moment ?? "",
        quote: myReview.funny_quote ?? "",
        summary: myReview.summary ?? "",
        song: myReview.song ?? "",
      };
      setRating(loaded.rating);
      setFavorite(loaded.favorite);
      setAwkward(loaded.awkward);
      setQuote(loaded.quote);
      setSummary(loaded.summary);
      setSong(loaded.song);
      baseline.current = loaded;
      setHydrated(true);
    }
  }, [myReview, hydrated]);

  const b = baseline.current;
  const dirty =
    rating !== b.rating ||
    favorite !== b.favorite ||
    awkward !== b.awkward ||
    quote !== b.quote ||
    summary !== b.summary ||
    song !== b.song;

  /**
   * This screen is a swipe-dismissable modal holding six fields of personal
   * writing. Losing it to a stray gesture was silent and unrecoverable, so the
   * gesture is disabled while there is unsaved work and the close button asks.
   */
  const closeWithGuard = () => {
    if (!dirty) {
      router.back();
      return;
    }
    Alert.alert(
      "Abandonner ta review ?",
      "Ce que tu as écrit ne sera pas enregistré.",
      [
        { text: "Continuer à écrire", style: "cancel" },
        { text: "Abandonner", style: "destructive", onPress: () => router.back() },
      ]
    );
  };

  const onSubmit = async () => {
    if (!episode) return;
    if (rating === 0 && !favorite.trim() && !summary.trim()) {
      setFormError("Mets au moins une note, ou quelques mots sur ce moment.");
      return;
    }
    setFormError(null);
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
      <Stack.Screen options={{ gestureEnabled: !dirty }} />
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingTop: spacing.sm, marginBottom: spacing.lg }}>
        <View style={{ flex: 1, gap: 2 }}>
          <AppText variant="title">Ma review</AppText>
          <AppText variant="caption" numberOfLines={1}>
            {episode ? `Tes impressions sur « ${episode.title} »` : "Tes impressions, en privé"}
          </AppText>
        </View>
        <IconButton icon={<X size={20} color={colors.text} />} onPress={closeWithGuard} size={40} accessibilityLabel="Fermer" />
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

          {formError ? (
            <AppText style={{ fontSize: 13, color: colors.destructive, fontWeight: "600" }}>{formError}</AppText>
          ) : null}
          <Button title="Enregistrer ma review" size="lg" onPress={onSubmit} loading={loading} />
        </View>
      </FadeIn>
    </Screen>
  );
}
