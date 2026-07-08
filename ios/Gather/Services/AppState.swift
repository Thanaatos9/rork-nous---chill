import Foundation
import Supabase
import Observation

/// Root auth + profile state. Mirrors providers/auth.tsx.
@MainActor
@Observable
final class AppState {
    var session: Session?
    var profile: Profile?
    var isInitializing: Bool = true
    let isConfigured: Bool

    var isAuthenticated: Bool { session != nil }
    var userId: String? { session?.user.id.uuidString.lowercased() }
    var userEmail: String? { session?.user.email }

    private var listenTask: Task<Void, Never>?

    init() {
        isConfigured = SupabaseManager.shared.isConfigured
        guard isConfigured else {
            isInitializing = false
            return
        }
        startListening()
    }

    private func startListening() {
        listenTask = Task { [weak self] in
            for await (event, session) in supabase.auth.authStateChanges {
                guard let self else { return }
                self.session = session
                switch event {
                case .signedOut:
                    self.profile = nil
                    self.isInitializing = false
                    PushCoordinator.shared.setUser(nil)
                case .initialSession, .signedIn, .tokenRefreshed, .userUpdated:
                    self.isInitializing = false
                    if session != nil {
                        await self.loadProfile()
                        PushCoordinator.shared.setUser(self.userId)
                    }
                default:
                    break
                }
            }
        }
    }

    // MARK: - Actions

    func signIn(email: String, password: String) async throws {
        try await supabase.auth.signIn(email: email.trimmed, password: password)
    }

    /// Returns `true` when email confirmation is required (no session yet).
    func signUp(email: String, password: String, name: String, inviteCode: String?) async throws -> Bool {
        let response = try await supabase.auth.signUp(
            email: email.trimmed,
            password: password,
            data: ["name": .string(name.trimmed)]
        )
        if let code = inviteCode, !code.isEmpty {
            PendingInvite.set(code)
        }
        return response.session == nil
    }

    func resendConfirmation(email: String) async throws {
        try await supabase.auth.resend(email: email.trimmed, type: .signup)
    }

    // MARK: - Social sign-in

    /// Native Sign in with Apple. `nonce` is the RAW nonce (its SHA256 hash was
    /// sent in the authorization request). Apple returns the user's name only on
    /// the first sign-in — persist it to user metadata so the profile is named.
    func signInWithApple(idToken: String, nonce: String, fullName: PersonNameComponents?) async throws {
        try await supabase.auth.signInWithIdToken(
            credentials: .init(provider: .apple, idToken: idToken, nonce: nonce)
        )
        guard let fullName else { return }
        let name = [fullName.givenName, fullName.familyName]
            .compactMap { $0 }
            .joined(separator: " ")
            .trimmed
        guard !name.isEmpty, let uid = userId else { return }
        // Apple only hands over the name on the very first sign-in — persist it to
        // both the auth metadata (future logins) and the profile row (display).
        try? await supabase.auth.update(
            user: UserAttributes(data: ["name": .string(name), "full_name": .string(name)])
        )
        try? await supabase
            .from("profiles")
            .upsert(["id": AnyJSON.string(uid), "name": .string(name)], onConflict: "id")
            .execute()
        await loadProfile()
    }

    /// Google sign-in through Supabase social OAuth (ASWebAuthenticationSession).
    func signInWithGoogle() async throws {
        try await supabase.auth.signInWithOAuth(
            provider: .google,
            redirectTo: URL(string: "rork-app://auth-callback")
        )
    }

    func signOut() async {
        PushCoordinator.shared.setUser(nil)
        try? await supabase.auth.signOut()
        session = nil
        profile = nil
    }

    func loadProfile() async {
        guard let uid = userId else { return }
        do {
            let rows: [Profile] = try await supabase
                .from("profiles")
                .select()
                .eq("id", value: uid)
                .limit(1)
                .execute()
                .value
            if let existing = rows.first {
                profile = existing
                return
            }
            // Auto-provision a profile row if a trigger didn't create one.
            let metadataName = session?.user.userMetadata["name"]?.asString
            let fallbackName = metadataName
                ?? session?.user.email?.split(separator: "@").first.map(String.init)
                ?? "Membre"
            let created: [Profile] = try await supabase
                .from("profiles")
                .upsert(["id": AnyJSON.string(uid), "name": .string(fallbackName)], onConflict: "id")
                .select()
                .execute()
                .value
            profile = created.first
        } catch {
            #if DEBUG
            print("loadProfile failed:", error)
            #endif
        }
    }

    func refreshProfile() async { await loadProfile() }
}

extension AnyJSON {
    /// Safe string extraction independent of SDK accessor availability.
    var asString: String? {
        if case let .string(value) = self { return value }
        return nil
    }
}

extension String {
    var trimmed: String { trimmingCharacters(in: .whitespacesAndNewlines) }
}
