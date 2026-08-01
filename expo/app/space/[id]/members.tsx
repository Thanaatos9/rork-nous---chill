import * as Clipboard from "expo-clipboard";
import * as Linking from "expo-linking";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ChevronLeft, Copy, RefreshCw, Share2, Trash2 } from "lucide-react-native";
import { ActivityIndicator, Alert, RefreshControl, Share, Switch, TouchableOpacity, View } from "react-native";
import { Avatar } from "@/components/ui/Avatar";
import { RoleBadge } from "@/components/ui/Badge";
import { Button, IconButton } from "@/components/ui/Button";
import { Card, Divider, Screen, SectionHeader } from "@/components/ui/Card";
import { Loader } from "@/components/ui/Feedback";
import { FadeIn } from "@/components/ui/motion";
import { AppText } from "@/components/ui/Text";
import { colors, spacing } from "@/constants/theme";
import { friendlyError } from "@/lib/errors";
import { canParticipate, effectiveRole, isOwner } from "@/lib/types";
import { useMembers, useRegenerateInviteCode, useRemoveMember, useSpaceInviteCode, useUpdateMember } from "@/hooks/useMembers";
import { useSpace } from "@/hooks/useSpaces";
import { useAuth } from "@/providers/auth";
import { useToast } from "@/providers/toast";

export default function MembersScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const toast = useToast();
  const { userId } = useAuth();
  const { data: space } = useSpace(id);
  const owner = isOwner(space?.membership);

  const { data: members, isLoading, refetch, isRefetching } = useMembers(id);
  const updateMember = useUpdateMember();
  const removeMember = useRemoveMember();

  const togglePromotion = (memberUserId: string, currentlyParticipating: boolean) => {
    updateMember.mutate(
      {
        spaceId: id,
        userId: memberUserId,
        patch: currentlyParticipating ? { can_create_episodes: false } : { role: "member", can_create_episodes: true },
      },
      { onError: (e) => toast.error(friendlyError(e)) }
    );
  };

  const confirmRemove = (memberUserId: string, name: string) => {
    Alert.alert("Retirer ce membre ?", `${name} n'aura plus accès à cet espace.`, [
      { text: "Annuler", style: "cancel" },
      { text: "Retirer", style: "destructive", onPress: () => removeMember.mutate({ spaceId: id, userId: memberUserId }, { onError: (e) => toast.error(friendlyError(e)) }) },
    ]);
  };

  return (
    <Screen scroll contentStyle={{ paddingHorizontal: spacing.lg }} refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.primary} />}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md, paddingTop: spacing.sm, marginBottom: spacing.lg }}>
        <IconButton
          icon={<ChevronLeft size={22} color={colors.text} />}
          variant="secondary"
          size={40}
          onPress={() => (router.canGoBack() ? router.back() : router.replace("/"))}
        />
        <View style={{ flex: 1 }}>
          <AppText variant="title">Membres</AppText>
          <AppText variant="caption">{members?.length ?? 0} personne{(members?.length ?? 0) > 1 ? "s" : ""} dans l&apos;aventure</AppText>
        </View>
      </View>

      {owner ? <SpaceInviteCard spaceId={id} spaceName={space?.name ?? "notre espace"} /> : null}

      {isLoading ? (
        <Loader label="Chargement des membres…" />
      ) : (
        <View style={{ gap: spacing.md }}>
          {(members ?? []).map((member, i) => {
            const isMe = member.user_id === userId;
            const memberIsOwner = member.role === "owner";
            const participating = canParticipate(member);
            return (
              <FadeIn key={member.user_id} delay={i * 40}>
                <Card style={{ gap: owner && !memberIsOwner ? spacing.md : 0 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
                    <Avatar profile={member.profile} size={44} />
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                        <AppText variant="h3" numberOfLines={1}>{member.profile?.name ?? "Membre"}</AppText>
                        {isMe ? <AppText variant="caption" style={{ color: colors.primary }}>· toi</AppText> : null}
                      </View>
                      <View style={{ marginTop: 4, flexDirection: "row" }}>
                        <RoleBadge role={effectiveRole(member)} />
                      </View>
                    </View>
                    {owner && !memberIsOwner ? (
                      <TouchableOpacity onPress={() => confirmRemove(member.user_id, member.profile?.name ?? "Ce membre")} hitSlop={8}>
                        <Trash2 size={17} color={colors.textFaint} />
                      </TouchableOpacity>
                    ) : null}
                  </View>

                  {owner && !memberIsOwner ? (
                    <>
                      <Divider />
                      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                        <View style={{ flex: 1 }}>
                          <AppText style={{ fontWeight: "600", fontSize: 14, color: colors.text }}>Peut participer</AppText>
                          <AppText variant="caption">Créer des épisodes, écrire des reviews</AppText>
                        </View>
                        <Switch
                          value={participating}
                          onValueChange={() => togglePromotion(member.user_id, participating)}
                          trackColor={{ false: colors.surface, true: colors.primary }}
                          thumbColor="#fff"
                          ios_backgroundColor={colors.surface}
                        />
                      </View>
                    </>
                  ) : null}
                </Card>
              </FadeIn>
            );
          })}
        </View>
      )}
    </Screen>
  );
}

