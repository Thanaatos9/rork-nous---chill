import Foundation

/// Tracks whether a user already saw the welcome tutorial on this device.
/// Mirrors lib/onboarding.ts (per-user key, shows once).
nonisolated enum OnboardingStore {
    private static func key(_ userId: String) -> String { "gather.onboarding.v1.\(userId)" }

    static func hasSeen(_ userId: String) -> Bool {
        UserDefaults.standard.bool(forKey: key(userId))
    }

    static func markSeen(_ userId: String) {
        UserDefaults.standard.set(true, forKey: key(userId))
    }
}
