import SwiftUI
import UIKit

enum SpaceTab: Hashable {
    case dashboard, episodes, ideas, recap, members
}

struct SpaceDetailView: View {
    let spaceId: String

    @Environment(AppState.self) private var app
    @State private var store: SpaceStore
    @State private var selectedTab: SpaceTab = .dashboard

    init(spaceId: String) {
        self.spaceId = spaceId
        _store = State(initialValue: SpaceStore(spaceId: spaceId))
        Self.configureTabBarAppearance()
    }

    var body: some View {
        TabView(selection: $selectedTab) {
            SpaceDashboardView(selectTab: { selectedTab = $0 })
                .tag(SpaceTab.dashboard)
                .tabItem { Label("Accueil", systemImage: "house.fill") }

            EpisodesView()
                .tag(SpaceTab.episodes)
                .tabItem { Label("Épisodes", systemImage: "film.stack") }

            IdeasView()
                .tag(SpaceTab.ideas)
                .tabItem { Label("Idées", systemImage: "lightbulb.fill") }

            RecapView(selectTab: { selectedTab = $0 })
                .tag(SpaceTab.recap)
                .tabItem { Label("Bilan", systemImage: "sparkles") }

            MembersView()
                .tag(SpaceTab.members)
                .tabItem { Label("Membres", systemImage: "person.2.fill") }
        }
        .tint(Palette.primary)
        .environment(store)
        .toolbar(.hidden, for: .navigationBar)
        .navigationBarBackButtonHidden(true)
        .task(id: spaceId) {
            await store.loadAll(userId: app.userId ?? "")
        }
    }

    private static func configureTabBarAppearance() {
        let appearance = UITabBarAppearance()
        appearance.configureWithOpaqueBackground()
        appearance.backgroundColor = PaletteUI.bgDeep
        appearance.shadowColor = PaletteUI.border
        let normal = PaletteUI.textFaint
        let selected = PaletteUI.primary
        appearance.stackedLayoutAppearance.normal.iconColor = normal
        appearance.stackedLayoutAppearance.normal.titleTextAttributes = [.foregroundColor: normal]
        appearance.stackedLayoutAppearance.selected.iconColor = selected
        appearance.stackedLayoutAppearance.selected.titleTextAttributes = [.foregroundColor: selected]
        UITabBar.appearance().standardAppearance = appearance
        UITabBar.appearance().scrollEdgeAppearance = appearance
    }
}
