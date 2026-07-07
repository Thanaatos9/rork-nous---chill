import AsyncStorage from "@react-native-async-storage/async-storage";

const keyFor = (userId: string) => `gather.onboarding.v1.${userId}`;

/**
 * Whether this user already saw the welcome tutorial on this device.
 * On storage errors we return true to avoid trapping the user in a loop.
 */
export async function hasSeenOnboarding(userId: string): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(keyFor(userId))) === "1";
  } catch {
    return true;
  }
}

export async function markOnboardingSeen(userId: string): Promise<void> {
  try {
    await AsyncStorage.setItem(keyFor(userId), "1");
  } catch {
    // Non-fatal — the tutorial may simply show again next launch.
  }
}
