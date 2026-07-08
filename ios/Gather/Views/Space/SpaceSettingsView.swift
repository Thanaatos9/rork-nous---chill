import SwiftUI
import PhotosUI

struct SpaceSettingsView: View {
    var onSaved: () -> Void
    var onDeleted: () -> Void

    @Environment(SpaceStore.self) private var store
    @Environment(AppState.self) private var app
    @Environment(ToastCenter.self) private var toasts
    @Environment(\.dismiss) private var dismiss

    @State private var name = ""
    @State private var description = ""
    @State private var start = Date()
    @State private var end = Calendar.current.date(byAdding: .month, value: 3, to: Date()) ?? Date()
    @State private var coverItem: PhotosPickerItem?
    @State private var coverImage: UIImage?
    @State private var coverData: Data?
    @State private var adjusting: AdjustableImage?
    @State private var hydrated = false
    @State private var saving = false
    @State private var deleting = false
    @State private var confirmDelete = false

    var body: some View {
        ZStack {
            ScreenBackground()
            if let space = store.space {
                form(space: space)
            } else {
                Loader(label: "Chargement…")
            }
        }
        .presentationBackground(Palette.bg)
        .onChange(of: coverItem) { _, item in
            guard let item else { return }
            Task {
                if let data = try? await item.loadTransferable(type: Data.self), let img = UIImage(data: data) {
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
        .alert("Supprimer l'espace ?", isPresented: $confirmDelete) {
            Button("Annuler", role: .cancel) {}
            Button("Supprimer", role: .destructive) { deleteSpace() }
        } message: {
            Text("« \(store.space?.name ?? "Cet espace") » et tout son contenu seront définitivement supprimés. Cette action est irréversible.")
        }
    }

    private func form(space: Space) -> some View {
        ScrollView(showsIndicators: false) {
            VStack(alignment: .leading, spacing: Spacing.xl) {
                HStack {
                    Text("Paramètres").gType(.title)
                    Spacer()
                    IconButton(systemIcon: "xmark", size: 40) { dismiss() }
                }

                PhotosPicker(selection: $coverItem, matching: .images) { coverPicker }
                    .buttonStyle(.plain)

                VStack(alignment: .leading, spacing: Spacing.lg) {
                    Field(label: "Nom de l'espace") { GatherTextField(placeholder: "Nom", text: $name) }
                    Field(label: "Description") { GatherTextField(placeholder: "Décris votre aventure…", text: $description, multiline: true) }
                    HStack(spacing: Spacing.md) {
                        Field(label: "Début de saison") { DatePickerChip(date: $start) }
                        Field(label: "Fin de saison") { DatePickerChip(date: $end, range: start...) }
                    }
                    GatherButton("Enregistrer", size: .lg, loading: saving, fullWidth: true, action: save)
                }

                VStack(alignment: .leading, spacing: Spacing.md) {
                    SectionHeader("Zone de danger")
                    GatherCard {
                        VStack(alignment: .leading, spacing: Spacing.md) {
                            Text("La suppression efface tous les épisodes, reviews et médias de cet espace.").gType(.bodyMuted)
                            GatherButton("Supprimer l'espace", systemIcon: "trash", variant: .destructive, loading: deleting, fullWidth: true) {
                                confirmDelete = true
                            }
                        }
                    }
                    .overlay(RoundedRectangle(cornerRadius: Radius.xl, style: .continuous).stroke(Palette.destructiveSoft, lineWidth: 1))
                }
                .padding(.top, Spacing.lg)
            }
            .padding(Spacing.lg)
            .padding(.bottom, Spacing.xxxl)
        }
        .onAppear {
            guard !hydrated else { return }
            name = space.name
            description = space.description ?? ""
            if let s = DateParse.iso(space.seasonStart) { start = s }
            if let e = DateParse.iso(space.seasonEnd) { end = e }
            hydrated = true
        }
    }

    private var coverPicker: some View {
        ZStack {
            RoundedRectangle(cornerRadius: Radius.xl, style: .continuous)
                .fill(Palette.card)
                .frame(height: 160)
                .overlay {
                    if let coverImage {
                        Image(uiImage: coverImage).resizable().scaledToFill()
                    } else if let cover = store.space?.coverUrl, !cover.isEmpty {
                        RemoteImage(urlString: cover) { Color.clear }
                    }
                }
                .clipShape(RoundedRectangle(cornerRadius: Radius.xl, style: .continuous))
            if coverImage == nil && (store.space?.coverUrl ?? "").isEmpty {
                VStack(spacing: 8) {
                    Image(systemName: "film").font(.system(size: 26)).foregroundStyle(Palette.textMuted)
                    Text("Ajouter une couverture").gType(.bodyMuted)
                }
            } else {
                VStack { Spacer(); HStack { Spacer()
                    HStack(spacing: 6) {
                        Image(systemName: "camera.fill").font(.system(size: 12))
                        Text("Changer").font(.system(size: 12.5, weight: .semibold))
                    }
                    .foregroundStyle(.white).padding(.horizontal, 10).padding(.vertical, 6)
                    .background(.black.opacity(0.55), in: Capsule())
                } }.padding(10)
            }
        }
        .frame(height: 160)
    }

    private func save() {
        guard !name.trimmed.isEmpty else { toasts.error("Le nom ne peut pas être vide."); return }
        saving = true
        Task {
            do {
                var coverUrl = store.space?.coverUrl
                if let coverData {
                    // The uploader probes the storage rules for an accepted path format.
                    coverUrl = try await StorageService.upload(
                        kind: .covers, spaceId: store.spaceId, userId: app.userId,
                        data: coverData, contentType: "image/jpeg", ext: "jpg"
                    )
                }
                try await SpaceService.updateDetails(
                    id: store.spaceId, name: name, description: description, coverUrl: coverUrl,
                    seasonStart: ISO8601DateFormatter().string(from: start),
                    seasonEnd: ISO8601DateFormatter().string(from: end)
                )
                toasts.success("Espace mis à jour")
                onSaved()
                dismiss()
            } catch {
                toasts.error(FriendlyError.message(error))
            }
            saving = false
        }
    }

    private func deleteSpace() {
        deleting = true
        Task {
            do {
                try await SpaceService.deleteSpace(id: store.spaceId)
                toasts.success("Espace supprimé")
                dismiss()
                onDeleted()
            } catch {
                toasts.error(FriendlyError.message(error))
            }
            deleting = false
        }
    }
}
