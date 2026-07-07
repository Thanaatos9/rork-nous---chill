import * as Clipboard from "expo-clipboard";
import * as Linking from "expo-linking";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ChevronLeft, Copy, Plus, Share2, Ticket, Trash2, X } from "lucide-react-native";
import React, { useState } from "react";
import { Alert, RefreshControl, Share, Switch, TouchableOpacity, View } from "react-native";
import { Avatar } from "@/components/ui/Avatar";
import { Badge, RoleBadge } from "@/components/ui/Badge";
import { Button, IconButton } from "@/components/ui/Button";
import { Card, Divider, Screen, SectionHeader } from "@/components/ui/Card";
import { Loader } from "@/components/ui/Feedback";
import { DateField } from "@/components/ui/DateField";
import { FadeIn, PressableScale } from "@/components/ui/motion";
import { Field, Input } from "@/components/ui/Input";
import { AppText } from "@/components/ui/Text";
import { colors, radius, spacing } from "@/constants/theme";
import { friendlyError } from "@/lib/errors";
import { formatDate } from "@/lib/format";
import { canParticipate, effectiveRole, isOwner, type MemberRole } from "@/lib/types";
import { useCreateInviteCode, useInviteCodes, useMembers, useRemoveMember, useRevokeInviteCode, useUpdateMember } from "@/hooks/useMembers";
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
  const { data: invites } = useInviteCodes(id, owner);
  const updateMember = useUpdateMember();
  const removeMember = useRemoveMember();
  const createInvite = useCreateInviteCode();

  const [composingInvite, setComposingInvite] = useState<boolean>(false);

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

      {owner ? (
        <View style={{ marginTop: spacing.xxl }}>
          <SectionHeader
            title="Codes d'invitation"
            action={
              <PressableScale onPress={() => setComposingInvite((v) => !v)} withHaptic={false}>
                <AppText style={{ color: colors.primary, fontWeight: "700", fontSize: 13 }}>{composingInvite ? "Fermer" : "Nouveau"}</AppText>
              </PressableScale>
            }
          />

          {composingInvite ? (
            <InviteComposer
              spaceId={id}
              onCreated={() => setComposingInvite(false)}
              createInvite={createInvite}
            />
          ) : null}

          {(invites ?? []).length === 0 && !composingInvite ? (
            <Card style={{ alignItems: "center", gap: 6 }}>
              <Ticket size={22} color={colors.textMuted} />
              <AppText variant="bodyMuted" center>Crée un code pour inviter de nouvelles personnes.</AppText>
            </Card>
          ) : (
            <View style={{ gap: spacing.md, marginTop: composingInvite ? spacing.md : 0 }}>
              {(invites ?? []).map((invite) => (
                <InviteRow key={invite.id} invite={invite} spaceId={id} />
              ))}
            </View>
          )}
        </View>
      ) : null}
    </Screen>
  );
}