/**
 * The space's single invite code: one address to share with everyone, rather
 * than one ticket per person. Regenerating it invalidates the previous code.
 */
function SpaceInviteCard({ spaceId, spaceName }: { spaceId: string; spaceName: string }) {
  const toast = useToast();
  const { data: invite, isLoading, error } = useSpaceInviteCode(spaceId);
  const regenerate = useRegenerateInviteCode(spaceId);

  const code = invite?.code ?? null;
  const arrivals = invite?.use_count ?? 0;
  const link = code ? Linking.createURL("join", { queryParams: { code } }) : null;

  const copy = async () => {
    if (!code) return;
    await Clipboard.setStringAsync(code);
    toast.success("Code copié");
  };

  const share = async () => {
    if (!code) return;
    await Share.share({ message: `Rejoins « ${spaceName} » sur Gather 🎬\nCode : ${code}${link ? `\n${link}` : ""}` });
  };

  const confirmRegenerate = () => {
    Alert.alert(
      "Régénérer le code ?",
      "L'ancien code cessera immédiatement de fonctionner. Les membres déjà présents gardent leur accès.",
      [
        { text: "Annuler", style: "cancel" },
        {
          text: "Régénérer",
          style: "destructive",
          onPress: () =>
            regenerate.mutate(undefined, {
              onSuccess: () => toast.success("Nouveau code généré"),
              onError: (e) => toast.error(friendlyError(e)),
            }),
        },
      ]
    );
  };

  return (
    <FadeIn>
      <View style={{ marginBottom: spacing.xxl }}>
        <SectionHeader title="Code de l'espace" />
        <Card elevated glow style={{ gap: spacing.md }}>
          <View style={{ alignItems: "center", gap: spacing.sm }}>
            {code ? (
              <AppText style={{ fontSize: 34, fontWeight: "800", letterSpacing: 6, color: colors.text }}>{code}</AppText>
            ) : (
              <View style={{ height: 42, justifyContent: "center" }}>
                {isLoading || regenerate.isPending ? (
                  <ActivityIndicator color={colors.primary} />
                ) : (
                  <AppText variant="bodyMuted">Code indisponible</AppText>
                )}
              </View>
            )}
            <AppText variant="bodyMuted" center style={{ maxWidth: 300 }}>
              Un seul code pour tout l&apos;espace. Chaque personne qui l&apos;utilise rejoint en observateur —
              tu l&apos;autorises ensuite à participer ci-dessous.
            </AppText>
          </View>

          <View style={{ flexDirection: "row", gap: spacing.md }}>
            <Button title="Copier" variant="secondary" icon={<Copy size={17} color={colors.text} />} onPress={copy} disabled={!code} style={{ flex: 1 }} />
            <Button title="Partager" icon={<Share2 size={17} color={colors.primaryFg} />} onPress={share} disabled={!code} style={{ flex: 1 }} />
          </View>

          <Divider />

          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <AppText variant="caption" style={{ flex: 1 }}>
              {invite ? `${arrivals} arrivée${arrivals > 1 ? "s" : ""} via ce code` : error ? friendlyError(error) : " "}
            </AppText>
            <TouchableOpacity onPress={confirmRegenerate} disabled={regenerate.isPending} hitSlop={8} style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <RefreshCw size={14} color={colors.textMuted} />
              <AppText style={{ color: colors.textMuted, fontWeight: "700", fontSize: 13 }}>Régénérer</AppText>
            </TouchableOpacity>
          </View>
        </Card>
      </View>
    </FadeIn>
  );
}

