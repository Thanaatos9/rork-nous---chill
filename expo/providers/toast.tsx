import createContextHook from "@nkzw/create-context-hook";
import { CircleAlert, CircleCheck, Info } from "lucide-react-native";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { Animated, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, currentScheme, radius, shadows, spacing } from "@/constants/theme";
import { AppText } from "@/components/ui/Text";
import { notify } from "@/components/ui/motion";
import * as Haptics from "expo-haptics";

type ToastType = "success" | "error" | "info";

interface ToastState {
  id: number;
  type: ToastType;
  message: string;
}

export const [ToastProvider, useToast] = createContextHook(() => {
  const [toast, setToast] = useState<ToastState | null>(null);
  const counter = useRef(0);

  const show = useCallback((message: string, type: ToastType = "info") => {
    counter.current += 1;
    setToast({ id: counter.current, type, message });
    if (type === "success") notify(Haptics.NotificationFeedbackType.Success);
    else if (type === "error") notify(Haptics.NotificationFeedbackType.Error);
  }, []);

  const success = useCallback((m: string) => show(m, "success"), [show]);
  const error = useCallback((m: string) => show(m, "error"), [show]);
  const info = useCallback((m: string) => show(m, "info"), [show]);

  return { toast, setToast, show, success, error, info };
});

export function ToastViewport() {
  const { toast, setToast } = useToast();
  const insets = useSafeAreaInsets();
  const anim = useRef(new Animated.Value(0)).current;
  const [visible, setVisible] = useState<ToastState | null>(null);

  useEffect(() => {
    if (!toast) return;
    setVisible(toast);
    Animated.spring(anim, { toValue: 1, useNativeDriver: true, speed: 18, bounciness: 7 }).start();
    const timer = setTimeout(() => {
      Animated.timing(anim, { toValue: 0, duration: 220, useNativeDriver: true }).start(() => {
        setVisible(null);
        setToast(null);
      });
    }, 2800);
    return () => clearTimeout(timer);
  }, [toast, anim, setToast]);

  if (!visible) return null;

  const isDark = currentScheme() === "dark";
  const tone =
    visible.type === "success"
      ? { color: colors.success, bg: isDark ? "#16271D" : "#E4F5EB", Icon: CircleCheck }
      : visible.type === "error"
      ? { color: colors.destructive, bg: isDark ? "#2A1718" : "#FBE9EB", Icon: CircleAlert }
      : { color: colors.text, bg: colors.cardElevated, Icon: Info };

  const translateY = anim.interpolate({ inputRange: [0, 1], outputRange: [-24, 0] });

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.wrap,
        { top: insets.top + spacing.sm, opacity: anim, transform: [{ translateY }] },
      ]}
    >
      <View style={[styles.toast, { backgroundColor: tone.bg, borderColor: tone.color }]}>
        <tone.Icon size={19} color={tone.color} />
        <AppText style={{ flex: 1, color: colors.text, fontSize: 14, fontWeight: "600" }}>{visible.message}</AppText>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: "absolute",
    left: spacing.lg,
    right: spacing.lg,
    zIndex: 1000,
    alignItems: "center",
  },
  toast: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderWidth: 1,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: 13,
    width: "100%",
    ...shadows.poster,
  },
});
