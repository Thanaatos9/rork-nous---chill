import { Platform } from "react-native";

/**
 * Registers the PWA service worker on the web only.
 *
 * This is what makes the app installable ("Add to Home Screen") and gives it an
 * offline app shell. It is a no-op on native platforms and during server
 * rendering. Registration is always best-effort — a failure never affects the
 * running app.
 */
export function registerServiceWorker(): void {
  if (Platform.OS !== "web") return;
  if (typeof window === "undefined") return;
  if (!("serviceWorker" in navigator)) return;

  const register = (): void => {
    navigator.serviceWorker.register("/sw.js").catch(() => {
      // Best-effort: unsupported browser or blocked scope should not crash.
    });
  };

  if (document.readyState === "complete") {
    register();
  } else {
    window.addEventListener("load", register, { once: true });
  }
}
