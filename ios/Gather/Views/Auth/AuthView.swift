import SwiftUI

enum AuthMode { case login, signup }

struct AuthView: View {
    @State private var mode: AuthMode = .login

    var body: some View {
        ZStack {
            LinearGradient(
                colors: [Color(hex: 0x2A0E13), Palette.bg, Palette.bgDeep],
                startPoint: .top, endPoint: .bottom
            )
            .ignoresSafeArea()

            ScrollView(showsIndicators: false) {
                VStack {
                    switch mode {
                    case .login:
                        LoginForm(switchToSignup: { withAnimation { mode = .signup } })
                    case .signup:
                        SignupForm(switchToLogin: { withAnimation { mode = .login } })
                    }
                }
                .frame(maxWidth: .infinity)
                .padding(Spacing.xl)
                .frame(minHeight: UIScreen.main.bounds.height - 80)
            }
            .scrollDismissesKeyboard(.interactively)
        }
    }
}

private struct LoginForm: View {
    var switchToSignup: () -> Void

    @Environment(AppState.self) private var app
    @Environment(ToastCenter.self) private var toasts

    @State private var email = ""
    @State private var password = ""
    @State private var loading = false
    @State private var needsConfirmation = false

    var body: some View {
        VStack(spacing: Spacing.xl) {
            VStack(spacing: Spacing.md) {
                BrandMark(size: 72)
                Wordmark(size: 30)
                Text("Le réseau de vos souvenirs partagés. À vivre, et à rejouer ensemble.")
                    .gType(.bodyMuted)
                    .multilineTextAlignment(.center)
                    .frame(maxWidth: 280)
            }

            GatherCard(elevated: true) {
                VStack(spacing: Spacing.lg) {
                    Field(label: "Email") {
                        GatherTextField(placeholder: "toi@exemple.com", text: $email,
                                        systemIcon: "envelope", keyboard: .emailAddress,
                                        autocapitalization: .never, autocorrection: false)
                    }
                    Field(label: "Mot de passe") {
                        GatherTextField(placeholder: "••••••••", text: $password,
                                        systemIcon: "lock", secure: true,
                                        autocapitalization: .never, autocorrection: false,
                                        submitLabel: .go, onSubmit: submit)
                    }
                    if needsConfirmation {
                        Button(action: resend) {
                            Text("Renvoyer l'email de confirmation")
                                .font(.system(size: 13.5, weight: .semibold))
                                .foregroundStyle(Palette.accent)
                                .frame(maxWidth: .infinity, alignment: .leading)
                        }
                        .buttonStyle(.plain)
                    }
                    GatherButton("Se connecter", size: .lg, loading: loading, fullWidth: true, action: submit)

                    SocialSignInButtons()
                }
            }

            HStack(spacing: 6) {
                Text("Pas encore de compte ?").gType(.bodyMuted)
                Button(action: switchToSignup) {
                    Text("Créer un compte")
                        .font(.system(size: 15, weight: .bold))
                        .foregroundStyle(Palette.primary)
                }
                .buttonStyle(.plain)
            }
        }
    }

    private func submit() {
        guard !email.trimmed.isEmpty, !password.isEmpty else {
            toasts.error("Renseigne ton email et ton mot de passe."); return
        }
        loading = true
        needsConfirmation = false
        Task {
            do {
                try await app.signIn(email: email, password: password)
            } catch {
                let message = FriendlyError.message(error)
                if message.contains("confirmé") { needsConfirmation = true }
                toasts.error(message)
            }
            loading = false
        }
    }

    private func resend() {
        Task {
            do {
                try await app.resendConfirmation(email: email)
                toasts.success("Email de confirmation renvoyé.")
            } catch {
                toasts.error(FriendlyError.message(error))
            }
        }
    }
}

private struct SignupForm: View {
    var switchToLogin: () -> Void

    @Environment(AppState.self) private var app
    @Environment(ToastCenter.self) private var toasts

    @State private var name = ""
    @State private var email = ""
    @State private var password = ""
    @State private var inviteCode = ""
    @State private var loading = false
    @State private var sent = false

    var body: some View {
        if sent {
            confirmationView
        } else {
            formView
        }
    }