function InviteComposer({ spaceId, onCreated, createInvite }: { spaceId: string; onCreated: () => void; createInvite: ReturnType<typeof useCreateInviteCode> }) {
  const toast = useToast();
  const [role, setRole] = useState<MemberRole>("member");
  const [maxUses, setMaxUses] = useState<string>("");
  const [expiry, setExpiry] = useState<Date | null>(null);
  const [saving, setSaving] = useState<boolean>(false);

  const create = async () => {
    setSaving(true);
    try {
      await createInvite.mutateAsync({
        spaceId,
        role,
        maxUses: maxUses.trim() ? Number(maxUses.replace(/[^0-9]/g, "")) || null : null,
        expiresAt: expiry ? expiry.toISOString() : null,
      });
      toast.success("Code créé");
      onCreated();
    } catch (e) {
      toast.error(friendlyError(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <FadeIn>
      <Card elevated style={{ gap: spacing.md, marginBottom: spacing.md }}>
        <Field label="Rôle attribué">
          <View style={{ flexDirection: "row", gap: spacing.sm }}>
            {(["member", "observer"] as MemberRole[]).map((r) => (
              <PressableScale key={r} onPress={() => setRole(r)} withHaptic={false} style={{ flex: 1, paddingVertical: 11, borderRadius: radius.md, alignItems: "center", backgroundColor: role === r ? colors.primary : colors.surface }}>
                <AppText style={{ fontWeight: "700", fontSize: 14, color: role === r ? "#fff" : colors.textMuted }}>{r === "member" ? "Membre" : "Observateur"}</AppText>
              </PressableScale>
            ))}
          </View>
        </Field>
        <View style={{ flexDirection: "row", gap: spacing.md }}>
          <View style={{ flex: 1 }}>
            <Field label="Usages max">
              <Input placeholder="Illimité" keyboardType="number-pad" value={maxUses} onChangeText={setMaxUses} />
            </Field>
          </View>
          <View style={{ flex: 1.2 }}>
            <DateField label="Expiration" value={expiry} onChange={setExpiry} minimumDate={new Date()} placeholder="Jamais" />
          </View>
        </View>
        <Button title="Générer le code" onPress={create} loading={saving} icon={<Plus size={17} color={colors.primaryFg} />} />
      </Card>
    </FadeIn>
  );
}

function InviteRow({ invite, spaceId }: { invite: { id: string; code: string; role: MemberRole; max_uses: number | null; use_count: number; expires_at: string | null }; spaceId: string }) {
  const toast = useToast();
  const revoke = useRevokeInviteCode(spaceId);

  const link = Linking.createURL("join", { queryParams: { code: invite.code } });
  const copy = async () => {
    await Clipboard.setStringAsync(invite.code);
    toast.success("Code copié");
  };
  const share = async () => {
    await Share.share({ message: `Rejoins notre espace sur Gather 🎬\nCode : ${invite.code}\n${link}` });
  };
  const confirmRevoke = () => {
    Alert.alert("Révoquer ce code ?", "Il ne pourra plus être utilisé.", [
      { text: "Annuler", style: "cancel" },
      { text: "Révoquer", style: "destructive", onPress: () => revoke.mutate(invite.id, { onError: (e) => toast.error(friendlyError(e)) }) },
    ]);
  };

  const expired = invite.expires_at ? new Date(invite.expires_at).getTime() < Date.now() : false;
  const exhausted = invite.max_uses != null && invite.use_count >= invite.max_uses;

  return (
    <Card style={{ gap: spacing.md }}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <View style={{ gap: 4 }}>
          <AppText style={{ fontSize: 22, fontWeight: "800", letterSpacing: 4, color: colors.text }}>{invite.code}</AppText>
          <View style={{ flexDirection: "row", gap: 6, alignItems: "center" }}>
            <Badge label={invite.role === "member" ? "Membre" : "Observateur"} tone={invite.role === "member" ? "primary" : "muted"} />
            {expired || exhausted ? <Badge label={expired ? "Expiré" : "Épuisé"} tone="destructive" /> : null}
          </View>
        </View>
        <TouchableOpacity onPress={confirmRevoke} hitSlop={8}>
          <Trash2 size={17} color={colors.textFaint} />
        </TouchableOpacity>
      </View>

      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
        <AppText variant="caption">
          {invite.use_count} utilisation{invite.use_count > 1 ? "s" : ""}
          {invite.max_uses != null ? ` / ${invite.max_uses}` : ""}
          {invite.expires_at ? ` · exp. ${formatDate(invite.expires_at)}` : ""}
        </AppText>
        <View style={{ flexDirection: "row", gap: spacing.sm }}>
          <IconButton icon={<Copy size={16} color={colors.text} />} onPress={copy} variant="secondary" size={38} />
          <IconButton icon={<Share2 size={16} color={colors.primaryFg} />} onPress={share} variant="primary" size={38} />
        </View>
      </View>
    </Card>
  );
}
