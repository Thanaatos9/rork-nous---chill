import SwiftUI
import PhotosUI
import UserNotifications

struct SettingsView: View {
    @Environment(AppState.self) private var app
    @Environment(ToastCenter.self) private var toasts
    @Environment(\.dismiss) private var dismiss

    @State private var name = ""
    @State private var bio = ""
    @State private var hydrated = false
    @State private var avatarItem: PhotosPickerItem?
    @State private var savingAvatar = false
    @State private var saving = false
    @State private var confirmSignOut = false

    private var changed: Bool {
        name.trimmed != (app.profile?.name ?? "") || bio.trimmed != (app.profile?.bio ?? "")
    }

    var body: some View {
        ZStack {
            ScreenBackground()
            ScrollView(showsIndicators: false) {
                VStack(alignment: .leading, spacing: Spacing.xxl) {
                    profileCard.floatIn()

                    VStack(alignment: .leading, spacing: Spacing.md) {
                        SectionHeader("Préférences")
                        GatherCard { PushToggle() }
                    }

                    VStack(alignment: .leading, spacing: Spacing.md) {
                        SectionHeader("À propos")
                        GatherCard(padded: false) {
                            HStack(spacing: Spacing.md) {
                                Image(systemName: "info.circle").font(.system(size: 18)).foregroundStyle(Palette.text)
                                    .frame(width: 40, height: 40).background(Palette.surface, in: Circle())
                                Text("Gather").font(.system(size: 15, weight: .semibold)).foregroundStyle(Palette.text)
                                Spacer()
                                Text("v1.0.0").gType(.caption)
                            }
                            .padding(Spacing.lg)
                        }
                    }

                    Button { confirmSignOut = true } label: {
                        HStack(spacing: 8) {
                            Image(systemName: "rectangle.portrait.and.arrow.right").font(.system(size: 17))
                            Text("Se déconnecter").font(.system(size: 15, weight: .bold))
                        }
                        .foregroundStyle(Palette.destructive)
                        .frame(maxWidth: .infinity).padding(.vertical, Spacing.md)
                        .overlay(RoundedRectangle(cornerRadius: Radius.md, style: .continuous).stroke(Palette.destructiveSoft, lineWidth: 1))
                    }
                    .buttonStyle(.plain)
                }
                .padding(.horizontal, Spacing.lg)
                .padding(.top, Spacing.sm)
                .padding(.bottom, Spacing.xxxl)
            }
        }
        .navigationTitle("Réglages")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .topBarLeading) {
                Button { dismiss() } label: { Image(systemName: "chevron.left").foregroundStyle(Palette.text) }
            }
        }
        .toolbarBackground(Palette.bgDeep, for: .navigationBar)
        .toolbarBackground(.visible, for: .navigationBar)
        .onAppear {
            if let p = app.profile, !hydrated {
                name = p.name ?? ""; bio = p.bio ?? ""; hydrated = true
            }
        }
        .onChange(of: avatarItem) { _, item in
            guard let item else { return }
            Task { await changeAvatar(item) }
        }
        .alert("Se déconnecter ?", isPresented: $confirmSignOut) {
            Button("Annuler", role: .cancel) {}
            Button("Se déconnecter", role: .destructive) { Task { await app.signOut() } }
        } message: {
            Text("Tu pourras te reconnecter à tout moment.")
        }
    }

    private var profileCard: some View {
        GatherCard(elevated: true) {
            VStack(spacing: Spacing.lg) {
                VStack(spacing: Spacing.sm) {
                    PhotosPicker(selection: $avatarItem, matching: .images) {
                        ZStack(alignment: .bottomTrailing) {
                            AvatarView(profile: app.profile, size: 92)
                            Image(systemName: "camera.fill").font(.system(size: 14)).foregroundStyle(.white)
                                .frame(width: 30, height: 30).background(Palette.primary, in: Circle())
                                .overlay(Circle().stroke(Palette.card, lineWidth: 2))
                        }
                    }
                    .buttonStyle(.plain)
                    Text(savingAvatar ? "Envoi…" : (app.userEmail ?? "")).gType(.caption)
                }
                Field(label: "Prénom") { GatherTextField(placeholder: "Ton prénom", text: $name) }
                Field(label: "Bio (optionnel)") { GatherTextField(placeholder: "Quelques mots sur toi…", text: $bio, multiline: true) }
                GatherButton("Enregistrer", loading: saving, disabled: !changed, fullWidth: true, action: save)
            }
        }
    }

    private func save() {
        guard !name.trimmed.isEmpty, let uid = app.userId else {
            toasts.error("Ton prénom ne peut pas être vide."); return
        }
        saving = true
        Task {
            do {
                _ = try await ProfileService.updateProfile(userId: uid, name: name.trimmed, bio: bio.trimmed.isEmpty ? nil : bio.trimmed)
                await app.refreshProfile()
                toasts.success("Profil mis à jour")
            } catch {
                toasts.error(FriendlyError.message(error))
            }
            saving = false
        }
    }

    private func changeAvatar(_ item: PhotosPickerItem) async {
        guard let uid = app.userId,
              let data = try? await item.loadTransferable(type: Data.self),
              let image = UIImage(data: data),
              let jpeg = image.jpegData(compressionQuality: 0.6) else { return }
        savingAvatar = true
        do {
            // The storage policy expects a uuid as the first path folder: try the
            // user id first, then fall back to a space the user belongs to.
            let url: String
            do {
                url = try await StorageService.upload(folder: "\(uid)/avatars", data: jpeg, contentType: "image/jpeg", ext: "jpg")
            } catch {
                guard let spaceId = try? await SpaceService.mySpaces(userId: uid).first?.space.id else { throw error }
                url = try await StorageService.upload(folder: "\(spaceId)/avatars", data: jpeg, contentType: "image/jpeg", ext: "jpg")
            }
            _ = try await ProfileService.updateAvatar(userId: uid, url: url)
            await app.refreshProfile()
            toasts.success("Photo mise à jour")
        } catch {
            toasts.error(FriendlyError.message(error))
        }
        savingAvatar = false
    }
}

private struct PushToggle: View {
    @Environment(ToastCenter.self) private var toasts
    @State private var enabled = false

    var body: some View {
        HStack(spacing: Spacing.md) {
            Image(systemName: "bell").font(.system(size: 18)).foregroundStyle(Palette.text)
                .frame(width: 40, height: 40).background(Palette.surface, in: Circle())
            VStack(alignment: .leading, spacing: 2) {
                Text("Notifications push").font(.system(size: 15, weight: .semibold)).foregroundStyle(Palette.text)
                Text("Épisodes, commentaires, déverrouillages").gType(.caption)
            }
            Spacer()
            Toggle("", isOn: Binding(get: { enabled }, set: { onToggle($0) })).labelsHidden().tint(Palette.primary)
        }
        .task {
            let settings = await UNUserNotificationCenter.current().notificationSettings()
            enabled = settings.authorizationStatus == .authorized
        }
    }

    private func onToggle(_ value: Bool) {
        guard value else {
            toasts.info("Pour les désactiver, passe par les réglages système.")
            return
        }
        Task {
            do {
                let granted = try await UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .badge, .sound])
                enabled = granted
                if granted {
                    UIApplication.shared.registerForRemoteNotifications()
                    toasts.success("Notifications activées")
                } else {
                    toasts.info("Active les notifications dans les réglages de ton téléphone.")
                }
            } catch {
                toasts.error("Impossible d'activer les notifications ici.")
            }
        }
    }
}
