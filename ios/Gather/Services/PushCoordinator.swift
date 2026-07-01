import Foundation
import UIKit
import UserNotifications
import Observation

/// Bridges APNs registration, the signed-in user, and invite deep links to the
/// rest of the app. Mirrors the end-to-end flow in `providers/notifications.tsx`
/// and `+native-intent.tsx` on the Expo side.
@MainActor
@Observable
final class PushCoordinator {
    static let shared = PushCoordinator()

    /// The latest APNs device token (hex). Set once the OS registers the device.
    private(set) var deviceToken: String?
    /// The currently signed-in user id. Set by `AppState`.
    private(set) var userId: String?
    /// An invite code captured from a deep link while the app is running.
    var pendingJoinCode: String?

    private init() {}

    /// Requests notification authorization and registers for remote notifications.
    /// Safe to call repeatedly; the OS de-duplicates.
    func requestAuthorizationAndRegister() {
        Task {
            do {
                let granted = try await UNUserNotificationCenter.current()
                    .requestAuthorization(options: [.alert, .badge, .sound])
                if granted {
                    UIApplication.shared.registerForRemoteNotifications()
                }
            } catch {
                #if DEBUG
                print("Push authorization failed:", error)
                #endif
            }
        }
    }

    /// Called by the app delegate when APNs returns a device token.
    func setDeviceToken(_ token: String) {
        deviceToken = token
        syncRegistration()
    }

    /// Called by `AppState` whenever the signed-in user changes.
    func setUser(_ id: String?) {
        // On sign-out, remove the token for the previous user.
        if id == nil, let previous = userId, let token = deviceToken {
            Task { await PushService.unregister(userId: previous, deviceToken: token) }
        }
        userId = id
        if id != nil { requestAuthorizationAndRegister() }
        syncRegistration()
    }

    /// Registers the token whenever both a user and a token are available.
    private func syncRegistration() {
        guard let userId, let token = deviceToken else { return }
        Task { await PushService.register(userId: userId, deviceToken: token) }
    }

    /// Parses an invite deep link (e.g. `rork-app://join?code=XXXX`) and stores
    /// the code so it can be redeemed — even if the user must sign in first.
    func handleDeepLink(_ url: URL) {
        let raw = url.absoluteString
        guard raw.range(of: "join", options: .caseInsensitive) != nil else { return }
        let components = URLComponents(url: url, resolvingAgainstBaseURL: false)
        let code = components?.queryItems?.first(where: { $0.name.lowercased() == "code" })?.value
        guard let code, !code.trimmed.isEmpty else { return }
        let normalized = code.trimmed.uppercased()
        PendingInvite.set(normalized)
        pendingJoinCode = normalized
    }
}

/// App delegate for remote notification registration and tap handling.
final class AppDelegate: NSObject, UIApplicationDelegate, UNUserNotificationCenterDelegate {
    func application(
        _ application: UIApplication,
        didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
    ) -> Bool {
        UNUserNotificationCenter.current().delegate = self
        return true
    }

    func application(
        _ application: UIApplication,
        didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data
    ) {
        let token = deviceToken.map { String(format: "%02x", $0) }.joined()
        Task { @MainActor in PushCoordinator.shared.setDeviceToken(token) }
    }

    func application(
        _ application: UIApplication,
        didFailToRegisterForRemoteNotificationsWithError error: Error
    ) {
        #if DEBUG
        print("Failed to register for remote notifications:", error)
        #endif
    }

    /// Show banners while the app is in the foreground.
    nonisolated func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        willPresent notification: UNNotification,
        withCompletionHandler completionHandler: @escaping (UNNotificationPresentationOptions) -> Void
    ) {
        completionHandler([.banner, .list, .badge])
    }
}
