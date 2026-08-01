import createContextHook from "@nkzw/create-context-hook";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useMySpaces } from "@/hooks/useSpaces";
import { useAuth } from "@/providers/auth";

/**
 * Which space the root tabs are currently showing.
 *
 * The navigation used to nest a whole tab bar under /space/[id], so the tab bar
 * appeared halfway through the app and "Accueil" meant two different things.
 * Tabs now live at the root and read the space from here instead of route
 * params — one navigation level less, and a tab bar that never disappears.
 */

const keyFor = (userId: string) => `gather.activeSpace.v1.${userId}`;

const [Provider, useStore] = createContextHook(() => {
  const { userId } = useAuth();
  const [storedId, setStoredId] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState<boolean>(false);

  useEffect(() => {
    let active = true;
    if (!userId) {
      setStoredId(null);
      setHydrated(true);
      return;
    }
    setHydrated(false);
    AsyncStorage.getItem(keyFor(userId))
      .then((value) => {
        if (!active) return;
        setStoredId(value);
        setHydrated(true);
      })
      .catch(() => {
        // Non-fatal — falls back to the most recent space.
        if (active) setHydrated(true);
      });
    return () => {
      active = false;
    };
  }, [userId]);

  const select = useCallback(
    (id: string | null) => {
      setStoredId(id);
      if (!userId) return;
      const write = id
        ? AsyncStorage.setItem(keyFor(userId), id)
        : AsyncStorage.removeItem(keyFor(userId));
      write.catch(() => {});
    },
    [userId]
  );

  return { storedId, select, hydrated };
});

export const ActiveSpaceProvider = Provider;

/**
 * The resolved active space. Falls back to the first space whenever the stored
 * id is missing or points at a space the user has since left, so the tabs never
 * end up pointing at nothing while spaces exist.
 */
export function useActiveSpace() {
  const { storedId, select, hydrated } = useStore();
  const { data: spaces, isLoading, refetch, isRefetching } = useMySpaces();

  const space = useMemo(() => {
    if (!spaces || spaces.length === 0) return null;
    return spaces.find((s) => s.id === storedId) ?? spaces[0];
  }, [spaces, storedId]);

  return {
    space,
    spaceId: space?.id ?? null,
    spaces: spaces ?? [],
    /** True until both storage and the space list have settled. */
    isLoading: isLoading || !hydrated,
    hasNoSpace: hydrated && !isLoading && (spaces?.length ?? 0) === 0,
    select,
    refetch,
    isRefetching,
  };
}