    private var formView: some View {
        VStack(spacing: Spacing.xl) {
            VStack(spacing: Spacing.sm) {
                BrandMark(size: 64)
                Wordmark(size: 26)
                Text("Crée ton compte et lance ta première saison.")
                    .gType(.bodyMuted)
                    .multilineTextAlignment(.center)
            }

            GatherCard(elevated: true) {
                VStack(spacing: Spacing.lg) {
                    if !inviteCode.isEmpty {
                        HStack {
                            BadgeView("Invitation détectée · \(inviteCode.uppercased())", tone: .gold)
                            Spacer()
                        }
                    }
                    Field(label: "Prénom") {
                        GatherTextField(placeholder: "Samuel", text: $name,
                                        systemIcon: "person", autocapitalization: .words)
                    }
                    Field(label: "Email") {
                        GatherTextField(placeholder: "toi@exemple.com", text: $email,
                                        systemIcon: "envelope", keyboard: .emailAddress,
                                        autocapitalization: .never, autocorrection: false)
                    }
                    Field(label: "Mot de passe", hint: "6 caractères minimum") {
                        GatherTextField(placeholder: "••••••••", text: $password,
                                        systemIcon: "lock", secure: true,
                                        autocapitalization: .never, autocorrection: false)
                    }
                    Field(label: "Code d'invitation (optionnel)") {
                        GatherTextField(placeholder: "Ex. K7M2QX9", text: $inviteCode,
                                        systemIcon: "ticket", autocapitalization: .characters,
                                        autocorrection: false)
                    }
                    GatherButton("Créer mon compte", size: .lg, loading: loading, fullWidth: true, action: submit)

                    SocialSignInButtons(inviteCode: inviteCode.trimmed.isEmpty ? nil : inviteCode)
                }
            }

            HStack(spacing: 6) {
                Text("Déjà un compte ?").gType(.bodyMuted)
                Button(action: switchToLogin) {
                    Text("Se connecter")
                        .font(.system(size: 15, weight: .bold))
                        .foregroundStyle(Palette.primary)
                }
                .buttonStyle(.plain)
            }
        }
        .onAppear {
            if inviteCode.isEmpty, let pending = PendingInvite.get() { inviteCode = pending }
        }
    }

    private var confirmationView: some View {
        VStack(spacing: Spacing.lg) {
            Image(systemName: "envelope.badge.fill")
                .font(.system(size: 38))
                .foregroundStyle(Palette.primary)
                .frame(width: 84, height: 84)
                .background(Palette.primarySoft, in: Circle())
            Text("Vérifie tes emails").gType(.title)
            (Text("On a envoyé un lien de confirmation à\n")
                + Text(email.trimmed).bold().foregroundColor(Palette.text)
                + Text(".\nClique dessus, puis reviens te connecter."))
                .gType(.bodyMuted)
                .multilineTextAlignment(.center)
                .frame(maxWidth: 300)
            GatherButton("Aller à la connexion", size: .lg, fullWidth: true) { switchToLogin() }
                .padding(.top, Spacing.sm)
            Button {
                Task {
                    do { try await app.resendConfirmation(email: email); toasts.success("Email renvoyé.") }
                    catch { toasts.error(FriendlyError.message(error)) }
                }
            } label: {
                Text("Renvoyer l'email")
                    .font(.system(size: 15, weight: .semibold))
                    .foregroundStyle(Palette.accent)
            }
            .buttonStyle(.plain)
        }
    }

    private func submit() {
        guard !name.trimmed.isEmpty else { toasts.error("Indique ton prénom."); return }
        guard !email.trimmed.isEmpty, !password.isEmpty else {
            toasts.error("Renseigne ton email et ton mot de passe."); return
        }
        guard password.count >= 6 else {
            toasts.error("Le mot de passe doit faire au moins 6 caractères."); return
        }
        loading = true
        Task {
            do {
                let needsConfirmation = try await app.signUp(
                    email: email, password: password, name: name,
                    inviteCode: inviteCode.trimmed.isEmpty ? nil : inviteCode
                )
                if needsConfirmation { sent = true }
                else { toasts.success("Bienvenue dans Gather !") }
            } catch {
                toasts.error(FriendlyError.message(error))
            }
            loading = false
        }
    }
}
