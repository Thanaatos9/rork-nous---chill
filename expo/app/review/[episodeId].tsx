import { Image } from "expo-image";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { Camera, Images, Lock, Music, Video, X } from "lucide-react-native";
import { useEffect, useRef, useState } from "react";
import { Alert, ScrollView, TouchableOpacity, View } from "react-native";
import { RatingStars } from "@/components/RatingStars";
import { VideoPoster } from "@/components/VideoSurface";
import { Button, IconButton } from "@/components/ui/Button";
import { Card, Screen } from "@/components/ui/Card";
import { Field, Input } from "@/components/ui/Input";
import { FadeIn } from "@/components/ui/motion";
import { AppText } from "@/components/ui/Text";
import { colors, radius, spacing } from "@/constants/theme";
import { friendlyError } from "@/lib/errors";
import { captureWithCamera, pickFromLibrary, type PickedAsset } from "@/lib/media";
import { useAddEpisodeMedia, useEpisode } from "@/hooks/useEpisodes";
import { useMyReview, useUpsertReview, type ReviewValues } from "@/hooks/useReviews";
import { useToast } from "@/providers/toast";

/** Same ceiling as the creation form — a review is not a photo dump. */
const MAX_ASSETS = 12;

export default function ReviewScreen() {
  const { episodeId } = useLocalSearchParams<{ episodeId: string }>();
  const router = useRouter();
  const toast = useToast();

  const { data: episode } = useEpisode(episodeId);
  const { data: myReview } = useMyReview(episodeId);
  const upsert = useUpsertReview();
  const addMedia = useAddEpisodeMedia(episodeId, episode?.space_id ?? "");

  const [rating, setRating] = useState<number>(0);
  const [favorite, setFavorite] = useState<string>("");
  const [awkward, setAwkward] = useState<string>("");
  const [quote, setQuote] = useState<string>("");
  const [summary, setSummary] = useState<string>("");
  const [song, setSong] = useState<string>("");
  const [assets, setAssets] = useState<PickedAsset[]>([]);
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
    song !== b.song ||
    // Media picked but not sent yet is unsaved work just like the text.
    assets.length > 0;

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
      assets.length > 0
        ? "Ce que tu as écrit et les médias choisis ne seront pas enregistrés."
        : "Ce que tu as écrit ne sera pas enregistré.",
      [
        { text: "Continuer à écrire", style: "cancel" },
        { text: "Abandonner", style: "destructive", onPress: () => router.back() },
      ]
    );
  };

  const addFromLibrary = async () => {
    try {
      const picked = await pickFromLibrary(true);
      if (picked.length) setAssets((prev) => [...prev, ...picked].slice(0, MAX_ASSETS));
    } catch (e) {
      toast.error(friendlyError(e));
    }
  };

  const addFromCamera = async () => {
    try {
      const picked = await captureWithCamera();
      if (picked.length) setAssets((prev) => [...prev, ...picked].slice(0, MAX_ASSETS));
    } catch (e) {
      toast.error(friendlyError(e));
    }
  };

  const hasWritten =
    rating > 0 ||
    !!favorite.trim() ||
    !!awkward.trim() ||
    !!quote.trim() ||
    !!summary.trim() ||
    !!song.trim();

  const onSubmit = async () => {
    if (!episode) return;
    if (rating === 0 && !favorite.trim() && !summary.trim() && assets.length === 0) {
      setFormError("Mets au moins une note, quelques mots sur ce moment, ou une photo.");
      return;
    }
    setFormError(null);
    setLoading(true);
    const pendingCount = assets.length;
    try {
      // Someone who only drops photos has not written a review: creating an
      // empty row would count them as "a répondu" — which now also triggers the
      // reveal for everyone, with nothing to show. An existing review is still
      // saved.
      const savesReview = hasWritten || !!myReview;
      if (savesReview) {
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
        // Written work is safe from here on, whatever happens to the uploads.
        baseline.current = { rating, favorite, awkward, quote, summary, song };
      }

      let mediaNote = "";
      if (pendingCount > 0) {
        try {
          const { added, failed } = await addMedia.mutateAsync(assets);
          setAssets([]);
          if (failed > 0) {
            mediaNote = `, ${added} média${added > 1 ? "s ajoutés" : " ajouté"} et ${failed} en échec`;
          } else {
            mediaNote = added > 1 ? ` et ${added} médias ajoutés` : " et 1 média ajouté";
          }
        } catch (e) {
          // The review is already written — keep the picked files on screen so
          // the upload can be retried instead of silently losing them.
          toast.error(friendlyError(e));
          return;
        }
      }

      toast.success(
        savesReview
          ? `Review enregistrée 🔒${mediaNote}`
          : pendingCount > 1
          ? "Médias ajoutés à l'épisode"
          : "Média ajouté à l'épisode",
      );
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
            Personne ne verra ce que tu écris tant que tout le groupe n&apos;a pas publié sa review sur cet
            épisode — ni les autres membres, ni le propriétaire. La dernière publiée révèle toutes les
            autres, d&apos;un coup.
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

          {/* Media is the one part of this screen that is not private: it joins
              the episode's gallery, visible to the whole space right away. The
              hint says so, since everything above promises the opposite. */}
          <Field label="Tes photos & vidéos" hint="Elles rejoignent la galerie de l'épisode — visibles par tout l'espace, contrairement à ta review.">
            <View style={{ flexDirection: "row", gap: spacing.md }}>
              <Button title="Galerie" variant="secondary" icon={<Images size={18} color={colors.text} />} onPress={addFromLibrary} style={{ flex: 1 }} />
              <Button title="Caméra" variant="secondary" icon={<Camera size={18} color={colors.text} />} onPress={addFromCamera} style={{ flex: 1 }} />
            </View>
            {assets.length > 0 ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm, marginTop: spacing.md }}>
                {assets.map((a, i) => (
                  <View key={`${a.uri}-${i}`} style={{ width: 84, height: 110, borderRadius: radius.md, overflow: "hidden", backgroundColor: colors.surface }}>
                    {a.type === "video" ? (
                      // An image component has nothing to show for an .mp4 —
                      // the tile pulls a frame out of the clip instead.
                      <VideoPoster url={a.uri} play="none" style={{ width: "100%", height: "100%" }} />
                    ) : (
                      <Image source={{ uri: a.uri }} style={{ width: "100%", height: "100%" }} contentFit="cover" />
                    )}
                    {a.type === "video" ? (
                      <View style={{ position: "absolute", bottom: 6, left: 6, backgroundColor: "rgba(0,0,0,0.6)", borderRadius: radius.sm, padding: 3 }}>
                        <Video size={13} color="#fff" />
                      </View>
                    ) : null}
                    <TouchableOpacity onPress={() => setAssets((prev) => prev.filter((_, idx) => idx !== i))} style={{ position: "absolute", top: 5, right: 5, backgroundColor: "rgba(0,0,0,0.65)", borderRadius: radius.pill, padding: 3 }} hitSlop={6}>
                      <X size={13} color="#fff" />
                    </TouchableOpacity>
                  </View>
                ))}
              </ScrollView>
            ) : null}
          </Field>

          {formError ? (
            <AppText style={{ fontSize: 13, color: colors.destructive, fontWeight: "600" }}>{formError}</AppText>
          ) : null}
          <Button
            title={assets.length > 0 && !hasWritten ? "Envoyer mes photos" : "Enregistrer ma review"}
            size="lg"
            onPress={onSubmit}
            loading={loading}
          />
        </View>
      </FadeIn>
    </Screen>
  );
}
