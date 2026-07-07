import * as Clipboard from "expo-clipboard";
import { Image } from "expo-image";
import * as Linking from "expo-linking";
import { useRouter } from "expo-router";
import { Camera, Check, Copy, Film, Share2, Sparkles, X } from "lucide-react-native";
import { useState } from "react";
import { Share, TouchableOpacity, View } from "react-native";
import { IconButton } from "@/components/ui/Button";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Card, Screen } from "@/components/ui/Card";
import { DateField } from "@/components/ui/DateField";
import { Field, Input } from "@/components/ui/Input";
import { FadeIn } from "@/components/ui/motion";
import { AppText } from "@/components/ui/Text";
import { colors, radius, spacing } from "@/constants/theme";
import { friendlyError } from "@/lib/errors";
import { PickedAsset, pickCoverImage, uploadMedia } from "@/lib/media";
import type { Space } from "@/lib/types";
import { useCreateInviteCode } from "@/hooks/useMembers";
import { useCreateSpace, useUpdateSpace } from "@/hooks/useSpaces";
import { useAuth } from "@/providers/auth";
import { useToast } from "@/providers/toast";

function addMonths(date: Date, months: number): Date {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d;
}

export default function CreateSpaceScreen() {
  const router = useRouter();
  const toast = useToast();
  const createSpace = useCreateSpace();
  const updateSpace = useUpdateSpace();
  const createInvite = useCreateInviteCode();
  const { userId } = useAuth();

  const [name, setName] = useState<string>("");
  const [description, setDescription] = useState<string>("");
  const [cover, setCover] = useState<PickedAsset | null>(null);
  const [start, setStart] = useState<Date>(new Date());
  const [end, setEnd] = useState<Date>(addMonths(new Date(), 3));
  const [loading, setLoading] = useState<boolean>(false);

  const [created, setCreated] = useState<{ space: Space; code: string | null } | null>(null);

  const onPickCover = async () => {
    try {
      const asset = await pickCoverImage();
      if (asset) setCover(asset);
    } catch (error) {
      toast.error(friendlyError(error));
    }
  };

  const onCreate = async () => {
    if (!name.trim()) {
      toast.error("Donne un nom à ton espace.");
      return;
    }
    if (end.getTime() <= start.getTime()) {
      toast.error("La fin de saison doit être après le début.");
      return;
    }
    setLoading(true);
    try {
      // The storage policy only accepts paths starting with a space uuid, so
      // the space is created first and the cover is uploaded under its id.
      const space = await createSpace.mutateAsync({
        name,
        description,
        coverUrl: null,
        seasonStart: start.toISOString(),
        seasonEnd: end.toISOString(),
      });

      if (cover) {
        try {
          const coverUrl = await uploadMedia({ kind: "covers", spaceId: space.id, userId }, cover);
          const updated = await updateSpace.mutateAsync({ spaceId: space.id, patch: { cover_url: coverUrl } });
          space.cover_url = updated.cover_url;
        } catch (coverError) {
          console.log("[create-space] cover upload failed:", coverError);
          toast.info("Espace créé, mais la couverture n'a pas pu être envoyée. Réessaie depuis les paramètres.");
        }
      }

      let code: string | null = null;
      try {
        const invite = await createInvite.mutateAsync({
          spaceId: space.id,
          role: "member",
          maxUses: null,
          expiresAt: null,
        });
        code = invite.code;
      } catch {
        // Invite creation is a nice-to-have; the space already exists.
      }

      setCreated({ space, code });
    } catch (error) {
      toast.error(friendlyError(error));
    } finally {
      setLoading(false);
    }
  };

  if (created) {
    const link = created.code ? Linking.createURL("join", { queryParams: { code: created.code } }) : null;
    const shareInvite = async () => {
      if (!created.code) return;
      await Share.share({
        message: `Rejoins « ${created.space.name} » sur Gather 🎬\nCode : ${created.code}${link ? `\n${link}` : ""}`,
      });
    };
    const copyCode = async () => {
      if (!created.code) return;
      await Clipboard.setStringAsync(created.code);
      toast.success("Code copié !");
    };

    return (
      <Screen scroll contentStyle={{ paddingHorizontal: spacing.lg }}>
        <View style={{ alignItems: "flex-end", paddingTop: spacing.sm }}>
          <IconButton icon={<X size={20} color={colors.text} />} onPress={() => router.back()} size={40} />
        </View>
        <FadeIn>
          <View style={{ alignItems: "center", gap: spacing.md, marginTop: spacing.lg }}>
            <View style={{ width: 84, height: 84, borderRadius: 42, backgroundColor: colors.primarySoft, alignItems: "center", justifyContent: "center" }}>
              <Sparkles size={38} color={colors.primary} />
            </View>
            <AppText variant="title" center>« {created.space.name} » est prêt</AppText>
            <AppText variant="bodyMuted" center style={{ maxWidth: 300 }}>
              Partage ce code pour inviter ta bande. Ils rejoindront avec le rôle Membre.
            </AppText>
          </View>
        </FadeIn>

        {created.code ? (
          <FadeIn delay={120}>
            <Card elevated glow style={{ marginTop: spacing.xxl, alignItems: "center", gap: spacing.md }}>
              <AppText variant="overline">Code d&apos;invitation</AppText>
              <AppText style={{ fontSize: 38, fontWeight: "800", letterSpacing: 6, color: colors.text }}>{created.code}</AppText>
              <View style={{ flexDirection: "row", gap: spacing.md, alignSelf: "stretch" }}>
                <Button title="Copier" variant="secondary" icon={<Copy size={17} color={colors.text} />} onPress={copyCode} style={{ flex: 1 }} />
                <Button title="Partager" icon={<Share2 size={17} color={colors.primaryFg} />} onPress={shareInvite} style={{ flex: 1 }} />
              </View>
            </Card>
          </FadeIn>
        ) : null}

        <Button
          title="Ouvrir l'espace"
          size="lg"
          onPress={() => router.replace({ pathname: "/space/[id]", params: { id: created.space.id } })}
          style={{ marginTop: spacing.xxl }}
        />
      </Screen>
    );
  }

  return (
    <Screen scroll contentStyle={{ paddingHorizontal: spacing.lg }}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingTop: spacing.sm, marginBottom: spacing.lg }}>
        <AppText variant="title">Nouvel espace</AppText>
        <IconButton icon={<X size={20} color={colors.text} />} onPress={() => router.back()} size={40} />
      </View>

      <FadeIn>
        <TouchableOpacity activeOpacity={0.85} onPress={onPickCover} style={{ marginBottom: spacing.xl }}>
          <View
            style={{
              height: 170,
              borderRadius: radius.xl,
              borderWidth: cover ? 0 : 1.5,
              borderColor: colors.borderStrong,
              borderStyle: cover ? "solid" : "dashed",
              backgroundColor: colors.card,
              alignItems: "center",
              justifyContent: "center",
              overflow: "hidden",
            }}
          >
            {cover ? (
              <>
                <Image source={{ uri: cover.uri }} style={{ position: "absolute", width: "100%", height: "100%" }} contentFit="cover" />
                <View style={{ position: "absolute", bottom: 10, right: 10, flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "rgba(0,0,0,0.55)", paddingHorizontal: 10, paddingVertical: 6, borderRadius: radius.pill }}>
                  <Camera size={14} color="#fff" />
                  <AppText style={{ color: "#fff", fontSize: 12.5, fontWeight: "600" }}>Changer</AppText>
                </View>
              </>
            ) : (
              <View style={{ alignItems: "center", gap: 8 }}>
                <Film size={28} color={colors.textMuted} />
                <AppText variant="bodyMuted">Ajouter une couverture</AppText>
              </View>
            )}
          </View>
        </TouchableOpacity>
      </FadeIn>

      <FadeIn delay={80}>
        <View style={{ gap: spacing.lg }}>
          <Field label="Nom de l'espace">
            <Input placeholder="Samuel & Mathilde — Saison 1" value={name} onChangeText={setName} autoFocus />
          </Field>

          <Field label="Description (optionnel)">
            <Input
              placeholder="Notre première année à deux 🎬"
              value={description}
              onChangeText={setDescription}
              multiline
            />
          </Field>

          <View style={{ flexDirection: "row", gap: spacing.md }}>
            <View style={{ flex: 1 }}>
              <DateField label="Début de saison" value={start} onChange={setStart} />
            </View>
            <View style={{ flex: 1 }}>
              <DateField label="Fin de saison" value={end} onChange={setEnd} minimumDate={start} />
            </View>
          </View>

          <Badge label="Tu seras le propriétaire de cet espace" tone="gold" style={{ marginTop: spacing.xs }} />

          <Button title="Créer l'espace" size="lg" onPress={onCreate} loading={loading} icon={<Check size={18} color={colors.primaryFg} />} style={{ marginTop: spacing.sm }} />
        </View>
      </FadeIn>
    </Screen>
  );
}
