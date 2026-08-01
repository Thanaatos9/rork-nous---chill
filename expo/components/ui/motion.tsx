import * as Haptics from "expo-haptics";
import React, { useEffect, useRef, useState } from "react";
import {
  AccessibilityInfo,
  Animated,
  Easing,
  Platform,
  Pressable,
  PressableProps,
  StyleProp,
  ViewStyle,
} from "react-native";
import { colors, radius } from "@/constants/theme";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/**
 * Whether the OS asks for reduced motion (iOS Reduce Motion, Android Remove
 * Animations, `prefers-reduced-motion` on web). Looping and entrance animations
 * must honour it — `Pulse` in particular ran forever on the review CTA.
 */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState<boolean>(false);

  useEffect(() => {
    let active = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((value) => {
        if (active) setReduced(value);
      })
      .catch(() => {});
    const sub = AccessibilityInfo.addEventListener("reduceMotionChanged", (value) => {
      setReduced(value);
    });
    return () => {
      active = false;
      sub.remove();
    };
  }, []);

  return reduced;
}

export function haptic(style: Haptics.ImpactFeedbackStyle = Haptics.ImpactFeedbackStyle.Light) {
  if (Platform.OS === "web") return;
  Haptics.impactAsync(style).catch(() => {});
}

export function notify(type: Haptics.NotificationFeedbackType) {
  if (Platform.OS === "web") return;
  Haptics.notificationAsync(type).catch(() => {});
}

interface PressableScaleProps extends PressableProps {
  scaleTo?: number;
  withHaptic?: boolean;
  style?: StyleProp<ViewStyle>;
  children: React.ReactNode;
}

/** Pressable with a subtle press-in scale and optional haptic tick. */
export function PressableScale({
  scaleTo = 0.96,
  withHaptic = true,
  style,
  onPressIn,
  onPressOut,
  children,
  ...rest
}: PressableScaleProps) {
  const scale = useRef(new Animated.Value(1)).current;

  return (
    <AnimatedPressable
      {...rest}
      onPressIn={(e) => {
        if (withHaptic) haptic();
        Animated.spring(scale, { toValue: scaleTo, useNativeDriver: true, speed: 40, bounciness: 0 }).start();
        onPressIn?.(e);
      }}
      onPressOut={(e) => {
        Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 30, bounciness: 6 }).start();
        onPressOut?.(e);
      }}
      style={[{ transform: [{ scale }] }, style]}
    >
      {children}
    </AnimatedPressable>
  );
}

interface FadeInProps {
  children: React.ReactNode;
  delay?: number;
  offset?: number;
  duration?: number;
  style?: StyleProp<ViewStyle>;
}

/** Float-in: fade + upward translate. Use delay to stagger lists. */
export function FadeIn({ children, delay = 0, offset = 14, duration = 420, style }: FadeInProps) {
  const reduced = useReducedMotion();
  const v = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (reduced) {
      // Land on the final state immediately rather than sliding into it.
      v.setValue(1);
      return;
    }
    const anim = Animated.timing(v, {
      toValue: 1,
      duration,
      delay,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    });
    anim.start();
    return () => anim.stop();
  }, [v, delay, duration, reduced]);

  const translateY = v.interpolate({ inputRange: [0, 1], outputRange: [offset, 0] });
  return <Animated.View style={[{ opacity: v, transform: [{ translateY }] }, style]}>{children}</Animated.View>;
}

/** Looping red pulse used on attention elements (e.g. "new review available"). */
export function Pulse({ children, style, active = true }: { children: React.ReactNode; style?: StyleProp<ViewStyle>; active?: boolean }) {
  const reduced = useReducedMotion();
  const v = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // A never-ending loop is exactly what reduced-motion users switch off.
    if (!active || reduced) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(v, { toValue: 1, duration: 1100, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(v, { toValue: 0, duration: 1100, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [v, active, reduced]);

  const scale = v.interpolate({ inputRange: [0, 1], outputRange: [1, 1.06] });
  const opacity = v.interpolate({ inputRange: [0, 1], outputRange: [1, 0.78] });
  return <Animated.View style={[{ transform: [{ scale }], opacity }, style]}>{children}</Animated.View>;
}

/** Shimmer placeholder block for loading states. */
export function Shimmer({ width, height, style }: { width?: number | string; height?: number; style?: StyleProp<ViewStyle> }) {
  const v = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(v, { toValue: 1, duration: 800, useNativeDriver: true }),
        Animated.timing(v, { toValue: 0, duration: 800, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [v]);

  const opacity = v.interpolate({ inputRange: [0, 1], outputRange: [0.35, 0.75] });
  return (
    <Animated.View
      style={[
        { width: width as number, height, backgroundColor: colors.surface, borderRadius: radius.md, opacity },
        style,
      ]}
    />
  );
}
