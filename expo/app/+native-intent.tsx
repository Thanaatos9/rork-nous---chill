import { isRecoveryUrl } from "@/lib/passwordReset";
import { setPendingInvite } from "@/lib/pendingInvite";

/**
 * Handles cold-start deep links. Password-recovery links route to the reset
 * screen (which establishes the session from the launch URL on mount).
 * Invitation links of the shape `rork-app://join?code=XXXX` (or any URL
 * containing `join` + a `code` param) are routed straight to the join screen,
 * and the code is persisted so it can still be redeemed if the user has to sign
 * in first. All other links fall back to the home route.
 */
export function redirectSystemPath({ path }: { path: string; initial: boolean }): string {
  try {
    if (isRecoveryUrl(path)) {
      return "/reset-password";
    }
    if (/join/i.test(path)) {
      const match = path.match(/[?&]code=([^&]+)/i);
      const code = match ? decodeURIComponent(match[1]) : null;
      if (code) {
        setPendingInvite(code);
        return `/join?code=${encodeURIComponent(code)}`;
      }
    }
  } catch {
    // Fall through to the default route on any parsing error.
  }
  return "/";
}
