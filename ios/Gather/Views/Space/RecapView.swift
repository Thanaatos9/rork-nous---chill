import SwiftUI
import AVKit

struct RecapView: View {
    var selectTab: (SpaceTab) -> Void

    @Environment(SpaceStore.self) private var store
    @Environment(AppState.self) private var app
    @Environment(ToastCenter.self) private var toasts
    @Environment(\.dismiss) private var dismiss

    @State private var unlocking = false
    @State private var confirmUnlock = false

    var body: some View {
        ZStack {
            ScreenBackground()
            if store.loadingSpace, store.space == nil {
                Loader(label: "Chargement du bilan…")
            } else if let space = store.space {
                content(space: space)
            }
        }
        .alert("Débloquer la saison ?", isPresented: $confirmUnlock) {
            Button("Annuler", role: .cancel) {}
            Button("Débloquer", role: .destructive) { unlock() }
        } message: {
            Text("Toutes les reviews privées seront révélées à l'ensemble du groupe. Cette action lance le grand moment de vérité 🎬")
        }
    }

    @ViewBuilder
    private func content(space: Space) -> some View {
        let status = Season.status(for: space)
        ScrollView(showsIndicators: false) {
            VStack(alignment: .leading, spacing: Spacing.xl) {
                HStack(spacing: Spacing.md) {
                    IconButton(systemIcon: "chevron.left", size: 40) { dismiss() }
                    VStack(alignment: .leading, spacing: 2) {
                        Text("Bilan de saison").gType(.title)
                        Text(space.name).gType(.caption)
                    }
                    Spacer()
                }

                if !space.unlocked {
                    lockedView(space: space, status: status).floatIn()
                } else {
                    unlockedView(space: space).floatIn()
                }
            }
            .padding(.horizontal, Spacing.lg)
            .padding(.top, Spacing.sm)
            .padding(.bottom, Spacing.xxxl)
        }
        .safeAreaPadding(.top, 50)
    }

    // MARK: - Locked

    private func lockedView(space: Space, status: SeasonStatus) -> some View {
        VStack(spacing: Spacing.xl) {
            VStack(spacing: Spacing.lg) {
                Image(systemName: "lock.fill")
                    .font(.system(size: 42))
                    .foregroundStyle(Palette.primary)
                    .frame(width: 96, height: 96)
                    .background(Palette.primarySoft, in: Circle())
                    .overlay(Circle().stroke(Palette.primary, lineWidth: 1))
                    .pulse()

                VStack(spacing: 6) {
                    Text("Le bilan est scellé").gType(.h2)
                    Text(status.daysLeft.map { $0 > 0
                        ? "Encore \($0) jour\($0 > 1 ? "s" : "") avant la révélation. Toutes les reviews seront dévoilées en même temps."
                        : "La saison touche à sa fin. Place au grand moment de vérité." }
                        ?? "La saison touche à sa fin. Place au grand moment de vérité.")
                        .gType(.bodyMuted).multilineTextAlignment(.center).frame(maxWidth: 320)
                }

                if let days = status.daysLeft {
                    HStack(alignment: .lastTextBaseline, spacing: 8) {
                        Text("\(days)").font(.system(size: 56, weight: .heavy)).tracking(-2).foregroundStyle(.white)
                        Text("jours").gType(.h3).foregroundStyle(Palette.textMuted)
                    }
                }
                if let end = space.seasonEnd {
                    Text("Fin prévue le \(DateParse.formatDate(end))").gType(.caption)
                }
            }
            .frame(maxWidth: .infinity)
            .padding(Spacing.xl)
            .background(
                LinearGradient(colors: [Color(hex: 0x2A0E13), Color(hex: 0x16100F)], startPoint: .top, endPoint: .bottom),
                in: RoundedRectangle(cornerRadius: Radius.xxl, style: .continuous)
            )
            .overlay(RoundedRectangle(cornerRadius: Radius.xxl, style: .continuous).stroke(Palette.border, lineWidth: 1))

            if store.isOwner {
                GatherButton("Débloquer la saison maintenant", systemIcon: "sparkles", size: .lg, loading: unlocking, fullWidth: true) {
                    confirmUnlock = true
                }
            } else {
                GatherCard {
                    HStack(spacing: 10) {
                        Image(systemName: "lock.fill").font(.system(size: 16)).foregroundStyle(Palette.textMuted)
                        Text("Seul le propriétaire peut débloquer la saison. Patience, le grand moment approche !").gType(.bodyMuted)
                    }
                }
            }

            HStack(spacing: Spacing.md) {
                StatBox(label: "Épisodes", value: store.episodes.count, icon: "film.stack", tint: Palette.primary)
                StatBox(label: "Membres", value: store.members.count, icon: "person.2.fill", tint: Palette.accent)
            }
        }
    }

