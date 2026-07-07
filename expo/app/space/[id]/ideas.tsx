import { useLocalSearchParams, useRouter } from "expo-router";
import { ChevronLeft, Flame, Lightbulb, Plus, Trash2, X } from "lucide-react-native";
import React, { useMemo, useState } from "react";
import { RefreshControl, TouchableOpacity, View } from "react-native";
import { Avatar } from "@/components/ui/Avatar";
import { Button, IconButton } from "@/components/ui/Button";
import { Card, Screen } from "@/components/ui/Card";
import { EmptyState, Loader } from "@/components/ui/Feedback";
import { FadeIn, PressableScale } from "@/components/ui/motion";
import { Field, Input } from "@/components/ui/Input";
import { AppText } from "@/components/ui/Text";
import { colors, radius, spacing } from "@/constants/theme";
import { friendlyError } from "@/lib/errors";
import { formatRelative } from "@/lib/format";
import { canParticipate, isOwner } from "@/lib/types";
import { useCreateIdea, useDeleteIdea, useIdeas, useToggleIdeaVote } from "@/hooks/useSocial";
import { useSpace } from "@/hooks/useSpaces";
import { useAuth } from "@/providers/auth";
import { useToast } from "@/providers/toast";

export default function IdeasScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const toast = useToast();
  const { userId } = useAuth();
  const { data: space } = useSpace(id);
  const { data: ideas, isLoading, refetch, isRefetching } = useIdeas(id);
  const createIdea = useCreateIdea(id);
  const toggleVote = useToggleIdeaVote(id);
  const deleteIdea = useDeleteIdea(id);

  const participate = canParticipate(space?.membership);
  const owner = isOwner(space?.membership);

  const [composing, setComposing] = useState<boolean>(false);
  const [title, setTitle] = useState<string>("");
  const [description, setDescription] = useState<string>("");
  const [saving, setSaving] = useState<boolean>(false);

  const sorted = useMemo(
    () => [...(ideas ?? [])].sort((a, b) => b.voteCount - a.voteCount || (b.created_at ?? "").localeCompare(a.created_at ?? "")),
    [ideas]
  );

  const submit = async () => {
    if (!title.trim()) {
      toast.error("Donne un titre à ton idée.");
      return;
    }
    setSaving(true);
    try {
      await createIdea.mutateAsync({ title, description });
      setTitle("");
      setDescription("");
      setComposing(false);
      toast.success("Idée proposée 💡");
    } catch (e) {
      toast.error(friendlyError(e));
    } finally {
      setSaving(false);
    }
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
          <AppText variant="title">Idées</AppText>
          <AppText variant="caption">Vos prochaines aventures, votées ensemble</AppText>
        </View>
        {participate ? (
          <IconButton icon={composing ? <X size={22} color={colors.text} /> : <Plus size={22} color={colors.primaryFg} />} variant={composing ? "secondary" : "primary"} onPress={() => setComposing((v) => !v)} />
        ) : null}
      </View>

      {composing ? (
        <FadeIn>
          <Card elevated style={{ gap: spacing.md, marginBottom: spacing.xl }}>
            <Field label="Ton idée">
              <Input placeholder="Escape game ce week-end ?" value={title} onChangeText={setTitle} autoFocus />
            </Field>
            <Field label="Détails (optionnel)">
              <Input placeholder="On peut réserver pour samedi soir…" value={description} onChangeText={setDescription} multiline />
            </Field>
            <Button title="Proposer au groupe" onPress={submit} loading={saving} />
          </Card>
        </FadeIn>
      ) : null}

      {isLoading ? (
        <Loader label="Chargement des idées…" />
      ) : sorted.length === 0 ? (
        <EmptyState
          icon={<Lightbulb size={30} color={colors.primary} />}
          title="Aucune idée pour l'instant"
          subtitle={participate ? "Lance la première idée de sortie et laisse le groupe voter." : "Les idées proposées apparaîtront ici."}
          actionLabel={participate ? "Proposer une idée" : undefined}
          onAction={participate ? () => setComposing(true) : undefined}
        />
      ) : (
        <View style={{ gap: spacing.md }}>
          {sorted.map((idea, i) => {
            const canDelete = owner || idea.proposed_by === userId;
            return (
              <FadeIn key={idea.id} delay={i * 50}>
                <Card style={{ gap: spacing.md }}>
                  <View style={{ flexDirection: "row", justifyContent: "space-between", gap: spacing.md }}>
                    <View style={{ flex: 1, gap: 4 }}>
                      <AppText variant="h3">{idea.title}</AppText>
                      {idea.description ? <AppText variant="bodyMuted">{idea.description}</AppText> : null}
                    </View>
                    {canDelete ? (
                      <TouchableOpacity onPress={() => deleteIdea.mutate(idea.id)} hitSlop={8}>
                        <Trash2 size={16} color={colors.textFaint} />
                      </TouchableOpacity>
                    ) : null}
                  </View>

                  <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                      <Avatar profile={idea.profile} size={24} />
                      <AppText variant="caption">{idea.profile?.name ?? "Membre"} · {formatRelative(idea.created_at)}</AppText>
                    </View>

                    <PressableScale
                      onPress={() => (participate ? toggleVote.mutate({ ideaId: idea.id, voted: idea.voted }) : toast.info("Seuls les membres peuvent voter."))}
                      style={{ flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingVertical: 7, borderRadius: radius.pill, backgroundColor: idea.voted ? colors.primary : colors.surface }}
                    >
                      <Flame size={15} color={idea.voted ? "#fff" : colors.textMuted} fill={idea.voted ? "#fff" : "transparent"} />
                      <AppText style={{ fontWeight: "700", fontSize: 13, color: idea.voted ? "#fff" : colors.textMuted }}>{idea.voteCount}</AppText>
                    </PressableScale>
                  </View>
                </Card>
              </FadeIn>
            );
          })}
        </View>
      )}
    </Screen>
  );
}
