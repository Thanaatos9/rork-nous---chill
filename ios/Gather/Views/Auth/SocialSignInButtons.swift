import AuthenticationServices
import CryptoKit
import SwiftUI

/// Google + Apple sign-in, backed by Supabase social OAuth. Apple uses the
/// native `SignInWithAppleButton` (id-token flow); Google uses Supabase's
/// `signInWithOAuth` (ASWebAuthenticationSession). Pass an `inviteCode` on the
/// sign-up form so it is redeemed once the account lands.
struct SocialSignInButtons: View {
    var inviteCode: String? = nil

    @Environment(AppState.self) private var app
    @Environment(ToastCenter.self) private var toasts
    @Environment(\.colorScheme) private var colorScheme

    @State private var currentNonce: String?
    @State private var googleLoading = false
    @State private var appleLoading = false

    private var busy: Bool { googleLoading || appleLoading }

    var body: some View {
        VStack(spacing: Spacing.md) {
            HStack(spacing: Spacing.md) {
                Rectangle().fill(Palette.border).frame(height: 1)
                Text("ou continuer avec")
                    .gType(.caption)
                    .fixedSize()
                Rectangle().fill(Palette.border).frame(height: 1)
            }
            .padding(.vertical, Spacing.xs)

            googleButton

            SignInWithAppleButton(.continue) { request in
                let nonce = randomNonceString()
                currentNonce = nonce
                request.requestedScopes = [.fullName, .email]
                request.nonce = sha256(nonce)
            } onCompletion: { result in
                handleApple(result)
            }
            .signInWithAppleButtonStyle(colorScheme == .dark ? .white : .black)
            .frame(height: 54)
            .clipShape(RoundedRectangle(cornerRadius: Radius.md, style: .continuous))
            .opacity(appleLoading ? 0.6 : 1)
            .allowsHitTesting(!busy)
            .overlay {
                if appleLoading {
                    ProgressView().tint(colorScheme == .dark ? .black : .white)
                }
            }
        }
    }

    private var googleButton: some View {
        Button(action: googleSignIn) {
            HStack(spacing: 10) {
                if googleLoading {
                    ProgressView().tint(Color(hex: 0x1F1F1F))
                } else {
                    GoogleGlyph(size: 19)
                    Text("Continuer avec Google")
                        .font(.system(size: 16, weight: .bold))
                        .tracking(-0.2)
                        .foregroundStyle(Color(hex: 0x1F1F1F))
                }
            }
            .frame(maxWidth: .infinity)
            .frame(height: 54)
            .background(Color.white, in: RoundedRectangle(cornerRadius: Radius.md, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: Radius.md, style: .continuous)
                    .stroke(Color(hex: 0xDADCE0), lineWidth: 1)
            )
        }
        .buttonStyle(PressableStyle(scale: 0.97))
        .disabled(busy)
    }

    // MARK: - Actions

    private func googleSignIn() {
        guard !busy else { return }
        googleLoading = true
        Task {
            do {
                persistInviteIfNeeded()
                try await app.signInWithGoogle()
            } catch {
                if !isCancellation(error) { toasts.error(FriendlyError.message(error)) }
            }
            googleLoading = false
        }
    }

    private func handleApple(_ result: Result<ASAuthorization, Error>) {
        switch result {
        case .success(let auth):
            guard
                let credential = auth.credential as? ASAuthorizationAppleIDCredential,
                let tokenData = credential.identityToken,
                let idToken = String(data: tokenData, encoding: .utf8),
                let nonce = currentNonce
            else {
                toasts.error("Connexion Apple impossible. Réessaie.")
                return
            }
            appleLoading = true
            Task {
                do {
                    persistInviteIfNeeded()
                    try await app.signInWithApple(idToken: idToken, nonce: nonce, fullName: credential.fullName)
                } catch {
                    toasts.error(FriendlyError.message(error))
                }
                appleLoading = false
            }
        case .failure(let error):
            if (error as? ASAuthorizationError)?.code == .canceled { return }
            toasts.error(FriendlyError.message(error))
        }
    }

    private func persistInviteIfNeeded() {
        if let code = inviteCode?.trimmed, !code.isEmpty { PendingInvite.set(code) }
    }

    private func isCancellation(_ error: Error) -> Bool {
        let ns = error as NSError
        if ns.domain == ASWebAuthenticationSessionError.errorDomain,
           ns.code == ASWebAuthenticationSessionError.canceledLogin.rawValue {
            return true
        }
        return "\(error)".lowercased().contains("cancel")
    }
}

// MARK: - Nonce helpers

/// Cryptographically-random nonce. `Character.randomElement()` draws from the
/// system's secure RNG on Apple platforms.
private func randomNonceString(length: Int = 32) -> String {
    let charset: [Character] = Array("0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz-._")
    return String((0..<length).compactMap { _ in charset.randomElement() })
}

private func sha256(_ input: String) -> String {
    let hashed = SHA256.hash(data: Data(input.utf8))
    return hashed.compactMap { String(format: "%02x", $0) }.joined()
}

// MARK: - Google mark

/// The multi-color Google "G", drawn as four ring arcs plus the blue crossbar.
private struct GoogleGlyph: View {
    var size: CGFloat = 19

    var body: some View {
        Canvas { ctx, canvasSize in
            let w = canvasSize.width
            let lineWidth = w * 0.23
            let radius = (w - lineWidth) / 2
            let center = CGPoint(x: w / 2, y: w / 2)

            func arc(_ from: Double, _ to: Double, _ hex: UInt) {
                var path = Path()
                path.addArc(
                    center: center,
                    radius: radius,
                    startAngle: .degrees(from),
                    endAngle: .degrees(to),
                    clockwise: false
                )
                ctx.stroke(
                    path,
                    with: .color(Color(hex: hex)),
                    style: StrokeStyle(lineWidth: lineWidth, lineCap: .butt)
                )
            }

            // Angles: 0° = 3 o'clock, increasing clockwise (SwiftUI y-down).
            arc(6, 150, 0x34A853)    // green: lower-right → bottom → lower-left
            arc(150, 210, 0xFBBC05)  // yellow: left
            arc(210, 330, 0xEA4335)  // red: top
            arc(330, 356, 0x4285F4)  // blue: upper-right

            // Blue crossbar reaching in from the right edge at the vertical center.
            let barHeight = lineWidth
            let barRect = CGRect(
                x: center.x - lineWidth * 0.1,
                y: center.y - barHeight / 2,
                width: radius + lineWidth / 2 + lineWidth * 0.1,
                height: barHeight
            )
            ctx.fill(Path(barRect), with: .color(Color(hex: 0x4285F4)))
        }
        .frame(width: size, height: size)
    }
}
