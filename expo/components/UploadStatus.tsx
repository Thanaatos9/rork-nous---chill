import { CloudUpload } from "lucide-react-native";
import { useEffect, useRef } from "react";
import { ActivityIndicator, Animated, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AppText } from "@/components/ui/Text";
import { colors, currentScheme, radius, shadows, spacing } from "@/constants/theme";
import { usePendingUploads } from "@/hooks/useUploadQueue";
import { subscribeUploadRuns } from "@/lib/uploadQueue";
import { useToast } from "@/providers/toast";

/**
 * The two halves of "your photos are on their way".
 *
 * A banner while it lasts, because the transfer stops when the app leaves the
 * foreground and nobody can be expected to guess that; and one toast when the
 * queue finally empties, because a message that only ever warns and never
 * confirms teaches people to distrust it.
 *
 * Mounted once at the root: the files outlive the screen that picked them, so
 * their status has to outlive it too.
 */
export function UploadStatus() {
  const pending = usePendingUploads();
  // The two callbacks, not the whole toast object: that one changes identity
  // every time a message is shown, which would tear this subscription down and
  // rebuild it for no reason.
  const { success: toastSuccess, error: toastError } = useToast();
  const count = pending.length;

  const anim = useRef(new Animated.Value(0)).current;
  const insets = useSafeAreaInsets();

  useEffect(() => {
    Animated.spring(anim, {
      toValue: count > 0 ? 1 : 0,
      useNativeDriver: true,
      speed: 16,
      bounciness: 6,
    }).start();
  }, [count, anim]);

  useEffect(
    () =>
      subscribeUploadRuns(({ sent, failed }) => {
        if (failed > 0) {
          toastError(
            sent > 0
              ? `${sent} média${sent > 1 ? "s envoyés" : " envoyé"}, ${failed} en échec — réessaie de ${failed > 1 ? "les" : "l'"}ajouter.`
              : `L'envoi ${failed > 1 ? `de ${failed} médias a échoué` : "du média a échoué"}. Réessaie de ${failed > 1 ? "les" : "l'"}ajouter.`,
          );
          return;
        }
        toastSuccess(sent > 1 ? `${sent} médias envoyés ✓` : "Média envoyé ✓");
      }),
    [toastSuccess, toastError],
  );

  if (count === 0) return null;

  const translateY = anim.interpolate({ inputRange: [0, 1], outputRange: [24, 0] });

  return (
    <Animated.View
      pointerEvents="none"
      accessibilityLiveRegion="polite"
      style={[
        styles.wrap,
        { bottom: insets.bottom + spacing.lg, opacity: anim, transform: [{ translateY }] },
      ]}
    >
      {/* Opaque, not a green tint: this floats over episode screens that are
          mostly photograph, and a translucent panel there is unreadable. */}
      <View style={[styles.box, { backgroundColor: currentScheme() === "dark" ? "#16271D" : "#E4F5EB" }]}>
        <CloudUpload size={19} color={colors.success} />
        <View style={{ flex: 1, gap: 1 }}>
          <AppText style={styles.title}>
            {count > 1 ? `Envoi de ${count} médias en cours` : "Envoi du média en cours"}
          </AppText>
          <AppText style={styles.hint}>Garde l&apos;application ouverte.</AppText>
        </View>
        <ActivityIndicator size="small" color={colors.success} />
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: "absolute",
    left: spacing.lg,
    right: spacing.lg,
    // Above the toast's own stacking context is not wanted: a one-off message
    // should still be able to sit on top of a status that lasts.
    zIndex: 900,
    alignItems: "center",
  },
  box: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    width: "100%",
    borderWidth: 1,
    borderColor: colors.success,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: 12,
    ...shadows.poster,
  },
  title: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.text,
  },
  hint: {
    fontSize: 12.5,
    color: colors.textMuted,
  },
});