    // MARK: - Unlocked

    private func unlockedView(space: Space) -> some View {
        VStack(spacing: Spacing.xxl) {
            VStack(spacing: Spacing.sm) {
                Image(systemName: "sparkles")
                    .font(.system(size: 36))
                    .foregroundStyle(Palette.accent)
                    .frame(width: 80, height: 80)
                    .background(Palette.accentSoft, in: Circle())
                Text("Saison révélée ✨").gType(.h2)
                Text("Toutes les reviews sont désormais visibles. Replongez dans vos épisodes pour les découvrir.")
                    .gType(.bodyMuted).multilineTextAlignment(.center).frame(maxWidth: 320)
            }
            .frame(maxWidth: .infinity)

            if let video = store.synthese?.videoUrl, let url = URL(string: video) {
                VStack(alignment: .leading, spacing: Spacing.sm) {
                    Text("Votre vidéo souvenir").gType(.overline)
                    VideoPlayer(player: AVPlayer(url: url))
                        .aspectRatio(16/9, contentMode: .fit)
                        .clipShape(RoundedRectangle(cornerRadius: Radius.lg, style: .continuous))
                }
            }

            if let summary = store.synthese?.summary ?? store.synthese?.content, summary.count > 20 {
                GatherCard(elevated: true) {
                    VStack(alignment: .leading, spacing: Spacing.sm) {
                        HStack(spacing: 8) {
                            Image(systemName: "film").font(.system(size: 15)).foregroundStyle(Palette.accent)
                            Text("La synthèse de votre saison").gType(.overline)
                        }
                        Text(summary).gType(.body).lineSpacing(4)
                    }
                }
            } else if store.synthese?.videoUrl == nil {
                GatherCard {
                    VStack(spacing: 6) {
                        Image(systemName: "film").font(.system(size: 22)).foregroundStyle(Palette.textMuted)
                        Text("La synthèse et la vidéo souvenir seront générées sous peu.").gType(.bodyMuted).multilineTextAlignment(.center)
                    }
                    .frame(maxWidth: .infinity)
                }
            }

            HStack(spacing: Spacing.md) {
                StatBox(label: "Épisodes", value: store.episodes.count, icon: "film.stack", tint: Palette.primary)
                StatBox(label: "Membres", value: store.members.count, icon: "person.2.fill", tint: Palette.accent)
            }

            VStack(spacing: Spacing.md) {
                GatherButton("Revoir les épisodes", systemIcon: "film.stack", variant: .secondary, fullWidth: true) { selectTab(.episodes) }
                ShareLink(item: "On vient de débloquer le bilan de « \(space.name) » sur Gather 🎬✨") {
                    HStack(spacing: 9) {
                        Image(systemName: "square.and.arrow.up").font(.system(size: 17, weight: .semibold))
                        Text("Partager le bilan").font(.system(size: 15, weight: .bold))
                    }
                    .foregroundStyle(Palette.goldFg)
                    .frame(maxWidth: .infinity).frame(height: 48)
                    .background(Palette.accent, in: RoundedRectangle(cornerRadius: Radius.md, style: .continuous))
                }
            }
        }
    }

    private func unlock() {
        guard let uid = app.userId else { return }
        unlocking = true
        Task {
            do {
                try await SpaceService.unlockSeason(id: store.spaceId)
                await store.reloadSpace(userId: uid)
                toasts.success("Saison débloquée 🎉")
            } catch {
                toasts.error(FriendlyError.message(error))
            }
            unlocking = false
        }
    }
}

struct StatBox: View {
    var label: String
    var value: Int
    var icon: String
    var tint: Color
    var body: some View {
        VStack(spacing: 4) {
            Image(systemName: icon).font(.system(size: 18)).foregroundStyle(tint)
            Text("\(value)").font(.system(size: 24, weight: .heavy)).foregroundStyle(Palette.text)
            Text(label).gType(.caption)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, Spacing.lg)
        .background(Palette.card, in: RoundedRectangle(cornerRadius: Radius.xl, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: Radius.xl, style: .continuous).stroke(Palette.border, lineWidth: 1))
    }
}
