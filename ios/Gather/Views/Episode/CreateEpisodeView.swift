import SwiftUI
import PhotosUI

private let suggestedTags = ["🍽️ Resto", "🎉 Soirée", "🏖️ Vacances", "🎬 Ciné", "🥾 Rando", "☕ Café", "🎤 Concert", "🏠 Cocooning"]

struct CreateEpisodeView: View {
    let spaceId: String
    var onCreated: () -> Void

    @Environment(\.dismiss) private var dismiss
    @Environment(AppState.self) private var app
    @Environment(ToastCenter.self) private var toasts

    @State private var title = ""
    @State private var date = Date()
    @State private var place = ""
    @State private var durationStr = ""
    @State private var tags: [String] = []
    @State private var tagDraft = ""
    @State private var assets: [PickedMedia] = []
    @State private var pickerItems: [PhotosPickerItem] = []
    @State private var showCamera = false
    @State private var loading = false

    @State private var canParticipate = true
    @State private var checked = false

    var body: some View {
        ZStack {
            ScreenBackground()
            if checked && !canParticipate {
                readOnly
            } else {
                form
            }
        }
        .presentationBackground(Palette.bg)
        .task {
            if let detail = try? await SpaceService.space(id: spaceId, userId: app.userId ?? "") {
                canParticipate = Permissions.canParticipate(detail.membership)
            }
            checked = true
        }
        .onChange(of: pickerItems) { _, items in
            guard !items.isEmpty else { return }
            Task {
                let media = await MediaLoader.load(items)
                pickerItems = []
                assets = Array((assets + media).prefix(12))
            }
        }
        .fullScreenCover(isPresented: $showCamera) {
            CameraPicker { media in assets = Array((assets + [media]).prefix(12)) }
                .ignoresSafeArea()
        }
    }

    private var readOnly: some View {
        VStack(spacing: Spacing.md) {
            HStack { Spacer(); IconButton(systemIcon: "xmark", size: 40) { dismiss() } }
            Spacer()
            Text("Lecture seule").gType(.h2)
            Text("Le propriétaire doit te promouvoir pour créer des épisodes.")
                .gType(.bodyMuted).multilineTextAlignment(.center)
            Spacer()
        }
        .padding(Spacing.lg)
    }

    private var form: some View {
        ScrollView(showsIndicators: false) {
            VStack(alignment: .leading, spacing: Spacing.lg) {
                HStack {
                    Text("Nouvel épisode").gType(.title)
                    Spacer()
                    IconButton(systemIcon: "xmark", size: 40) { dismiss() }
                }

                Field(label: "Photos & vidéos") {
                    VStack(spacing: Spacing.md) {
                        HStack(spacing: Spacing.md) {
                            PhotosPicker(selection: $pickerItems, maxSelectionCount: 10, matching: .any(of: [.images, .videos])) {
                                pickerButtonLabel(icon: "photo.on.rectangle", label: "Galerie")
                            }
                            .buttonStyle(.plain)
                            Button { openCamera() } label: {
                                pickerButtonLabel(icon: "camera", label: "Caméra")
                            }
                            .buttonStyle(.plain)
                        }
                        if !assets.isEmpty { assetStrip }
                    }
                }

                Field(label: "Titre") {
                    GatherTextField(placeholder: "Notre week-end à Lisbonne", text: $title)
                }

                HStack(alignment: .top, spacing: Spacing.md) {
                    Field(label: "Date") { DatePickerChip(date: $date) }
                    Field(label: "Durée (min)") {
                        GatherTextField(placeholder: "90", text: $durationStr, systemIcon: "clock", keyboard: .numberPad)
                    }
                }

                Field(label: "Lieu (optionnel)") {
                    GatherTextField(placeholder: "Lisbonne, Portugal", text: $place, systemIcon: "mappin")
                }

                Field(label: "Tags") {
                    VStack(alignment: .leading, spacing: Spacing.sm) {
                        GatherTextField(placeholder: "Ajoute un tag puis valide", text: $tagDraft,
                                        systemIcon: "tag", autocapitalization: .never,
                                        submitLabel: .done, onSubmit: { addTag(tagDraft) })
                        if !tags.isEmpty {
                            FlowLayout(spacing: 7, lineSpacing: 7) {
                                ForEach(tags, id: \.self) { tag in
                                    Button { tags.removeAll { $0 == tag } } label: {
                                        HStack(spacing: 5) {
                                            Text(tag).font(.system(size: 13, weight: .semibold))
                                            Image(systemName: "xmark").font(.system(size: 10))
                                        }
                                        .foregroundStyle(Palette.primary)
                                        .padding(.horizontal, 10).padding(.vertical, 6)
                                        .background(Palette.primarySoft, in: Capsule())
                                    }
                                    .buttonStyle(.plain)
                                }
                            }
                        }
                        FlowLayout(spacing: 7, lineSpacing: 7) {
                            ForEach(suggestedTags.filter { !tags.contains($0) }.prefix(6), id: \.self) { tag in
                                Button { addTag(tag) } label: {
                                    HStack(spacing: 4) {
                                        Image(systemName: "plus").font(.system(size: 10))
                                        Text(tag).font(.system(size: 12.5, weight: .semibold))
                                    }
                                    .foregroundStyle(Palette.textMuted)
                                    .padding(.horizontal, 10).padding(.vertical, 6)
                                    .background(Palette.surface, in: Capsule())
                                }
                                .buttonStyle(.plain)
                            }
                        }
                    }
                }

                GatherButton(loading ? "Publication…" : "Publier l'épisode", size: .lg, loading: loading, fullWidth: true, action: submit)
                    .padding(.top, Spacing.xs)
            }
            .padding(Spacing.lg)
            .padding(.bottom, Spacing.xxxl)
        }
    }

