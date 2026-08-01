import { Image } from "expo-image";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Camera, Clock, Eye, Images, MapPin, Plus, Tag, Video, X } from "lucide-react-native";
import { useState } from "react";
import { ScrollView, TouchableOpacity, View } from "react-native";
import { IconButton } from "@/components/ui/Button";
import { Button } from "@/components/ui/Button";
import { Screen } from "@/components/ui/Card";
import { DateField } from "@/components/ui/DateField";
import { Field, Input } from "@/components/ui/Input";
import { FadeIn, PressableScale } from "@/components/ui/motion";
import { AppText } from "@/components/ui/Text";
import { colors, radius, spacing } from "@/constants/theme";
import { friendlyError } from "@/lib/errors";
import { captureWithCamera, pickFromLibrary, PickedAsset } from "@/lib/media";
import { canParticipate } from "@/lib/types";
import { useCreateEpisode } from "@/hooks/useEpisodes";
import { useSpace } from "@/hooks/useSpaces";
import { useToast } from "@/providers/toast";

const SUGGESTED_TAGS = ["🍽️ Resto", "🎉 Soirée", "🏖️ Vacances", "🎬 Ciné", "🥾 Rando", "☕ Café", "🎤 Concert", "🏠 Cocooning"];

export default function CreateEpisodeScreen() {
  const { spaceId } = useLocalSearchParams<{ spaceId: string }>();
  const router = useRouter();
  const toast = useToast();
  const { data: space } = useSpace(spaceId);
  const createEpisode = useCreateEpisode();

  const [title, setTitle] = useState<string>("");
  const [date, setDate] = useState<Date>(new Date());
  const [place, setPlace] = useState<string>("");
  const [durationStr, setDurationStr] = useState<string>("");
  const [tags, setTags] = useState<string[]>([]);
  const [tagDraft, setTagDraft] = useState<string>("");
  const [assets, setAssets] = useState<PickedAsset[]>([]);
  const [loading, setLoading] = useState<boolean>(false);

  const addTag = (raw: string) => {
    const t = raw.trim();
    if (!t || tags.includes(t) || tags.length >= 8) return;
    setTags((prev) => [...prev, t]);
    setTagDraft("");
  };

  const addFromLibrary = async () => {
    try {
      const picked = await pickFromLibrary(true);
      if (picked.length) setAssets((prev) => [...prev, ...picked].slice(0, 12));
    } catch (e) {
      toast.error(friendlyError(e));
    }
  };

  const addFromCamera = async () => {
    try {
      const picked = await captureWithCamera();
      if (picked.length) setAssets((prev) => [...prev, ...picked].slice(0, 12));
    } catch (e) {
      toast.error(friendlyError(e));
    }
  };

  const onSubmit = async () => {
    if (!title.trim()) {
      toast.error("Donne un titre à cet épisode.");
      return;
    }
    setLoading(true);
    try {
      const durationNum = durationStr.trim() ? Number(durationStr.replace(/[^0-9]/g, "")) : null;
      await createEpisode.mutateAsync({
        spaceId,
        title,
        date: date.toISOString(),
        place,
        duration: durationNum && !isNaN(durationNum) ? durationNum : null,
        tags,
        assets,
      });
      toast.success("Épisode créé 🎬");
      router.back();
    } catch (e) {
      toast.error(friendlyError(e));
    } finally {
      setLoading(false);
    }
  };

  if (space && !canParticipate(space.membership)) {
    return (
      <Screen scroll contentStyle={{ paddingHorizontal: spacing.lg }}>
        <View style={{ alignItems: "flex-end", paddingTop: spacing.sm }}>
          <IconButton icon={<X size={20} color={colors.text} />} onPress={() => router.back()} size={40} />
        </View>
        <View style={{ alignItems: "center", gap: spacing.md, marginTop: spacing.xxxl, paddingHorizontal: spacing.lg }}>
          <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center" }}>
            <Eye size={30} color={colors.textMuted} />
          </View>
          <AppText variant="h2" center>Tu es observateur</AppText>
          <AppText variant="bodyMuted" center style={{ maxWidth: 300 }}>
            Tu peux voir, aimer et commenter tout l&apos;espace. Pour ajouter des épisodes et écrire tes
            impressions, le propriétaire doit t&apos;autoriser à participer depuis l&apos;onglet Membres.
          </AppText>
          <Button title="J'ai compris" variant="secondary" onPress={() => router.back()} style={{ marginTop: spacing.sm }} />
        </View>
      </Screen>
    );
  }

  return (
    <Screen scroll contentStyle={{ paddingHorizontal: spacing.lg }}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingTop: spacing.sm, marginBottom: spacing.lg }}>
        <View style={{ flex: 1, gap: 2 }}>
          <AppText variant="title">Nouvel épisode</AppText>
          <AppText variant="caption">Un moment que vous avez vécu ensemble</AppText>
        </View>
        <IconButton icon={<X size={20} color={colors.text} />} onPress={() => router.back()} size={40} />
      </View>

      <FadeIn>
        <View style={{ gap: spacing.lg }}>
          {/* Media */}
          <Field label="Photos & vidéos">
            <View style={{ flexDirection: "row", gap: spacing.md }}>
              <Button title="Galerie" variant="secondary" icon={<Images size={18} color={colors.text} />} onPress={addFromLibrary} style={{ flex: 1 }} />
              <Button title="Caméra" variant="secondary" icon={<Camera size={18} color={colors.text} />} onPress={addFromCamera} style={{ flex: 1 }} />
            </View>
            {assets.length > 0 ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm, marginTop: spacing.md }}>
                {assets.map((a, i) => (
                  <View key={`${a.uri}-${i}`} style={{ width: 84, height: 110, borderRadius: radius.md, overflow: "hidden", backgroundColor: colors.surface }}>
                    <Image source={{ uri: a.uri }} style={{ width: "100%", height: "100%" }} contentFit="cover" />
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

          <Field label="Titre">
            <Input placeholder="Notre week-end à Lisbonne" value={title} onChangeText={setTitle} />
          </Field>

          <View style={{ flexDirection: "row", gap: spacing.md }}>
            <View style={{ flex: 1.2 }}>
              <DateField label="Date" value={date} onChange={setDate} />
            </View>
            <View style={{ flex: 1 }}>
              <Field label="Durée (min)">
                <Input icon={<Clock size={18} color={colors.textFaint} />} placeholder="90" keyboardType="number-pad" value={durationStr} onChangeText={setDurationStr} />
              </Field>
            </View>
          </View>

          <Field label="Lieu (optionnel)">
            <Input icon={<MapPin size={18} color={colors.textFaint} />} placeholder="Lisbonne, Portugal" value={place} onChangeText={setPlace} />
          </Field>

          <Field label="Tags">
            <Input
              icon={<Tag size={18} color={colors.textFaint} />}
              placeholder="Ajoute un tag puis valide"
              value={tagDraft}
              onChangeText={setTagDraft}
              onSubmitEditing={() => addTag(tagDraft)}
              returnKeyType="done"
              autoCapitalize="none"
            />
            {tags.length > 0 ? (
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 7, marginTop: spacing.sm }}>
                {tags.map((t) => (
                  <TouchableOpacity key={t} onPress={() => setTags((prev) => prev.filter((x) => x !== t))} style={{ flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: colors.primarySoft, paddingHorizontal: 10, paddingVertical: 6, borderRadius: radius.pill }}>
                    <AppText style={{ color: colors.primary, fontWeight: "600", fontSize: 13 }}>{t}</AppText>
                    <X size={12} color={colors.primary} />
                  </TouchableOpacity>
                ))}
              </View>
            ) : null}
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 7, marginTop: spacing.sm }}>
              {SUGGESTED_TAGS.filter((t) => !tags.includes(t)).slice(0, 6).map((t) => (
                <PressableScale key={t} onPress={() => addTag(t)} withHaptic={false} style={{ flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: colors.surface, paddingHorizontal: 10, paddingVertical: 6, borderRadius: radius.pill }}>
                  <Plus size={12} color={colors.textMuted} />
                  <AppText style={{ color: colors.textMuted, fontWeight: "600", fontSize: 12.5 }}>{t}</AppText>
                </PressableScale>
              ))}
            </View>
          </Field>

          <Button title={loading ? "Publication…" : "Publier l'épisode"} size="lg" onPress={onSubmit} loading={loading} style={{ marginTop: spacing.sm }} />
        </View>
      </FadeIn>
    </Screen>
  );
}
