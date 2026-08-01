import { Eye, PenLine, UserCheck } from "lucide-react-native";
import React from "react";
import { View } from "react-native";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { AppText } from "@/components/ui/Text";
import { colors, radius, spacing } from "@/constants/theme";

/**
 * Joining a space lands you in the "observer" role: you see everything but can
 * neither add moments nor write reviews. Nothing used to say so — the newcomer
 * met silently disabled buttons, and the owner was never told anyone was
 * waiting. These two cards close that loop from both ends.
 */

function Line({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "flex-start", gap: spacing.sm }}>
      <View style={{ width: 20, alignItems: "center", paddingTop: 2 }}>{icon}</View>
      <AppText variant="bodyMuted" style={{ flex: 1 }}>
        {children}
      </AppText>
    </View>
  );
}

/**
 * Shown to a member who has not been allowed to participate yet. Purely
 * informational by design: promotion is the owner's call alone, so the observer
 * gets no "request access" affordance to press.
 */
export function ObserverNotice({ ownerName }: { ownerName: string | null }) {
  const who = ownerName?.trim() || "Le propriétaire";

  return (
    <Card style={{ gap: spacing.md }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
        <View
          style={{
            width: 34,
            height: 34,
            borderRadius: radius.pill,
            backgroundColor: colors.surface,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Eye size={17} color={colors.textMuted} />
        </View>
        <View style={{ flex: 1 }}>
          <AppText variant="h3">Tu es observateur</AppText>
          <AppText variant="caption">{who} doit t&apos;autoriser à participer</AppText>
        </View>
      </View>

      <View style={{ gap: spacing.sm }}>
        <Line icon={<Eye size={15} color={colors.success} />}>
          Tu peux déjà tout voir, aimer et commenter.
        </Line>
        <Line icon={<PenLine size={15} color={colors.textFaint} />}>
          Créer des épisodes et écrire tes impressions demandent son feu vert.
        </Line>
      </View>
    </Card>
  );
}

/** Shown to the owner when people are waiting to be allowed in. */
export function PendingObserversNotice({
  count,
  onManage,
}: {
  count: number;
  onManage: () => void;
}) {
  if (count < 1) return null;
  const plural = count > 1;

  // Deliberately not `glow`: the brand primary is red, so a glowing red card
  // reads as an error. This is a friendly nudge — the tinted icon chip and the
  // primary button already carry enough weight.
  return (
    <Card style={{ gap: spacing.md, borderColor: colors.primarySoft }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
        <View
          style={{
            width: 34,
            height: 34,
            borderRadius: radius.pill,
            backgroundColor: colors.primarySoft,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <UserCheck size={17} color={colors.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <AppText variant="h3">
            {count} personne{plural ? "s" : ""} attend{plural ? "ent" : ""} ton feu vert
          </AppText>
          <AppText variant="caption">
            {plural ? "Elles ont rejoint" : "Elle a rejoint"} l&apos;espace mais ne peu
            {plural ? "vent" : "t"} pas encore participer
          </AppText>
        </View>
      </View>

      <Button
        title={`Autoriser ${plural ? "ces personnes" : "cette personne"}`}
        icon={<UserCheck size={16} color={colors.primaryFg} />}
        onPress={onManage}
      />
    </Card>
  );
}
