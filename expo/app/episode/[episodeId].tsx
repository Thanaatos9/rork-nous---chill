import { useLocalSearchParams, useRouter } from "expo-router";
import {
  Camera,
  CheckCircle2,
  ChevronLeft,
  Clock,
  Heart,
  Hourglass,
  ImagePlus,
  Lock,
  MapPin,
  MessageCircle,
  Music,
  PenLine,
  Send,
  Sparkles,
  Trash2,
} from "lucide-react-native";
import React, { useMemo, useState } from "react";
import { Alert, ScrollView, TextInput, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { CoverAdjustModal } from "@/components/CoverAdjustModal";
import { MediaGallery, MediaGrid } from "@/components/MediaGallery";
import { RatingStars } from "@/components/RatingStars";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { Button, IconButton } from "@/components/ui/Button";
import { Card, Divider, SectionHeader } from "@/components/ui/Card";
import { Loader } from "@/components/ui/Feedback";
import { useAutoGrow } from "@/components/ui/Input";
import { FadeIn, Pulse, PressableScale } from "@/components/ui/motion";
import { AppText } from "@/components/ui/Text";
import { colors, radius, spacing } from "@/constants/theme";
import { friendlyError } from "@/lib/errors";
import { formatDate, formatDuration, formatRelative, normalizeTags } from "@/lib/format";
import { pickCoverImage, pickFromLibrary, type PickedAsset } from "@/lib/media";
import { canParticipate, effectiveRole, isOwner, type EpisodeComment, type EpisodeMedia, type Review, type SpaceMember } from "@/lib/types";
import {
  useAddEpisodeMedia,
  useDeleteEpisode,
  useDeleteEpisodeMedia,
  useEpisode,
  useEpisodeLikes,
  useSetEpisodeCover,
  useToggleLike,
} from "@/hooks/useEpisodes";
import { useMembers } from "@/hooks/useMembers";
import { useEpisodeReviews, useMyReview } from "@/hooks/useReviews";
import { useAddComment, useComments, useDeleteComment, useToggleReaction } from "@/hooks/useSocial";
import { useSpace } from "@/hooks/useSpaces";
import { useAuth } from "@/providers/auth";
import { useToast } from "@/providers/toast";

const REACTION_EMOJIS = ["❤️", "😂", "😮", "🔥", "🥹", "👏"];

function ReviewContentRows({ review }: { review: Review }) {
  const rows: { label: string; value: string | null; icon?: React.ReactNode }[] = [
    { label: "Moment préféré", value: review.favorite_moment },
    { label: "Moment gênant", value: review.awkward_moment },
    { label: "Citation drôle", value: review.funny_quote },
    { label: "Résumé", value: review.summary },
  ];
  return (
    <View style={{ gap: spacing.md }}>
      {rows
        .filter((r) => r.value)
        .map((r) => (
          <View key={r.label} style={{ gap: 3 }}>
            <AppText variant="overline">{r.label}</AppText>
            <AppText variant="body">{r.value}</AppText>
          </View>
        ))}
      {review.song ? (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <Music size={15} color={colors.accent} />
          <AppText style={{ color: colors.accent, fontWeight: "600", fontSize: 14 }} numberOfLines={1}>
            {review.song}
          </AppText>
        </View>
      ) : null}
    </View>
  );
}

function CommentItem({
  comment,
  meId,
  canDelete,
  onReact,
  onDelete,
}: {
  comment: EpisodeComment;
  meId: string | null;
  canDelete: boolean;
  onReact: (emoji: string, active: boolean) => void;
  onDelete: () => void;
}) {
  const grouped = useMemo(() => {
    const map: Record<string, { count: number; mine: boolean }> = {};
    for (const r of comment.reactions ?? []) {
      if (!map[r.emoji]) map[r.emoji] = { count: 0, mine: false };
      map[r.emoji].count += 1;
      if (r.user_id === meId) map[r.emoji].mine = true;
    }
    return map;
  }, [comment.reactions, meId]);

  const [showPicker, setShowPicker] = useState<boolean>(false);

  return (
    <View style={{ flexDirection: "row", gap: spacing.md }}>
      <Avatar profile={comment.profile} size={36} />
      <View style={{ flex: 1, gap: 6 }}>
        <View style={{ backgroundColor: colors.card, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: spacing.md, gap: 3 }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <AppText style={{ fontWeight: "700", fontSize: 13.5, color: colors.text }}>{comment.profile?.name ?? "Membre"}</AppText>
            <AppText variant="caption">{formatRelative(comment.created_at)}</AppText>
          </View>
          <AppText variant="body">{comment.body}</AppText>
        </View>

        <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
          {Object.entries(grouped).map(([emoji, info]) => (
            <PressableScale key={emoji} onPress={() => onReact(emoji, info.mine)} withHaptic style={{ flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 9, paddingVertical: 4, borderRadius: radius.pill, backgroundColor: info.mine ? colors.primarySoft : colors.surface, borderWidth: info.mine ? 1 : 0, borderColor: colors.primary }}>
              <AppText style={{ fontSize: 13 }}>{emoji}</AppText>
              <AppText style={{ fontSize: 12, fontWeight: "700", color: info.mine ? colors.primary : colors.textMuted }}>{info.count}</AppText>
            </PressableScale>
          ))}
          <TouchableOpacity onPress={() => setShowPicker((v) => !v)} hitSlop={8} style={{ paddingHorizontal: 8, paddingVertical: 4 }}>
            <AppText style={{ fontSize: 15, color: colors.textFaint }}>＋</AppText>
          </TouchableOpacity>
          {canDelete ? (
            <TouchableOpacity onPress={onDelete} hitSlop={8} style={{ paddingHorizontal: 4, paddingVertical: 4 }}>
              <Trash2 size={14} color={colors.textFaint} />
            </TouchableOpacity>
          ) : null}
        </View>

        {showPicker ? (
          <View style={{ flexDirection: "row", gap: 4, backgroundColor: colors.cardElevated, borderRadius: radius.pill, padding: 6, alignSelf: "flex-start", borderWidth: 1, borderColor: colors.border }}>
            {REACTION_EMOJIS.map((emoji) => (
              <TouchableOpacity
                key={emoji}
                onPress={() => {
                  onReact(emoji, grouped[emoji]?.mine ?? false);
                  setShowPicker(false);
                }}
                style={{ padding: 4 }}
              >
                <AppText style={{ fontSize: 19 }}>{emoji}</AppText>
              </TouchableOpacity>
            ))}
          </View>
        ) : null}
      </View>
    </View>
  );
}

export default function EpisodeDetailScreen() {
  const { episodeId } = useLocalSearchParams<{ episodeId: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const { userId } = useAuth();

  const { data: episode, isLoading } = useEpisode(episodeId);
  const spaceId = episode?.space_id ?? "";
  const { data: space } = useSpace(spaceId);
  const { data: members } = useMembers(spaceId);
  const { data: reviews } = useEpisodeReviews(episodeId);
  const { data: myReview } = useMyReview(episodeId);
  const { data: comments } = useComments(episodeId);
  const { data: likes } = useEpisodeLikes(episodeId);

  const toggleLike = useToggleLike(episodeId);
  const addComment = useAddComment(episodeId);
  const deleteComment = useDeleteComment(episodeId);
  const toggleReaction = useToggleReaction(episodeId);
  const addMedia = useAddEpisodeMedia(episodeId, spaceId);

  const setCover = useSetEpisodeCover(episodeId, spaceId);
  const deleteMedia = useDeleteEpisodeMedia(episodeId, spaceId);
  const deleteEpisode = useDeleteEpisode(spaceId);

  const [pendingCover, setPendingCover] = useState<PickedAsset | null>(null);
  const [draft, setDraft] = useState<string>("");
  // The composer sits in the page scroll, so it can grow with the comment
  // rather than trapping a long one behind an inner scrollbar.
  const draftGrow = useAutoGrow({ enabled: true, value: draft, minHeight: 47, extraHeight: 3 });

  const participate = canParticipate(space?.membership);
  const isObserver = effectiveRole(space?.membership) === "observer";
  // Destructive actions stay with the space owner and the person who wrote the
  // episode — not with every participant.
  const canManage = isOwner(space?.membership) || (!!userId && episode?.created_by === userId);
  const unlocked = !!space?.season_unlocked;

  const answeredIds = useMemo(() => new Set((reviews ?? []).map((r) => r.author_id)), [reviews]);
  const reviewers: SpaceMember[] = useMemo(
    () => (members ?? []).filter((m) => m.role === "owner" || (m.role === "member" && m.can_create_episodes)),
    [members]
  );

  if (isLoading || !episode) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg }}>
        <Loader label="Chargement de l'épisode…" />
      </View>
    );
  }

  const tags = normalizeTags(episode.tags);
  const media = episode.media ?? [];
  const mediaCount = media.length;

  // The cover is the episode's poster and stays what it was at creation:
  // media added later fills the album below, it never rewrites the top of the
  // screen. `cover_url` may point at a row that is not loaded (or no longer
  // exists), so fall back to a stand-in item rather than dropping the image.
  const coverItem: EpisodeMedia | null = episode.cover_url
    ? media.find((m) => m.url === episode.cover_url) ?? {
        id: "cover",
        episode_id: episode.id,
        url: episode.cover_url,
        type: "image",
        created_at: episode.created_at,
      }
    : null;

  // Two distinct actions on purpose: this one replaces the poster at the top of
  // the screen, the album button below feeds the gallery. Neither touches the
  // other.
  const onPickCover = async () => {
    try {
      const asset = await pickCoverImage();
      if (asset) setPendingCover(asset);
    } catch (e) {
      toast.error(friendlyError(e));
    }
  };

  const onCoverAdjusted = async (cropped: PickedAsset) => {
    setPendingCover(null);
    try {
      await setCover.mutateAsync(cropped);
      toast.success("Couverture mise à jour");
    } catch (e) {
      toast.error(friendlyError(e));
    }
  };

  const onAddMedia = async () => {
    try {
      const picked = await pickFromLibrary(true);
      if (picked.length) {
        const { added, failed } = await addMedia.mutateAsync(picked);
        if (failed > 0) {
          toast.info(`${added} média${added > 1 ? "s ajoutés" : " ajouté"}, ${failed} en échec.`);
        } else {
          toast.success(added > 1 ? "Médias ajoutés" : "Média ajouté");
        }
      }
    } catch (e) {
      toast.error(friendlyError(e));
    }
  };

  const confirmDeleteMedia = (item: EpisodeMedia) => {
    Alert.alert(
      item.type === "video" ? "Supprimer cette vidéo ?" : "Supprimer cette photo ?",
      "Elle disparaîtra de la galerie pour tout le monde. Cette action est irréversible.",
      [
        { text: "Annuler", style: "cancel" },
        {
          text: "Supprimer",
          style: "destructive",
          onPress: async () => {
            try {
              await deleteMedia.mutateAsync(item.id);
              toast.success("Média supprimé");
            } catch (e) {
              toast.error(friendlyError(e));
            }
          },
        },
      ],
    );
  };

  const confirmDeleteEpisode = () => {
    Alert.alert(
      "Supprimer cet épisode ?",
      `« ${episode.title} », ses photos, ses commentaires et les reviews associées seront définitivement supprimés.`,
      [
        { text: "Annuler", style: "cancel" },
        {
          text: "Supprimer",
          style: "destructive",
          onPress: async () => {
            try {
              await deleteEpisode.mutateAsync(episodeId);
              toast.success("Épisode supprimé");
              router.back();
            } catch (e) {
              toast.error(friendlyError(e));
            }
          },
        },
      ],
    );
  };

  const onSendComment = async () => {
    if (!draft.trim()) return;
    try {
      await addComment.mutateAsync(draft);
      setDraft("");
    } catch (e) {
      toast.error(friendlyError(e));
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: spacing.xxxl }} automaticallyAdjustKeyboardInsets>
        {/* Hero gallery */}
        <View>
          <MediaGallery media={coverItem ? [coverItem] : []} height={380} />
          <View style={{ position: "absolute", top: insets.top + 6, left: spacing.lg, right: spacing.lg, flexDirection: "row", justifyContent: "space-between" }}>
            <IconButton icon={<ChevronLeft size={22} color="#fff" />} onPress={() => router.back()} size={42} style={{ backgroundColor: "rgba(0,0,0,0.45)" }} accessibilityLabel="Retour" />
            {participate ? (
              <IconButton
                icon={<Camera size={20} color="#fff" />}
                onPress={onPickCover}
                size={42}
                style={{ backgroundColor: "rgba(0,0,0,0.45)" }}
                accessibilityLabel={coverItem ? "Changer la photo de couverture" : "Ajouter une photo de couverture"}
              />
            ) : null}
          </View>
        </View>

        <View style={{ paddingHorizontal: spacing.lg, gap: spacing.xxl, marginTop: spacing.xl }}>
          {/* Meta */}
          <FadeIn>
            <View style={{ gap: spacing.sm }}>
              <AppText variant="title">{episode.title}</AppText>
              <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md, flexWrap: "wrap" }}>
                {episode.date ? <AppText variant="bodyMuted">{formatDate(episode.date)}</AppText> : null}
                {episode.place ? (
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                    <MapPin size={14} color={colors.textMuted} />
                    <AppText variant="bodyMuted">{episode.place}</AppText>
                  </View>
                ) : null}
                {episode.duration ? (
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                    <Clock size={14} color={colors.textMuted} />
                    <AppText variant="bodyMuted">{formatDuration(episode.duration)}</AppText>
                  </View>
                ) : null}
              </View>
              {tags.length > 0 ? (
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 2 }}>
                  {tags.map((t) => (
                    <Badge key={t} label={t} tone="muted" />
                  ))}
                </View>
              ) : null}
            </View>
          </FadeIn>

          {/* Like / comment counts */}
          <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.xl }}>
            <PressableScale onPress={() => toggleLike.mutate(likes?.liked ?? false)} style={{ flexDirection: "row", alignItems: "center", gap: 7 }}>
              <Heart size={22} color={likes?.liked ? colors.primary : colors.textMuted} fill={likes?.liked ? colors.primary : "transparent"} />
              <AppText style={{ fontWeight: "700", color: likes?.liked ? colors.primary : colors.textMuted }}>{likes?.count ?? 0}</AppText>
            </PressableScale>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 7 }}>
              <MessageCircle size={21} color={colors.textMuted} />
              <AppText style={{ fontWeight: "700", color: colors.textMuted }}>{comments?.length ?? 0}</AppText>
            </View>
          </View>

          <Divider />

          {/* Reviews / private mechanic */}
          <View style={{ gap: spacing.md }}>
            <SectionHeader title={unlocked ? "Les reviews révélées" : "Reviews"} />

            {unlocked ? (
              reviewers.length === 0 ? (
                <AppText variant="bodyMuted">Personne n&apos;a participé à cet épisode.</AppText>
              ) : (
                <View style={{ gap: spacing.md }}>
                  {reviewers.map((member) => {
                    const review = (reviews ?? []).find((r) => r.author_id === member.user_id);
                    return (
                      <Card key={member.user_id} style={{ gap: spacing.md }}>
                        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                            <Avatar profile={member.profile} size={36} />
                            <AppText variant="h3">{member.profile?.name ?? "Membre"}</AppText>
                          </View>
                          {review?.rating ? <RatingStars value={review.rating} size={16} /> : null}
                        </View>
                        {review ? (
                          <ReviewContentRows review={review} />
                        ) : (
                          <AppText variant="bodyMuted">N&apos;a pas rédigé de review.</AppText>
                        )}
                      </Card>
                    );
                  })}
                </View>
              )
            ) : (
              <>
                {/* My review status card */}
                {participate ? (
                  myReview ? (
                    <Card glow style={{ gap: spacing.md }}>
                      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                          <Lock size={16} color={colors.accent} />
                          <AppText variant="h3">Ta review est scellée</AppText>
                        </View>
                        {myReview.rating ? <RatingStars value={myReview.rating} size={15} /> : null}
                      </View>
                      <AppText variant="bodyMuted">Elle sera révélée à tous au déverrouillage de la saison. Toi seul(e) peux la voir d&apos;ici là.</AppText>
                      <Button title="Modifier ma review" variant="secondary" icon={<PenLine size={16} color={colors.text} />} onPress={() => router.push({ pathname: "/review/[episodeId]", params: { episodeId } })} />
                    </Card>
                  ) : (
                    <Pulse>
                      <Card glow style={{ gap: spacing.md, alignItems: "center" }}>
                        <View style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: colors.primarySoft, alignItems: "center", justifyContent: "center" }}>
                          <PenLine size={24} color={colors.primary} />
                        </View>
                        <AppText variant="h3" center>Écris ta review en privé</AppText>
                        <AppText variant="bodyMuted" center>Ce que tu ressens, ta note, ta citation préférée. Personne ne la verra avant la fin de saison.</AppText>
                        <Button title="Écrire ma review" onPress={() => router.push({ pathname: "/review/[episodeId]", params: { episodeId } })} fullWidth />
                      </Card>
                    </Pulse>
                  )
                ) : (
                  <Card style={{ flexDirection: "row", gap: 10, alignItems: "center" }}>
                    <Lock size={18} color={colors.textMuted} />
                    <AppText variant="bodyMuted" style={{ flex: 1 }}>
                      {isObserver ? "En tant qu'observateur, tu ne rédiges pas de review — mais tu peux réagir et commenter." : "Tu pourras écrire ta review une fois promu."}
                    </AppText>
                  </Card>
                )}

                {/* Who answered */}
                {reviewers.length > 0 ? (
                  <Card style={{ gap: spacing.md }}>
                    <AppText variant="overline">Qui a déjà répondu</AppText>
                    {reviewers.map((member) => {
                      const answered = answeredIds.has(member.user_id);
                      return (
                        <View key={member.user_id} style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                          <Avatar profile={member.profile} size={30} />
                          <AppText style={{ flex: 1, fontWeight: "600", color: colors.text }}>{member.profile?.name ?? "Membre"}</AppText>
                          {answered ? (
                            <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
                              <CheckCircle2 size={16} color={colors.success} />
                              <AppText style={{ color: colors.success, fontWeight: "600", fontSize: 12.5 }}>A répondu</AppText>
                            </View>
                          ) : (
                            <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
                              <Hourglass size={15} color={colors.textFaint} />
                              <AppText style={{ color: colors.textFaint, fontWeight: "600", fontSize: 12.5 }}>En attente</AppText>
                            </View>
                          )}
                        </View>
                      );
                    })}
                  </Card>
                ) : null}
              </>
            )}
          </View>

          <Divider />

          {/* Album — everything shot that day, cover included. Sits under the
              reviews so the top of the screen stays the poster. */}
          <View style={{ gap: spacing.md }}>
            <SectionHeader
              title={`Photos & vidéos${mediaCount > 0 ? ` · ${mediaCount}` : ""}`}
              subtitle="La couverture, elle, ne bouge plus"
            />
            <MediaGrid
              media={media}
              emptyLabel="Aucune photo ni vidéo pour l'instant."
              onDelete={canManage ? confirmDeleteMedia : undefined}
            />
            {participate ? (
              <Button
                title={mediaCount > 0 ? "Ajouter des photos ou vidéos" : "Ajouter les premières photos"}
                variant="secondary"
                icon={<ImagePlus size={18} color={colors.text} />}
                onPress={onAddMedia}
                loading={addMedia.isPending}
                fullWidth
                style={{ marginTop: spacing.xs }}
              />
            ) : null}
          </View>

          <Divider />

          {/* Comments */}
          <View style={{ gap: spacing.lg }}>
            <SectionHeader title={`Commentaires${comments && comments.length > 0 ? ` · ${comments.length}` : ""}`} />

            {comments && comments.length > 0 ? (
              comments.map((c) => (
                <CommentItem
                  key={c.id}
                  comment={c}
                  meId={userId}
                  canDelete={c.author_id === userId}
                  onReact={(emoji, active) => toggleReaction.mutate({ commentId: c.id, emoji, active })}
                  onDelete={() => deleteComment.mutate(c.id)}
                />
              ))
            ) : (
              <AppText variant="bodyMuted">Sois le premier à réagir à ce moment.</AppText>
            )}

            {participate ? (
              <View style={{ flexDirection: "row", alignItems: "flex-end", gap: spacing.sm, marginTop: spacing.sm }}>
                <TextInput
                  ref={draftGrow.ref}
                  value={draft}
                  onChangeText={setDraft}
                  placeholder="Ajouter un commentaire…"
                  placeholderTextColor={colors.textFaint}
                  onSubmitEditing={onSendComment}
                  onContentSizeChange={draftGrow.onContentSizeChange}
                  returnKeyType="send"
                  multiline
                  textAlignVertical="top"
                  style={{ flex: 1, color: colors.text, fontSize: 15, backgroundColor: colors.bgElevated, borderRadius: radius.xl, borderWidth: 1.5, borderColor: colors.border, paddingHorizontal: spacing.lg, paddingTop: 12, paddingBottom: 12, minHeight: draftGrow.minHeight, height: draftGrow.height }}
                />
                <IconButton icon={<Send size={18} color={colors.primaryFg} />} variant="primary" onPress={onSendComment} accessibilityLabel="Envoyer le commentaire" />
              </View>
            ) : isObserver ? (
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: spacing.sm }}>
                <Sparkles size={15} color={colors.textFaint} />
                <AppText variant="caption">Les observateurs peuvent réagir aux commentaires existants.</AppText>
              </View>
            ) : null}
          </View>

          {canManage ? (
            <>
              <Divider />
              <Button
                title="Supprimer l'épisode"
                variant="destructive"
                icon={<Trash2 size={17} color="#fff" />}
                onPress={confirmDeleteEpisode}
                loading={deleteEpisode.isPending}
                fullWidth
              />
            </>
          ) : null}
        </View>
      </ScrollView>

      <CoverAdjustModal
        asset={pendingCover}
        onCancel={() => setPendingCover(null)}
        onDone={onCoverAdjusted}
      />
    </View>
  );
}

