import { Redirect, useLocalSearchParams } from "expo-router";
import React, { useEffect, useState } from "react";
import { View } from "react-native";
import { Loader } from "@/components/ui/Feedback";
import { colors } from "@/constants/theme";
import { useActiveSpace } from "@/providers/activeSpace";

/**
 * Compatibility shim for the old nested tab routes
 * (/space/<id>/episodes | ideas | recap | members), which server-sent
 * notification URLs may still contain. Maps each onto its new home.
 */
export default function SpaceSectionRedirect() {
  const { id, rest } = useLocalSearchParams<{ id: string; rest?: string | string[] }>();
  const { select } = useActiveSpace();
  const [adopted, setAdopted] = useState<boolean>(false);

  useEffect(() => {
    if (id) select(id);
    setAdopted(true);
  }, [id, select]);

  if (!adopted) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg }}>
        <Loader label="Ouverture…" />
      </View>
    );
  }

  const section = Array.isArray(rest) ? rest[0] : rest;

  if (section === "members") {
    return <Redirect href={{ pathname: "/space-members/[spaceId]", params: { spaceId: id } }} />;
  }
  if (section === "ideas") return <Redirect href="/ideas" />;
  if (section === "recap") return <Redirect href="/recap" />;
  // "episodes" and anything unknown land on Moments, which now holds both the
  // space dashboard and the episode list.
  return <Redirect href="/" />;
}
