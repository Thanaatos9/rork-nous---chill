import React from "react";
import { ActivityIndicator, StyleProp, TextStyle, View, ViewStyle } from "react-native";
import { colors, radius } from "@/constants/theme";
import { AppText } from "./Text";
import { PressableScale } from "./motion";

type Variant = "primary" | "secondary" | "outline" | "ghost" | "destructive" | "gold" | "subtle";
type Size = "sm" | "md" | "lg";

interface Props {
  title?: string;
  onPress?: () => void;
  variant?: Variant;
  size?: Size;
  icon?: React.ReactNode;
  iconRight?: React.ReactNode;
  loading?: boolean;
  disabled?: boolean;
  fullWidth?: boolean;
  style?: StyleProp<ViewStyle>;
  /** Required when the button has no `title` — otherwise it is unlabelled to screen readers. */
  accessibilityLabel?: string;
}

const sizeMap: Record<Size, { height: number; px: number; font: number; gap: number }> = {
  sm: { height: 38, px: 14, font: 14, gap: 7 },
  md: { height: 48, px: 18, font: 15, gap: 9 },
  lg: { height: 54, px: 22, font: 16, gap: 10 },
};

function palette(variant: Variant): { bg: string; fg: string; border?: string } {
  switch (variant) {
    case "primary":
      return { bg: colors.primary, fg: colors.primaryFg };
    case "secondary":
      return { bg: colors.surface, fg: colors.text };
    case "outline":
      return { bg: "transparent", fg: colors.text, border: colors.borderStrong };
    case "ghost":
      return { bg: "transparent", fg: colors.text };
    case "destructive":
      return { bg: colors.destructive, fg: "#FFFFFF" };
    case "gold":
      return { bg: colors.accent, fg: "#1A1607" };
    case "subtle":
      return { bg: colors.primarySoft, fg: colors.primary };
  }
}

export function Button({
  title,
  onPress,
  variant = "primary",
  size = "md",
  icon,
  iconRight,
  loading = false,
  disabled = false,
  fullWidth = false,
  style,
  accessibilityLabel,
}: Props) {
  const s = sizeMap[size];
  const p = palette(variant);
  const isDisabled = disabled || loading;

  const labelStyle: TextStyle = {
    color: p.fg,
    fontSize: s.font,
    fontWeight: "700",
    letterSpacing: -0.2,
  };

  return (
    <PressableScale
      onPress={isDisabled ? undefined : onPress}
      disabled={isDisabled}
      scaleTo={0.97}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title}
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      style={[
        {
          height: s.height,
          paddingHorizontal: s.px,
          borderRadius: radius.md,
          backgroundColor: p.bg,
          borderWidth: p.border ? 1.5 : 0,
          borderColor: p.border,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: s.gap,
          opacity: isDisabled ? 0.5 : 1,
          alignSelf: fullWidth ? "stretch" : "auto",
          width: fullWidth ? "100%" : undefined,
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={p.fg} size="small" />
      ) : (
        <>
          {icon ? <View>{icon}</View> : null}
          {title ? <AppText style={labelStyle}>{title}</AppText> : null}
          {iconRight ? <View>{iconRight}</View> : null}
        </>
      )}
    </PressableScale>
  );
}

/** A compact circular icon button. */
export function IconButton({
  icon,
  onPress,
  variant = "secondary",
  size = 42,
  style,
  accessibilityLabel,
}: {
  icon: React.ReactNode;
  onPress?: () => void;
  variant?: Variant;
  size?: number;
  style?: StyleProp<ViewStyle>;
  /** An icon-only control is invisible to screen readers without this. */
  accessibilityLabel: string;
}) {
  const p = palette(variant);
  return (
    <PressableScale
      onPress={onPress}
      scaleTo={0.9}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={[
        {
          width: size,
          height: size,
          borderRadius: radius.pill,
          backgroundColor: p.bg,
          borderWidth: p.border ? 1.5 : 0,
          borderColor: p.border,
          alignItems: "center",
          justifyContent: "center",
        },
        style,
      ]}
    >
      {icon}
    </PressableScale>
  );
}
