import { useRouter } from "expo-router";
import { ArrowLeft, Mail, MailCheck } from "lucide-react-native";
import { useState } from "react";
import { TouchableOpacity, View } from "react-native";
import { AuthScaffold } from "@/components/AuthScaffold";
import { BrandMark } from "@/components/Brand";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Field, Input } from "@/components/ui/Input";
import { FadeIn } from "@/components/ui/motion";
import { AppText } from "@/components/ui/Text";
import { colors, spacing } from "@/constants/theme";
import { friendlyError } from "@/lib/errors";
import { useAuth } from "@/providers/auth";
import { useToast } from "@/providers/toast";

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const toast = useToast();
  const { resetPassword } = useAuth();

  const [email, setEmail] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);
  const [sent, setSent] = useState<boolean>(false);

  const onSubmit = async () => {
    if (!email.trim()) {
      toast.error("Renseigne ton adresse email.");
      return;
    }
    setLoading(true);
    try {
      await resetPassword(email);
      setSent(true);
    } catch (error) {
      toast.error(friendlyError(error));
    } finally {
      setLoading(false);
    }
  };

  if (sent) {
    return (
      <AuthScaffold>
        <FadeIn>
          <View style={{ alignItems: "center", gap: spacing.lg }}>
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
              <MailCheck size={38} color={colors.primary} />
            </View>
            <AppText variant="title" center>
              Vérifie tes emails
            </AppText>
            <AppText variant="bodyMuted" center style={{ maxWidth: 300 }}>
              Si un compte existe pour{"\n"}
              <AppText style={{ color: colors.text, fontWeight: "700" }}>{email.trim()}</AppText>, tu recevras un lien
              pour choisir un nouveau mot de passe.{"\n"}Pense à vérifier tes spams.
            </AppText>
            <Button
              title="Retour à la connexion"
              onPress={() => router.replace("/login")}
              size="lg"
              fullWidth
              style={{ marginTop: spacing.sm }}
            />
            <TouchableOpacity onPress={() => setSent(false)}>
              <AppText style={{ color: colors.accent, fontWeight: "600" }}>Renvoyer le lien</AppText>
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
          <BrandMark size={64} />
          <AppText variant="title" center>
            Mot de passe oublié ?
          </AppText>
          <AppText variant="bodyMuted" center style={{ maxWidth: 300 }}>
            Indique l&apos;email de ton compte : on t&apos;envoie un lien pour en créer un nouveau.
          </AppText>
        </View>
      </FadeIn>

      <FadeIn delay={120}>
        <Card elevated style={{ gap: spacing.lg }}>
          <Field label="Email">
            <Input
              icon={<Mail size={18} color={colors.textFaint} />}
              placeholder="toi@exemple.com"
              autoCapitalize="none"
              keyboardType="email-address"
              autoComplete="email"
              value={email}
              onChangeText={setEmail}
              onSubmitEditing={onSubmit}
              returnKeyType="send"
            />
          </Field>

          <Button title="Envoyer le lien" onPress={onSubmit} loading={loading} size="lg" fullWidth />
        </Card>
      </FadeIn>

      <FadeIn delay={200}>
        <TouchableOpacity
          onPress={() => router.replace("/login")}
          style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, marginTop: spacing.xl }}
          hitSlop={10}
        >
          <ArrowLeft size={16} color={colors.textMuted} />
          <AppText variant="bodyMuted">Retour à la connexion</AppText>
        </TouchableOpacity>
      </FadeIn>
    </AuthScaffold>
  );
}
