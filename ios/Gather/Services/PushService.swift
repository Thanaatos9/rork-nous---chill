import Foundation
import Supabase

/// Push notification token registration for the native iOS client.
///
/// The existing backend uses a Web Push (VAPID) `push_subscriptions` table with
/// `endpoint` / `p256dh` / `auth` columns. On native iOS there is no browser
/// PushSubscription — instead APNs issues a device token. We store that token in
/// the `endpoint` column, prefixed with `apns:` so a backend sender can branch on
/// the token shape (web push starts with `https://`, Expo with `ExponentPushToken`,
/// iOS native with `apns:`) and deliver through the right channel. Mirrors
/// `lib/push.ts` on the Expo side.
@MainActor
enum PushService {
    /// Registers this device's APNs token for the given user, de-duplicating so
    /// the same token is never stored twice. Best-effort — never throws.
    static func register(userId: String, deviceToken: String) async {
        let endpoint = "apns:\(deviceToken)"
        do {
            let existing: [PushRow] = try await supabase
                .from("push_subscriptions")
                .select("id")
                .eq("user_id", value: userId)
                .eq("endpoint", value: endpoint)
                .limit(1)
                .execute()
                .value
            if !existing.isEmpty { return }

            try await supabase
                .from("push_subscriptions")
                .insert([
                    "user_id": AnyJSON.string(userId),
                    "endpoint": .string(endpoint),
                    "p256dh": .string(""),
                    "auth": .string(""),
                ])
                .execute()
        } catch {
            // Best-effort: RLS or a schema mismatch should never crash the app.
            #if DEBUG
            print("PushService.register failed:", error)
            #endif
        }
    }

    /// Removes this device's APNs token for the given user (e.g. on sign-out).
    static func unregister(userId: String, deviceToken: String) async {
        let endpoint = "apns:\(deviceToken)"
        do {
            try await supabase
                .from("push_subscriptions")
                .delete()
                .eq("user_id", value: userId)
                .eq("endpoint", value: endpoint)
                .execute()
        } catch {
            #if DEBUG
            print("PushService.unregister failed:", error)
            #endif
        }
    }
}

private struct PushRow: Decodable {
    let id: String
}
