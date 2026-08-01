import SwiftUI

struct JoinSpaceView: View {
    var prefill: String = ""
    var onJoined: (String) -> Void

    @Environment(\.dismiss) private var dismiss
    @Environment(AppState.self) private var app
    @Environment(ToastCenter.self) private var toasts

    @State private var code: String = ""
    @State private var loading = false

    var body: some View {
        ZStack {
            ScreenBackground()
            ScrollView(showsIndicators: false) {
                VStack(spacing: Spacing.xl) {
                    HStack {
                        Spacer()
                        IconButton(systemIcon: "xmark", size: 40) { dismiss() }
                    }

                    VStack(spacing: Spacing.md) {
                        Image(systemName: "ticket.fill")
                            .font(.system(size: 34))
                            .foregroundStyle(Palette.primary)
                            .frame(width: 80, height: 80)
                            .background(Palette.primarySoft, in: Circle())
                        Text("Rejoindre un espace").gType(.title)
                        Text("Entre le code de l'espace que t'a partagé un membre de l'aventure.")
                            .gType(.bodyMuted).multilineTextAlignment(.center).frame(maxWidth: 300)
                    }
                    .padding(.top, Spacing.sm)

                    GatherCard(elevated: true) {
                        VStack(spacing: Spacing.lg) {
                            Field(label: "Code de l'espace") {
                                GatherTextField(placeholder: "Ex. K7M2QX9", text: $code,
                                                autocapitalization: .characters, autocorrection: false,
                                                tracking: 3, submitLabel: .go, onSubmit: join)
                                .onChange(of: code) { _, v in code = v.uppercased() }
                            }
                            GatherButton("Rejoindre", size: .lg, loading: loading, fullWidth: true, action: join)
                        }
                    }
                    .floatIn(delay: 0.08)

                    Spacer()
                }
                .padding(Spacing.lg)
            }
        }
        .presentationBackground(Palette.bg)
        .onAppear { if code.isEmpty { code = prefill.uppercased() } }
    }

    private func join() {
        guard !code.trimmed.isEmpty else { toasts.error("Saisis un code d'invitation."); return }
        guard let uid = app.userId else { return }
        loading = true
        Task {
            do {
                let result = try await SpaceService.joinSpace(rawCode: code, userId: uid)
                PendingInvite.clear()
                toasts.success(result.alreadyMember ? "Tu fais déjà partie de cet espace." : "Bienvenue dans l'espace !")
                dismiss()
                onJoined(result.spaceId)
            } catch {
                toasts.error(FriendlyError.message(error))
            }
            loading = false
        }
    }
}
