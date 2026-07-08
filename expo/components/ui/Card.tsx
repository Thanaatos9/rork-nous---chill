import { LinearGradient } from "expo-linear-gradient";
import React from "react";
import { StatusBar } from "expo-status-bar";
import { ScrollView, StyleProp, View, ViewProps, ViewStyle } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, currentScheme, radius, shadows, spacing } from "@/constants/theme";
import { AppText } from "./Text";

interface CardProps extends ViewProps {
  elevated?: boolean;
  padded?: boolean;
  glow?: boolean;
  style?: StyleProp<ViewStyle>;
  children: React.ReactNode;
}

export function Card({ elevated, padded = true, glow, style, children, ...rest }: CardProps) {
  return (
    <View
      {...rest}
      style={[
        {
          backgroundColor: elevated ? colors.cardElevated : colors.card,
          borderRadius: radius.xl,
          borderWidth: 1,
          borderColor: glow ? colors.primary : colors.border,
          padding: padded ? spacing.lg : 0,
        },
        glow ? shadows.glow : shadows.card,
        style,
      ]}
    >
      {children}
    </View>
  );
}

/** Full-screen container with the deep cinematic gradient backdrop + safe areas. */
export function Screen({
  children,
  scroll = false,
  contentStyle,
  edges = ["top"],
  refreshControl,
}: {
  children: React.ReactNode;
  scroll?: boolean;
  contentStyle?: StyleProp<ViewStyle>;
  edges?: ("top" | "bottom" | "left" | "right")[];
  refreshControl?: React.ComponentProps<typeof ScrollView>["refreshControl"];
}) {
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <StatusBar style={currentScheme() === "dark" ? "light" : "dark"} />
      <LinearGradient
        colors={[colors.bgDeep, colors.bg, colors.bg]}
        locations={[0, 0.4, 1]}
        style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0 }}
      />
      <SafeAreaView style={{ flex: 1 }} edges={edges}>
        {scroll ? (
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={[{ paddingBottom: spacing.xxxl }, contentStyle]}
            keyboardShouldPersistTaps="handled"
            automaticallyAdjustKeyboardInsets
            refreshControl={refreshControl}
          >
            {children}
          </ScrollView>
        ) : (
          <View style={[{ flex: 1 }, contentStyle]}>{children}</View>
        )}
      </SafeAreaView>
    </View>
  );
}

export function Divider({ style }: { style?: StyleProp<ViewStyle> }) {
  return <View style={[{ height: 1, backgroundColor: colors.border }, style]} />;
}

export function SectionHeader({
  title,
  action,
  style,
}: {
  title: string;
  action?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View
      style={[
        { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: spacing.md },
        style,
      ]}
    >
      <AppText variant="overline">{title}</AppText>
      {action}
    </View>
  );
}

/** Convenience hook re-export so screens can pad around the home indicator. */
export { useSafeAreaInsets };
