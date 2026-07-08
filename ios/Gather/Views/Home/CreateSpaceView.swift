import SwiftUI
import PhotosUI

struct CreateSpaceView: View {
    var onOpenSpace: (String) -> Void

    @Environment(\.dismiss) private var dismiss
    @Environment(AppState.self) private var app
    @Environment(ToastCenter.self) private var toasts

    @State private var name = ""
    @State private var description = ""
    @State private var coverItem: PhotosPickerItem?
    @State private var coverImage: UIImage?
    @State private var coverData: Data?
    @State private var adjusting: AdjustableImage?
    @State private var start = Date()
    @State private var end = Calendar.current.date(byAdding: .month, value: 3, to: Date()) ?? Date()
    @State private var loading = false

    @State private var createdSpace: Space?
    @State private var createdCode: String?

    var body: some View {
        ZStack {
            ScreenBackground()
            if let space = createdSpace {
                successView(space: space)
            } else {
                formView
            }
        }
        .presentationBackground(Palette.bg)
        .onChange(of: coverItem) { _, item in
            guard let item else { return }
            Task {
                if let data = try? await item.loadTransferable(type: Data.self),
                   let img = UIImage(data: data) {
                    adjusting = AdjustableImage(image: img)
                }
                coverItem = nil
            }
        }
        .fullScreenCover(item: $adjusting) { adj in
            ImageAdjustView(image: adj.image, title: "Ajuster la couverture", shape: .cover) {
                adjusting = nil
            } onDone: { cropped in
                coverImage = cropped
                coverData = cropped.jpegData(compressionQuality: 0.75)
                adjusting = nil
            }
        }
    }

    // MARK: - Form

    private var formView: some View {
        ScrollView(showsIndicators: false) {
            VStack(alignment: .leading, spacing: Spacing.xl) {
                HStack {
                    Text("Nouvel espace").gType(.title)
                    Spacer()
                    IconButton(systemIcon: "xmark", size: 40) { dismiss() }
                }

                PhotosPicker(selection: $coverItem, matching: .images) {
                    coverPicker
                }
                .buttonStyle(.plain)

                VStack(alignment: .leading, spacing: Spacing.lg) {
                    Field(label: "Nom de l'espace") {
                        GatherTextField(placeholder: "Samuel & Mathilde — Saison 1", text: $name)
                    }
                    Field(label: "Description (optionnel)") {
                        GatherTextField(placeholder: "Notre première année à deux 🎬", text: $description, multiline: true)
                    }
                    HStack(spacing: Spacing.md) {
                        Field(label: "Début de saison") {
                            DatePickerChip(date: $start)
                        }
                        Field(label: "Fin de saison") {
                            DatePickerChip(date: $end, range: start...)
                        }
                    }
                    BadgeView("Tu seras le propriétaire de cet espace", tone: .gold)
                    GatherButton("Créer l'espace", systemIcon: "checkmark", size: .lg, loading: loading, fullWidth: true, action: create)
                        .padding(.top, Spacing.xs)
                }
                .floatIn(delay: 0.08)
            }
            .padding(Spacing.lg)
            .padding(.bottom, Spacing.xxxl)
        }
    }

    private var coverPicker: some View {
        ZStack {
            RoundedRectangle(cornerRadius: Radius.xl, style: .continuous)
                .fill(Palette.card)
                .frame(height: 170)
                .overlay {
                    if let coverImage {
                        Image(uiImage: coverImage).resizable().scaledToFill()
                    }
                }
                .overlay {
                    if coverImage == nil {
                        RoundedRectangle(cornerRadius: Radius.xl, style: .continuous)
                            .strokeBorder(style: StrokeStyle(lineWidth: 1.5, dash: [6]))
                            .foregroundStyle(Palette.borderStrong)
                    }
                }
                .clipShape(RoundedRectangle(cornerRadius: Radius.xl, style: .continuous))

            if coverImage == nil {
                VStack(spacing: 8) {
                    Image(systemName: "film").font(.system(size: 28)).foregroundStyle(Palette.textMuted)
                    Text("Ajouter une couverture").gType(.bodyMuted)
                }
            } else {
                VStack {
                    Spacer()
                    HStack {
                        Spacer()
                        HStack(spacing: 6) {
                            Image(systemName: "camera.fill").font(.system(size: 12))
                            Text("Changer").font(.system(size: 12.5, weight: .semibold))
                        }
                        .foregroundStyle(.white)
                        .padding(.horizontal, 10).padding(.vertical, 6)
                        .background(.black.opacity(0.55), in: Capsule())
                    }
                }
                .padding(10)
            }
        }
        .frame(height: 170)
    }

    // MARK: - Success

