import { Redirect, useLocalSearchParams } from "expo-router";
import React, { useEffect, useState } from "react";
import { View } from "react-native";
import { Loader } from "@/components/ui/Feedback";
import { colors } from "@/constants/theme";
import { useActiveSpace } from "@/providers/activeSpace";

/**
 * Compatibility shim. The tabs moved to the root, but stored push-notification
 * URLs and shared deep links still point at /space/<id>. Rather than break them,
 * adopt the id as the active space and hand over to the tabs.
 */
export default function SpaceRedirect() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { select } = useActiveSpace();
  const [adopted, setAdopted] = useState<boolean>(false);

  // Select before redirecting: <Redirect> navigates from a child effect, which
  // would otherwise run before this one and land on the previous space.
  useEffect(() => {
    if (id) select(id);
    setAdopted(true);
  }, [id, select]);

  if (!adopted) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg }}>
        <Loader label="Ouverture de l'espace…" />
      </View>
    );
  }

  return <Redirect href="/" />;
}
