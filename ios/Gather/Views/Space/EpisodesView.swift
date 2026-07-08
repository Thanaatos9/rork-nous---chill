import SwiftUI

struct EpisodesView: View {
    @Environment(SpaceStore.self) private var store
    @Environment(AppState.self) private var app
    @Environment(\.dismiss) private var dismiss

    enum Mode { case grid, timeline }
    @State private var mode: Mode = .grid
    @State private var showCreate = false

    private let columns = [GridItem(.flexible(), spacing: Spacing.md), GridItem(.flexible(), spacing: Spacing.md)]

    var body: some View {
        ZStack {
            ScreenBackground()
            ScrollView(showsIndicators: false) {
                VStack(alignment: .leading, spacing: Spacing.lg) {
                    header

                    if store.loadingEpisodes && store.episodes.isEmpty {
                        Loader(label: "Chargement des épisodes…").frame(height: 220)
                    } else if store.episodes.isEmpty {
                        EmptyStateView(
                            systemIcon: "film.stack",
                            title: "Pas encore d'épisode",
                            subtitle: store.canParticipate
                                ? "Immortalise votre premier moment ensemble — ajoute des photos, un lieu, des tags."
                                : "Les épisodes apparaîtront ici dès qu'un membre en créera un.",
                            actionLabel: store.canParticipate ? "Créer un épisode" : nil,
                            action: store.canParticipate ? { showCreate = true } : nil
                        )
                    } else {
                        modeToggle
                        if mode == .grid {
                            LazyVGrid(columns: columns, spacing: Spacing.md) {
                                ForEach(Array(store.episodes.enumerated()), id: \.element.id) { i, ep in
                                    NavigationLink(value: AppRoute.episode(ep.id)) {
                                        EpisodePoster(episode: ep, width: gridWidth, index: i)
                                    }
                                    .buttonStyle(PressableStyle(scale: 0.97))
                                }
                            }
                        } else {
                            VStack(spacing: Spacing.md) {
                                ForEach(Array(store.episodes.enumerated()), id: \.element.id) { i, ep in
                                    NavigationLink(value: AppRoute.episode(ep.id)) {
                                        EpisodeRowCard(episode: ep, index: i)
                                    }
                                    .buttonStyle(PressableStyle(scale: 0.98))
                                }
                            }
                        }
                    }
                }
                .padding(.horizontal, Spacing.lg)
                .padding(.top, Spacing.sm)
                .padding(.bottom, Spacing.xxxl)
            }
            .safeAreaPadding(.top, 50)
            .refreshable { await store.reloadEpisodes() }
        }
        .sheet(isPresented: $showCreate) {
            CreateEpisodeView(spaceId: store.spaceId) { Task { await store.reloadEpisodes() } }
        }
    }

    private var gridWidth: CGFloat {
        (UIScreen.main.bounds.width - Spacing.lg * 2 - Spacing.md) / 2
    }

    private var header: some View {
        HStack(alignment: .center, spacing: Spacing.md) {
            IconButton(systemIcon: "chevron.left", size: 40) { dismiss() }
            VStack(alignment: .leading, spacing: 2) {
                Text("Épisodes").gType(.title)
                Text("\(store.episodes.count) moment\(store.episodes.count > 1 ? "s" : "") vécu\(store.episodes.count > 1 ? "s" : "")").gType(.caption)
            }
            Spacer()
            if store.canParticipate {
                IconButton(systemIcon: "plus", variant: .primary, tint: .white) { showCreate = true }
            }
        }
    }

    private var modeToggle: some View {
        HStack(spacing: 3) {
            toggleButton(.grid, icon: "square.grid.2x2", label: "Grille")
            toggleButton(.timeline, icon: "list.bullet", label: "Timeline")
        }
        .padding(3)
        .background(Palette.card, in: RoundedRectangle(cornerRadius: Radius.md, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: Radius.md, style: .continuous).stroke(Palette.border, lineWidth: 1))
    }

    private func toggleButton(_ m: Mode, icon: String, label: String) -> some View {
        let active = mode == m
        return Button { withAnimation(.easeOut(duration: 0.2)) { mode = m } } label: {
            HStack(spacing: 6) {
                Image(systemName: icon).font(.system(size: 13))
                Text(label).font(.system(size: 13, weight: .semibold))
            }
            .foregroundStyle(active ? Palette.text : Palette.textFaint)
            .padding(.horizontal, 14).padding(.vertical, 7)
            .background(active ? Palette.surface : .clear, in: RoundedRectangle(cornerRadius: Radius.sm, style: .continuous))
        }
        .buttonStyle(.plain)
    }
}
