import React, { useState } from "react";
import { ActivityIndicator, View } from "react-native";
import Svg, { Path } from "react-native-svg";
import { PressableScale } from "@/components/ui/motion";
import { AppText } from "@/components/ui/Text";
import { colors, radius, spacing } from "@/constants/theme";
import { friendlyError } from "@/lib/errors";
import type { OAuthProvider } from "@/lib/oauth";
import { useAuth } from "@/providers/auth";
import { useToast } from "@/providers/toast";

/** Official multi-color Google "G" mark. */
function GoogleGlyph({ size = 19 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 48 48">
      <Path
        fill="#EA4335"
        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
      />
      <Path
        fill="#4285F4"
        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
      />
      <Path
        fill="#FBBC05"
        d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
      />
      <Path
        fill="#34A853"
        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
      />
    </Svg>
  );
}

/** Apple logo glyph. */
function AppleGlyph({ size = 19, color = "#FFFFFF" }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        fill={color}
        d="M16.365 1.43c0 1.14-.493 2.27-1.177 3.08-.744.9-1.99 1.57-2.987 1.57-.12 0-.23-.02-.3-.03-.01-.06-.04-.22-.04-.39 0-1.15.572-2.27 1.206-2.98.804-.94 2.142-1.64 3.248-1.68.03.13.05.28.05.43zm4.565 15.71c-.03.07-.463 1.58-1.518 3.12-.945 1.34-1.94 2.71-3.43 2.71-1.517 0-1.9-.88-3.63-.88-1.698 0-2.302.91-3.67.91-1.377 0-2.332-1.26-3.428-2.8-1.287-1.82-2.323-4.63-2.323-7.28 0-4.28 2.797-6.55 5.552-6.55 1.448 0 2.675.95 3.6.95.865 0 2.222-1.01 3.902-1.01.613 0 2.886.06 4.374 2.19-.13.09-2.383 1.37-2.383 4.19 0 3.26 2.854 4.42 2.955 4.45z"
      />
    </Svg>
  );
}

interface RowProps {
  bg: string;
  fg: string;
  border?: string;
  glyph: React.ReactNode;
  label: string;
  loading: boolean;
  disabled: boolean;
  onPress: () => void;
}

function ProviderButton({ bg, fg, border, glyph, label, loading, disabled, onPress }: RowProps) {
  return (
    <PressableScale
      onPress={disabled ? undefined : onPress}
      disabled={disabled}
      scaleTo={0.97}
      style={{
        height: 54,
        borderRadius: radius.md,
        backgroundColor: bg,
        borderWidth: border ? 1 : 0,
        borderColor: border,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 10,
        opacity: disabled && !loading ? 0.5 : 1,
      }}
    >
      {loading ? (
        <ActivityIndicator color={fg} size="small" />
      ) : (
        <>
          {glyph}
          <AppText style={{ color: fg, fontSize: 16, fontWeight: "700", letterSpacing: -0.2 }}>{label}</AppText>
        </>
      )}
    </PressableScale>
  );
}

/**
 * Google + Apple sign-in buttons backed by Supabase social OAuth.
 * Works for both first-time sign-up and returning sign-in — Supabase resolves
 * the account automatically. Pass an `inviteCode` on the sign-up screen so it
 * is redeemed once the account lands.
 */
export function SocialAuthButtons({ inviteCode }: { inviteCode?: string }) {
  const { signInWithProvider } = useAuth();
  const toast = useToast();
  const [pending, setPending] = useState<OAuthProvider | null>(null);

  const run = async (provider: OAuthProvider) => {
    if (pending) return;
    setPending(provider);
    try {
      await signInWithProvider(provider, inviteCode);
      // On success the root auth gate navigates automatically.
    } catch (error) {
      toast.error(friendlyError(error));
    } finally {
      setPending(null);
    }
  };

  return (
    <View style={{ gap: spacing.md }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md, marginVertical: spacing.xs }}>
        <View style={{ flex: 1, height: 1, backgroundColor: colors.border }} />
        <AppText variant="caption">ou continuer avec</AppText>
        <View style={{ flex: 1, height: 1, backgroundColor: colors.border }} />
      </View>

      <ProviderButton
        bg="#FFFFFF"
        fg="#1F1F1F"
        border="#DADCE0"
        glyph={<GoogleGlyph />}
        label="Google"
        loading={pending === "google"}
        disabled={pending !== null}
        onPress={() => run("google")}
      />
      <ProviderButton
        bg="#000000"
        fg="#FFFFFF"
        glyph={<AppleGlyph />}
        label="Apple"
        loading={pending === "apple"}
        disabled={pending !== null}
        onPress={() => run("apple")}
      />
    </View>
  );
}
