import * as Linking from "expo-linking";
import { useRouter } from "expo-router";
import { Eye, EyeOff, Lock, ShieldCheck } from "lucide-react-native";
import { useEffect, useState } from "react";
import { ActivityIndicator, Platform, TouchableOpacity, View } from "react-native";
import { AuthScaffold } from "@/components/AuthScaffold";
import { BrandMark } from "@/components/Brand";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Field, Input } from "@/components/ui/Input";
import { FadeIn } from "@/components/ui/motion";
import { AppText } from "@/components/ui/Text";
import { colors, spacing } from "@/constants/theme";
import { friendlyError } from "@/lib/errors";
import { establishRecoverySession, isRecoveryUrl } from "@/lib/passwordReset";
import { useAuth } from "@/providers/auth";
import { useToast } from "@/providers/toast";

/** True when a URL actually carries a recovery token (not just the path). */
function hasRecoveryToken(url: string): boolean {
  return /type=recovery/i.test(url) || /access_token=/i.test(url) || /[?&#]code=/i.test(url);
}

export default function ResetPasswordScreen() {
  const router = useRouter();
  const toast = useToast();
  const { recoveryMode, updatePassword, enterRecoveryMode, cancelRecovery } = useAuth();

  const [password, setPassword] = useState<string>("");
  const [confirm, setConfirm] = useState<string>("");
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [preparing, setPreparing] = useState<boolean>(!recoveryMode);

  // Establish the recovery session (native) or wait for the PASSWORD_RECOVERY
  // event (web, via detectSessionInUrl) before showing the form.
  useEffect(() => {
    if (recoveryMode) {
      setPreparing(false);
      return;
    }
    let active = true;
    let timeout: ReturnType<typeof setTimeout> | undefined;

    (async () => {
      if (Platform.OS === "web") {
        const href = typeof window !== "undefined" ? window.location.href : "";
        if (hasRecoveryToken(href)) {
          // Give supabase-js a moment to parse the URL and emit the event.
          timeout = setTimeout(() => {
            if (active) setPreparing(false);
          }, 4000);
        } else if (active) {
          setPreparing(false);
        }
        return;
      }

      try {
        const url = await Linking.getInitialURL();
        if (url && isRecoveryUrl(url) && (await establishRecoverySession(url))) {
          if (active) enterRecoveryMode();
        }
      } catch {
        // Fall through to the expired-link state below.
      } finally {
        if (active) setPreparing(false);
      }
    })();

    return () => {
      active = false;
      if (timeout) clearTimeout(timeout);
    };
  }, [recoveryMode, enterRecoveryMode]);

  const onSubmit = async () => {
    if (password.length < 6) {
      toast.error("Le mot de passe doit faire au moins 6 caractères.");
      return;
    }
    if (password !== confirm) {
      toast.error("Les deux mots de passe ne correspondent pas.");
      return;
    }
    setLoading(true);
    try {
      await updatePassword(password);
      toast.success("Mot de passe mis à jour ✅");
      // Recovery mode is now cleared → the root gate routes to home.
    } catch (error) {
      toast.error(friendlyError(error));
    } finally {
      setLoading(false);
    }
  };

  const onCancel = async () => {
    await cancelRecovery();
    router.replace("/login");
  };

  if (preparing) {
    return (
      <AuthScaffold>
        <View style={{ alignItems: "center", gap: spacing.lg }}>
          <ActivityIndicator color={colors.primary} />
          <AppText variant="bodyMuted">Vérification du lien…</AppText>
        </View>
      </AuthScaffold>
    );
  }

  if (!recoveryMode) {
    return (
      <AuthScaffold>
        <FadeIn>
          <View style={{ alignItems: "center", gap: spacing.lg }}>
            <BrandMark size={64} />
            <AppText variant="title" center>
              Lien expiré
            </AppText>
            <AppText variant="bodyMuted" center style={{ maxWidth: 300 }}>
              Ce lien de réinitialisation n&apos;est plus valide. Demande-en un nouveau pour continuer.
            </AppText>
            <Button
              title="Demander un nouveau lien"
              onPress={() => router.replace("/forgot-password")}
              size="lg"
              fullWidth
              style={{ marginTop: spacing.sm }}
            />
            <TouchableOpacity onPress={onCancel}>
              <AppText style={{ color: colors.textMuted, fontWeight: "600" }}>Retour à la connexion</AppText>
            </TouchableOpacity>
          </View>
        </FadeIn>
      </AuthScaffold>
    );
  }

  return (
    <AuthScaffold>
      <FadeIn>
        <View style={{ alignItems: "center", gap: spacing.md, marginBottom: spacing.xl }}>
          <View
            style={{
              width: 84,
              height: 84,
              borderRadius: 42,
              backgroundColor: colors.primarySoft,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <ShieldCheck size={38} color={colors.primary} />
          </View>
          <AppText variant="title" center>
            Nouveau mot de passe
          </AppText>
          <AppText variant="bodyMuted" center style={{ maxWidth: 300 }}>
            Choisis un nouveau mot de passe pour ton compte Gather.
          </AppText>
        </View>
      </FadeIn>

      <FadeIn delay={120}>
        <Card elevated style={{ gap: spacing.lg }}>
          <Field label="Nouveau mot de passe" hint="6 caractères minimum">
            <Input
              icon={<Lock size={18} color={colors.textFaint} />}
              placeholder="••••••••"
              secureTextEntry={!showPassword}
              autoCapitalize="none"
              value={password}
              onChangeText={setPassword}
            />
            <TouchableOpacity
              onPress={() => setShowPassword((v) => !v)}
              style={{ position: "absolute", right: 12, top: 34 }}
              hitSlop={10}
            >
              {showPassword ? <EyeOff size={18} color={colors.textMuted} /> : <Eye size={18} color={colors.textMuted} />}
            </TouchableOpacity>
          </Field>

          <Field label="Confirme le mot de passe">
            <Input
              icon={<Lock size={18} color={colors.textFaint} />}
              placeholder="••••••••"
              secureTextEntry={!showPassword}
              autoCapitalize="none"
              value={confirm}
              onChangeText={setConfirm}
              onSubmitEditing={onSubmit}
              returnKeyType="go"
            />
          </Field>

          <Button title="Mettre à jour" onPress={onSubmit} loading={loading} size="lg" fullWidth />
        </Card>
      </FadeIn>

      <FadeIn delay={200}>
        <TouchableOpacity onPress={onCancel} style={{ marginTop: spacing.xl, alignItems: "center" }} hitSlop={10}>
          <AppText variant="bodyMuted">Annuler</AppText>
        </TouchableOpacity>
      </FadeIn>
    </AuthScaffold>
  );
}
