import SwiftUI

struct HomeView: View {
    @Environment(AppState.self) private var app
    @Environment(ToastCenter.self) private var toasts

    @State private var model = HomeViewModel()
    private var push = PushCoordinator.shared
    @State private var path: [AppRoute] = []
    @State private var showCreate = false
    @State private var showJoin = false
    @State private var joinPrefill: String = ""

    private var firstName: String {
        app.profile?.name?.split(separator: " ").first.map(String.init) ?? "toi"
    }

    var body: some View {
        NavigationStack(path: $path) {
            ScrollView(showsIndicators: false) {
                VStack(alignment: .leading, spacing: 0) {
                    header
                        .padding(.bottom, Spacing.xl)

                    HStack(spacing: Spacing.md) {
                        GatherButton("Créer", systemIcon: "plus", fullWidth: true) { showCreate = true }
                        GatherButton("Rejoindre", systemIcon: "ticket", variant: .secondary, fullWidth: true) {
                            joinPrefill = ""; showJoin = true
                        }
                    }
                    .padding(.bottom, Spacing.xxl)
                    .floatIn()

                    SectionHeader("Tes espaces")
                        .padding(.bottom, Spacing.md)

                    content
                }
                .padding(.horizontal, Spacing.lg)
                .padding(.bottom, Spacing.xxxl)
            }
            .background(ScreenBackground())
            .refreshable { await model.load(userId: app.userId ?? "") }
            .toolbar(.hidden, for: .navigationBar)
            .navigationDestination(for: AppRoute.self) { route in
                destination(route)
            }
        }
        .task(id: app.userId) {
            guard let uid = app.userId else { return }
            await model.load(userId: uid)
            // Consume a pending invite captured before sign-in.
            if let code = PendingInvite.get() {
                PendingInvite.clear()
                joinPrefill = code
                showJoin = true
            }
        }
        .onChange(of: push.pendingJoinCode) { _, code in
            // Consume an invite deep link received while the app is running.
            guard let code, !code.isEmpty else { return }
            push.pendingJoinCode = nil
            joinPrefill = code
            showJoin = true
        }
        .sheet(isPresented: $showCreate) {
            CreateSpaceView { newSpaceId in
                Task { await model.load(userId: app.userId ?? "") }
                path.append(.space(newSpaceId))
            }
        }
        .sheet(isPresented: $showJoin) {
            JoinSpaceView(prefill: joinPrefill) { spaceId in
                Task { await model.load(userId: app.userId ?? "") }
                path.append(.space(spaceId))
            }
        }
    }

    // MARK: - Header

    private var header: some View {
        HStack(alignment: .center) {
            VStack(alignment: .leading, spacing: 2) {
                Text("SALUT 👋").font(.system(size: 12, weight: .semibold)).foregroundStyle(Palette.textMuted)
                Text(firstName).gType(.title).lineLimit(1)
            }
            Spacer()
            HStack(spacing: Spacing.sm) {
                Button { path.append(.notifications) } label: {
                    ZStack(alignment: .topTrailing) {
                        Image(systemName: "bell")
                            .font(.system(size: 19, weight: .medium))
                            .foregroundStyle(Palette.text)
                            .frame(width: 44, height: 44)
                            .background(Palette.card, in: Circle())
                            .overlay(Circle().stroke(Palette.border, lineWidth: 1))
                        if model.unreadCount > 0 {
                            Circle().fill(Palette.primary)
                                .frame(width: 10, height: 10)
                                .overlay(Circle().stroke(Palette.card, lineWidth: 1.5))
                                .offset(x: -8, y: 8)
                        }
                    }
                }
                .buttonStyle(PressableStyle(scale: 0.9))

                Button { path.append(.settings) } label: {
                    AvatarView(profile: app.profile, size: 44)
                }
                .buttonStyle(PressableStyle(scale: 0.9))
            }
        }
        .padding(.top, Spacing.sm)
    }

    // MARK: - Content

    @ViewBuilder
    private var content: some View {
        if model.isLoading {
            Loader(label: "Chargement de tes aventures…")
                .frame(height: 240)
        } else if model.spaces.isEmpty {
            EmptyStateView(
                systemIcon: "sparkles",
                title: "Aucun espace pour l'instant",
                subtitle: "Crée ta première aventure partagée, ou rejoins celle d'un proche avec un code d'invitation.",
                actionLabel: "Créer un espace",
                action: { showCreate = true }
            )
        } else {
            VStack(spacing: Spacing.lg) {
                ForEach(Array(model.spaces.enumerated()), id: \.element.id) { i, space in
                    Button { path.append(.space(space.id)) } label: {
                        SpaceCardView(space: space, index: i)
                    }
                    .buttonStyle(PressableStyle(scale: 0.98))
                }
                Button { joinPrefill = ""; showJoin = true } label: {
                    Text("+ Rejoindre un autre espace")
                        .font(.system(size: 15, weight: .semibold))
                        .foregroundStyle(Palette.textMuted)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, Spacing.lg)
                }
                .buttonStyle(.plain)
            }
        }
    }

    // MARK: - Destinations

    @ViewBuilder
    private func destination(_ route: AppRoute) -> some View {
        switch route {
        case .space(let id):
            SpaceDetailView(spaceId: id)
        case .episode(let id):
            EpisodeDetailView(episodeId: id)
        case .settings:
            SettingsView()
        case .notifications:
            NotificationsView()
        }
    }
}
