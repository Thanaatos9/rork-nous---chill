import * as Notifications from "expo-notifications";
import { useRouter } from "expo-router";
import { Bell, Camera, ChevronRight, LogOut, Info } from "lucide-react-native";
import React, { useEffect, useState } from "react";
import { Alert, Switch, TouchableOpacity, View } from "react-native";
import { AppHeader } from "@/components/AppHeader";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { Card, Divider, Screen, SectionHeader } from "@/components/ui/Card";
import { Field, Input } from "@/components/ui/Input";
import { FadeIn } from "@/components/ui/motion";
import { AppText } from "@/components/ui/Text";
import { colors, radius, spacing } from "@/constants/theme";
import { friendlyError } from "@/lib/errors";
import { pickAvatarImage, uploadToBucket } from "@/lib/media";
import { registerPushToken } from "@/lib/push";
import { useUpdateProfile } from "@/hooks/useProfile";
import { useAuth } from "@/providers/auth";
import { useToast } from "@/providers/toast";

function PushToggle() {
  const toast = useToast();
  const { userId } = useAuth();
  const [enabled, setEnabled] = useState<boolean>(false);

  useEffect(() => {
    Notifications.getPermissionsAsync()
      .then((s) => setEnabled(s.granted))
      .catch(() => {});
  }, []);

  const onToggle = async (value: boolean) => {
    if (value) {
      try {
        const s = await Notifications.requestPermissionsAsync();
        setEnabled(s.granted);
        if (s.granted) {
          if (userId) registerPushToken(userId);
          toast.success("Notifications activées");
        } else {
          toast.info("Active les notifications dans les réglages de ton téléphone.");
        }
      } catch {
        toast.error("Impossible d'activer les notifications ici.");
      }
    } else {
      toast.info("Pour les désactiver, passe par les réglages système.");
    }
  };

  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
      <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center" }}>
        <Bell size={18} color={colors.text} />
      </View>
      <View style={{ flex: 1 }}>
        <AppText style={{ fontWeight: "600", fontSize: 15, color: colors.text }}>Notifications push</AppText>
        <AppText variant="caption">Épisodes, commentaires, déverrouillages</AppText>
      </View>
      <Switch value={enabled} onValueChange={onToggle} trackColor={{ false: colors.surface, true: colors.primary }} thumbColor="#fff" ios_backgroundColor={colors.surface} />
    </View>
  );
}

export default function SettingsScreen() {
  const router = useRouter();
  const toast = useToast();
  const { profile, user, signOut } = useAuth();
  const updateProfile = useUpdateProfile();

  const [name, setName] = useState<string>(profile?.name ?? "");
  const [bio, setBio] = useState<string>(profile?.bio ?? "");
  const [hydrated, setHydrated] = useState<boolean>(false);
  const [savingAvatar, setSavingAvatar] = useState<boolean>(false);

  useEffect(() => {
    if (profile && !hydrated) {
      setName(profile.name ?? "");
      setBio(profile.bio ?? "");
      setHydrated(true);
    }
  }, [profile, hydrated]);

  const changed = name.trim() !== (profile?.name ?? "") || bio.trim() !== (profile?.bio ?? "");

  const onSave = async () => {
    if (!name.trim()) {
      toast.error("Ton prénom ne peut pas être vide.");
      return;
    }
    try {
      await updateProfile.mutateAsync({ name: name.trim(), bio: bio.trim() || null });
      toast.success("Profil mis à jour");
    } catch (e) {
      toast.error(friendlyError(e));
    }
  };

  const onChangeAvatar = async () => {
    try {
      const asset = await pickAvatarImage();
      if (!asset) return;
      setSavingAvatar(true);
      const url = await uploadToBucket("avatars", asset);
      await updateProfile.mutateAsync({ avatar_url: url });
      toast.success("Photo mise à jour");
    } catch (e) {
      toast.error(friendlyError(e));
    } finally {
      setSavingAvatar(false);
    }
  };

  const confirmSignOut = () => {
    Alert.alert("Se déconnecter ?", "Tu pourras te reconnecter à tout moment.", [
      { text: "Annuler", style: "cancel" },
      { text: "Se déconnecter", style: "destructive", onPress: () => signOut() },
    ]);
  };

  return (
    <Screen scroll contentStyle={{ paddingHorizontal: spacing.lg }}>
      <AppHeader title="Réglages" style={{ paddingHorizontal: 0 }} />

      <FadeIn>
        <Card elevated style={{ gap: spacing.lg }}>
          <View style={{ alignItems: "center", gap: spacing.sm }}>
            <TouchableOpacity onPress={onChangeAvatar} activeOpacity={0.8}>
              <Avatar profile={profile} size={92} />
              <View style={{ position: "absolute", bottom: 0, right: 0, width: 30, height: 30, borderRadius: 15, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: colors.card }}>
                <Camera size={15} color="#fff" />
              </View>
            </TouchableOpacity>
            {savingAvatar ? <AppText variant="caption">Envoi…</AppText> : <AppText variant="caption">{user?.email}</AppText>}
          </View>

          <Field label="Prénom">
            <Input placeholder="Ton prénom" value={name} onChangeText={setName} />
          </Field>
          <Field label="Bio (optionnel)">
            <Input placeholder="Quelques mots sur toi…" value={bio} onChangeText={setBio} multiline />
          </Field>
          <Button title="Enregistrer" onPress={onSave} loading={updateProfile.isPending} disabled={!changed} />
        </Card>
      </FadeIn>

      <View style={{ marginTop: spacing.xxl }}>
        <SectionHeader title="Préférences" />
        <Card>
          <PushToggle />
        </Card>
      </View>

      <View style={{ marginTop: spacing.xxl }}>
        <SectionHeader title="À propos" />
        <Card padded={false}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.lg }}>
            <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center" }}>
              <Info size={18} color={colors.text} />
            </View>
            <AppText style={{ flex: 1, fontWeight: "600", fontSize: 15, color: colors.text }}>Gather</AppText>
            <AppText variant="caption">v1.0.0</AppText>
          </View>
        </Card>
      </View>

      <TouchableOpacity onPress={confirmSignOut} style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, marginTop: spacing.xxl, paddingVertical: spacing.md, borderRadius: radius.md, borderWidth: 1, borderColor: colors.destructiveSoft }}>
        <LogOut size={18} color={colors.destructive} />
        <AppText style={{ color: colors.destructive, fontWeight: "700" }}>Se déconnecter</AppText>
      </TouchableOpacity>
    </Screen>
  );
}
