import { useRouter } from "expo-router";
import { ChevronLeft } from "lucide-react-native";
import React from "react";
import { StyleProp, View, ViewStyle } from "react-native";
import { colors, spacing } from "@/constants/theme";
import { IconButton } from "@/components/ui/Button";
import { AppText } from "@/components/ui/Text";

interface Props {
  title?: string;
  subtitle?: string;
  right?: React.ReactNode;
  showBack?: boolean;
  onBack?: () => void;
  style?: StyleProp<ViewStyle>;
}

export function AppHeader({ title, subtitle, right, showBack = true, onBack, style }: Props) {
  const router = useRouter();
  return (
    <View
      style={[
        {
          flexDirection: "row",
          alignItems: "center",
          gap: spacing.md,
          paddingHorizontal: spacing.lg,
          paddingTop: spacing.sm,
          paddingBottom: spacing.md,
        },
        style,
      ]}
    >
      {showBack ? (
        <IconButton
          icon={<ChevronLeft size={22} color={colors.text} />}
          onPress={onBack ?? (() => router.back())}
          variant="secondary"
          size={40}
          accessibilityLabel="Retour"
        />
      ) : null}
      <View style={{ flex: 1 }}>
        {title ? (
          <AppText variant="h2" numberOfLines={1}>
            {title}
          </AppText>
        ) : null}
        {subtitle ? (
          <AppText variant="caption" numberOfLines={1} style={{ marginTop: 1 }}>
            {subtitle}
          </AppText>
        ) : null}
      </View>
      {right}
    </View>
  );
}