    private func pickerButtonLabel(icon: String, label: String) -> some View {
        HStack(spacing: 9) {
            Image(systemName: icon).font(.system(size: 18))
            Text(label).font(.system(size: 15, weight: .bold))
        }
        .foregroundStyle(Palette.text)
        .frame(maxWidth: .infinity).frame(height: 48)
        .background(Palette.surface, in: RoundedRectangle(cornerRadius: Radius.md, style: .continuous))
    }

    private var assetStrip: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: Spacing.sm) {
                ForEach(assets) { asset in
                    ZStack(alignment: .topTrailing) {
                        Group {
                            if asset.type == "image", let img = UIImage(data: asset.data) {
                                Image(uiImage: img).resizable().scaledToFill()
                            } else {
                                Palette.surface.overlay(Image(systemName: "video.fill").foregroundStyle(.white))
                            }
                        }
                        .frame(width: 84, height: 110)
                        .clipShape(RoundedRectangle(cornerRadius: Radius.md, style: .continuous))

                        Button { assets.removeAll { $0.id == asset.id } } label: {
                            Image(systemName: "xmark").font(.system(size: 11, weight: .bold)).foregroundStyle(.white)
                                .padding(5).background(.black.opacity(0.65), in: Circle())
                        }
                        .buttonStyle(.plain)
                        .padding(5)
                    }
                }
            }
        }
    }

    private func addTag(_ raw: String) {
        let t = raw.trimmed
        guard !t.isEmpty, !tags.contains(t), tags.count < 8 else { return }
        tags.append(t)
        tagDraft = ""
    }

    private func openCamera() {
        if CameraPicker.isAvailable {
            showCamera = true
        } else {
            toasts.info("Installe cette app sur ton appareil via Rork pour utiliser la caméra.")
        }
    }

    private func submit() {
        guard !title.trimmed.isEmpty else { toasts.error("Donne un titre à cet épisode."); return }
        guard let uid = app.userId else { return }
        loading = true
        Task {
            do {
                let digits = durationStr.filter { $0.isNumber }
                let duration = digits.isEmpty ? nil : Int(digits)
                // The episode is created first so uploads can use its id in
                // candidate storage paths; a failed upload rolls it back.
                let episode = try await EpisodeService.createEpisode(
                    spaceId: spaceId, userId: uid, title: title,
                    date: ISO8601DateFormatter().string(from: date),
                    place: place, duration: duration, tags: tags, uploaded: []
                )
                do {
                    var uploaded: [(url: String, type: String)] = []
                    for asset in assets {
                        let url = try await StorageService.upload(
                            kind: .episodes, spaceId: spaceId, userId: uid, episodeId: episode.id,
                            data: asset.data, contentType: asset.contentType, ext: asset.ext
                        )
                        uploaded.append((url, asset.type))
                    }
                    try await EpisodeService.addMedia(episodeId: episode.id, uploaded: uploaded)
                    if let coverUrl = uploaded.first(where: { $0.type == "image" })?.url {
                        try? await EpisodeService.setCover(episodeId: episode.id, url: coverUrl)
                    }
                } catch {
                    // Best-effort rollback so a failed upload doesn't leave an empty episode.
                    try? await EpisodeService.deleteEpisode(id: episode.id)
                    throw error
                }
                toasts.success("Épisode créé 🎬")
                onCreated()
                dismiss()
            } catch {
                toasts.error(FriendlyError.message(error))
            }
            loading = false
        }
    }
}
