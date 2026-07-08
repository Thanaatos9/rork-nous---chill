import SwiftUI

struct IdeasView: View {
    @Environment(SpaceStore.self) private var store
    @Environment(AppState.self) private var app
    @Environment(ToastCenter.self) private var toasts
    @Environment(\.dismiss) private var dismiss

    @State private var composing = false
    @State private var title = ""
    @State private var description = ""
    @State private var saving = false

    private var sorted: [Idea] {
        store.ideas.sorted {
            $0.voteCount != $1.voteCount ? $0.voteCount > $1.voteCount : ($0.createdAt ?? "") > ($1.createdAt ?? "")
        }
    }

    var body: some View {
        ZStack {
            ScreenBackground()
            ScrollView(showsIndicators: false) {
                VStack(alignment: .leading, spacing: Spacing.lg) {
                    header

                    if composing {
                        composer.floatIn()
                    }

                    if store.loadingIdeas && store.ideas.isEmpty {
                        Loader(label: "Chargement des idées…").frame(height: 220)
                    } else if sorted.isEmpty {
                        EmptyStateView(
                            systemIcon: "lightbulb.fill",
                            title: "Aucune idée pour l'instant",
                            subtitle: store.canParticipate
                                ? "Lance la première idée de sortie et laisse le groupe voter."
                                : "Les idées proposées apparaîtront ici.",
                            actionLabel: store.canParticipate ? "Proposer une idée" : nil,
                            action: store.canParticipate ? { composing = true } : nil
                        )
                    } else {
                        VStack(spacing: Spacing.md) {
                            ForEach(Array(sorted.enumerated()), id: \.element.id) { i, idea in
                                ideaCard(idea, index: i)
                            }
                        }
                    }
                }
                .padding(.horizontal, Spacing.lg)
                .padding(.top, Spacing.sm)
                .padding(.bottom, Spacing.xxxl)
            }
            .safeAreaPadding(.top, 50)
            .refreshable { await store.reloadIdeas(userId: app.userId) }
        }
    }

    private var header: some View {
        HStack(spacing: Spacing.md) {
            IconButton(systemIcon: "chevron.left", size: 40) { dismiss() }
            VStack(alignment: .leading, spacing: 2) {
                Text("Idées").gType(.title)
                Text("Vos prochaines aventures, votées ensemble").gType(.caption)
            }
            Spacer()
            if store.canParticipate {
                IconButton(systemIcon: composing ? "xmark" : "plus",
                           variant: composing ? .secondary : .primary,
                           tint: composing ? Palette.text : .white) {
                    withAnimation { composing.toggle() }
                }
            }
        }
    }

    private var composer: some View {
        GatherCard(elevated: true) {
            VStack(spacing: Spacing.md) {
                Field(label: "Ton idée") {
                    GatherTextField(placeholder: "Escape game ce week-end ?", text: $title)
                }
                Field(label: "Détails (optionnel)") {
                    GatherTextField(placeholder: "On peut réserver pour samedi soir…", text: $description, multiline: true)
                }
                GatherButton("Proposer au groupe", loading: saving, fullWidth: true, action: submit)
            }
        }
    }

    private func ideaCard(_ idea: Idea, index: Int) -> some View {
        let canDelete = store.isOwner || idea.proposedBy == app.userId
        return GatherCard {
            VStack(spacing: Spacing.md) {
                HStack(alignment: .top, spacing: Spacing.md) {
                    VStack(alignment: .leading, spacing: 4) {
                        Text(idea.title).gType(.h3)
                        if let d = idea.description, !d.isEmpty {
                            Text(d).gType(.bodyMuted)
                        }
                    }
                    Spacer(minLength: 0)
                    if canDelete {
                        Button {
                            Task { try? await SocialService.deleteIdea(id: idea.id); await store.reloadIdeas(userId: app.userId) }
                        } label: {
                            Image(systemName: "trash").font(.system(size: 16)).foregroundStyle(Palette.textFaint)
                        }
                        .buttonStyle(.plain)
                    }
                }
                HStack {
                    HStack(spacing: 8) {
                        AvatarView(profile: idea.profile, size: 24)
                        Text("\(idea.profile?.name ?? "Membre") · \(DateParse.formatRelative(idea.createdAt))").gType(.caption)
                    }
                    Spacer()
                    voteButton(idea)
                }
            }
        }
        .floatIn(delay: Double(index) * 0.05)
    }

    private func voteButton(_ idea: Idea) -> some View {
        Button {
            guard store.canParticipate else { toasts.info("Seuls les membres peuvent voter."); return }
            guard let uid = app.userId else { return }
            Task {
                try? await SocialService.toggleIdeaVote(ideaId: idea.id, userId: uid, voted: idea.voted)
                await store.reloadIdeas(userId: uid)
            }
        } label: {
            HStack(spacing: 6) {
                Image(systemName: idea.voted ? "flame.fill" : "flame")
                    .font(.system(size: 14))
                Text("\(idea.voteCount)").font(.system(size: 13, weight: .bold))
            }
            .foregroundStyle(idea.voted ? .white : Palette.textMuted)
            .padding(.horizontal, 12).padding(.vertical, 7)
            .background(idea.voted ? Palette.primary : Palette.surface, in: Capsule())
        }
        .buttonStyle(PressableStyle(scale: 0.92))
    }

    private func submit() {
        guard !title.trimmed.isEmpty else { toasts.error("Donne un titre à ton idée."); return }
        guard let uid = app.userId else { return }
        saving = true
        Task {
            do {
                try await SocialService.createIdea(spaceId: store.spaceId, userId: uid, title: title, description: description)
                title = ""; description = ""; composing = false
                toasts.success("Idée proposée 💡")
                await store.reloadIdeas(userId: uid)
            } catch {
                toasts.error(FriendlyError.message(error))
            }
            saving = false
        }
    }
}