    private func successView(space: Space) -> some View {
        ScrollView(showsIndicators: false) {
            VStack(spacing: Spacing.lg) {
                HStack {
                    Spacer()
                    IconButton(systemIcon: "xmark", size: 40) { dismiss() }
                }

                VStack(spacing: Spacing.md) {
                    Image(systemName: "sparkles")
                        .font(.system(size: 38))
                        .foregroundStyle(Palette.primary)
                        .frame(width: 84, height: 84)
                        .background(Palette.primarySoft, in: Circle())
                    Text("« \(space.name) » est prêt").gType(.title).multilineTextAlignment(.center)
                    Text("Partage ce code pour inviter ta bande. Ils rejoindront avec le rôle Membre.")
                        .gType(.bodyMuted).multilineTextAlignment(.center).frame(maxWidth: 300)
                }
                .padding(.top, Spacing.lg)

                if let code = createdCode {
                    GatherCard(elevated: true, glow: true) {
                        VStack(spacing: Spacing.md) {
                            Text("Code d'invitation").gType(.overline)
                            Text(code)
                                .font(.system(size: 38, weight: .heavy))
                                .tracking(6)
                                .foregroundStyle(Palette.text)
                            HStack(spacing: Spacing.md) {
                                GatherButton("Copier", systemIcon: "doc.on.doc", variant: .secondary, fullWidth: true) {
                                    UIPasteboard.general.string = code
                                    toasts.success("Code copié !")
                                }
                                ShareLink(item: shareMessage(space: space, code: code)) {
                                    HStack(spacing: 9) {
                                        Image(systemName: "square.and.arrow.up").font(.system(size: 17, weight: .semibold))
                                        Text("Partager").font(.system(size: 15, weight: .bold))
                                    }
                                    .foregroundStyle(.white)
                                    .frame(maxWidth: .infinity).frame(height: 48)
                                    .background(Palette.primary, in: RoundedRectangle(cornerRadius: Radius.md, style: .continuous))
                                }
                            }
                        }
                        .frame(maxWidth: .infinity)
                    }
                    .floatIn(delay: 0.1)
                }

                GatherButton("Ouvrir l'espace", size: .lg, fullWidth: true) {
                    dismiss()
                    onOpenSpace(space.id)
                }
                .padding(.top, Spacing.lg)
            }
            .padding(Spacing.lg)
        }
    }

    private func shareMessage(space: Space, code: String) -> String {
        "Rejoins « \(space.name) » sur Gather 🎬\nCode : \(code)"
    }

    // MARK: - Actions

    private func create() {
        guard !name.trimmed.isEmpty else { toasts.error("Donne un nom à ton espace."); return }
        guard end > start else { toasts.error("La fin de saison doit être après le début."); return }
        guard let uid = app.userId else { return }
        loading = true
        Task {
            do {
                // The storage policy only accepts paths starting with a space uuid,
                // so the space is created first and the cover uploaded under its id.
                var space = try await SpaceService.createSpace(
                    userId: uid, name: name, description: description, coverUrl: nil,
                    seasonStart: ISO8601DateFormatter().string(from: start),
                    seasonEnd: ISO8601DateFormatter().string(from: end)
                )
                if let coverData {
                    do {
                        let coverUrl = try await StorageService.upload(
                            kind: .covers, spaceId: space.id, userId: uid,
                            data: coverData, contentType: "image/jpeg", ext: "jpg"
                        )
                        space = try await SpaceService.updateCover(id: space.id, coverUrl: coverUrl)
                    } catch {
                        toasts.info("Espace créé, mais la couverture n'a pas pu être envoyée. Réessaie depuis les paramètres.")
                    }
                }
                let invite = try? await MemberService.createInvite(
                    spaceId: space.id, userId: uid, role: .member, maxUses: nil, expiresAt: nil
                )
                createdCode = invite?.code
                createdSpace = space
            } catch {
                toasts.error(FriendlyError.message(error))
            }
            loading = false
        }
    }
}

/// Compact date chip styled for the dark theme.
struct DatePickerChip: View {
    @Binding var date: Date
    var range: PartialRangeFrom<Date>? = nil

    var body: some View {
        Group {
            if let range {
                DatePicker("", selection: $date, in: range, displayedComponents: .date)
            } else {
                DatePicker("", selection: $date, displayedComponents: .date)
            }
        }
        .labelsHidden()
        .datePickerStyle(.compact)
        .tint(Palette.primary)
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.horizontal, Spacing.md)
        .frame(height: 50)
        .background(Palette.bgElevated, in: RoundedRectangle(cornerRadius: Radius.md, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: Radius.md, style: .continuous).stroke(Palette.border, lineWidth: 1.5))
    }
}
