import SwiftUI

/// Welcome tutorial slide model.
private struct OnboardingSlide: Identifiable {
    enum Art { case brand, space, invite, episode, ideas }

    let id: String
    let overline: String
    let title: String
    let body: String
    let art: Art

    /// Gold-accented slides (invite & ideas), red for the rest.
    var isGold: Bool { art == .invite || art == .ideas }
}

private let slides: [OnboardingSlide] = [
    OnboardingSlide(
        id: "welcome",
        overline: "Bienvenue",
        title: "Bienvenue sur Gather",
        body: "Ici, vos moments partagés deviennent une série : des espaces, des épisodes, des souvenirs à revoir quand tu veux.",
        art: .brand
    ),
    OnboardingSlide(
        id: "space",
        overline: "Épisode 1",
        title: "Crée ton espace",
        body: "Un espace, c'est une aventure partagée — ton couple, ta bande d'amis ou ta famille. Chacune a sa propre couverture, comme une affiche de série.",
        art: .space
    ),
    OnboardingSlide(
        id: "invite",
        overline: "Épisode 2",
        title: "Invite tes proches",
        body: "Partage le code d'invitation et retrouvez-vous dans le même espace. Tout le monde fait partie du casting.",
        art: .invite
    ),
    OnboardingSlide(
        id: "episode",
        overline: "Épisode 3",
        title: "Capture tes épisodes",
        body: "Chaque sortie, dîner ou voyage devient un épisode : photos, vidéos et petites notes pour ne rien oublier.",
        art: .episode
    ),
    OnboardingSlide(
        id: "ideas",
        overline: "Épisode 4",
        title: "Idées et bilan de saison",
        body: "Propose des idées pour vos prochains épisodes, note vos souvenirs en étoiles et revivez votre bilan de saison.",
        art: .ideas
    ),
]

/// Full-screen welcome tutorial for new members.
/// Mirrors app/onboarding.tsx (5 slides, dots, skip, "C'est parti 🎬").
struct OnboardingView: View {
    @Environment(AppState.self) private var app
    @Environment(\.dismiss) private var dismiss

    @State private var page: Int = 0

    private var isLast: Bool { page == slides.count - 1 }

    var body: some View {
        ZStack(alignment: .top) {
            ScreenBackground()

            // Subtle top glow to give the screen depth.
            LinearGradient(
                colors: [Palette.primary.opacity(0.14), Palette.primary.opacity(0)],
                startPoint: .top,
                endPoint: .bottom
            )
            .frame(height: 320)
            .ignoresSafeArea(edges: .top)

            TabView(selection: $page) {
                ForEach(Array(slides.enumerated()), id: \.element.id) { index, slide in
                    SlideView(slide: slide, isCurrent: page == index)
                        .tag(index)
                        .padding(.bottom, 140)
                }
            }
            .tabViewStyle(.page(indexDisplayMode: .never))
            .onChange(of: page) { _, _ in
                Haptics.light()
            }

            // Skip
            if !isLast {
                HStack {
                    Spacer()
                    Button(action: finish) {
                        Text("Passer")
                            .font(.system(size: 13, weight: .bold))
                            .foregroundStyle(Palette.textMuted)
                            .padding(.horizontal, 14)
                            .padding(.vertical, 8)
                            .background(Palette.card, in: Capsule())
                            .overlay(Capsule().stroke(Palette.border, lineWidth: 1))
                    }
                    .buttonStyle(PressableStyle(scale: 0.94))
                }
                .padding(.horizontal, Spacing.lg)
                .padding(.top, Spacing.sm)
                .transition(.opacity)
            }
        }
        .overlay(alignment: .bottom) { bottomControls }
        .animation(.easeInOut(duration: 0.25), value: isLast)
    }

    // MARK: - Bottom controls

    private var bottomControls: some View {
        VStack(spacing: Spacing.xl) {
            HStack(spacing: 7) {
                ForEach(slides.indices, id: \.self) { index in
                    Capsule()
                        .fill(Palette.primary)
                        .frame(width: page == index ? 24 : 7, height: 7)
                        .opacity(page == index ? 1 : 0.35)
                }
            }
            .animation(.spring(response: 0.35, dampingFraction: 0.8), value: page)

            GatherButton(
                isLast ? "C'est parti 🎬" : "Suivant",
                iconTrailing: isLast ? nil : "arrow.right",
                size: .lg,
                fullWidth: true
            ) {
                goNext()
            }
        }
        .padding(.horizontal, Spacing.xl)
        .padding(.bottom, Spacing.xl)
    }

    // MARK: - Actions

    private func goNext() {
        if isLast {
            finish()
            return
        }
        withAnimation(.easeInOut(duration: 0.35)) { page += 1 }
    }

    private func finish() {
        if let uid = app.userId {
            OnboardingStore.markSeen(uid)
        }
        dismiss()
    }
}

// MARK: - Slide

private struct SlideView: View {
    let slide: OnboardingSlide
    let isCurrent: Bool

    var body: some View {
        VStack(spacing: 0) {
            SlideArt(art: slide.art)
                .scaleEffect(isCurrent ? 1 : 0.72)
                .opacity(isCurrent ? 1 : 0.25)
                .padding(.bottom, Spacing.xxxl + Spacing.md)

            VStack(spacing: Spacing.md) {
                Text(slide.overline)
                    .gType(.overline)
                    .foregroundStyle(slide.isGold ? Palette.accent : Palette.primary)
                    .padding(.horizontal, 12)
                    .padding(.vertical, 5)
                    .background(slide.isGold ? Palette.accentSoft : Palette.primarySoft, in: Capsule())

                Text(slide.title)
                    .gType(.title)
                    .multilineTextAlignment(.center)

                Text(slide.body)
                    .gType(.bodyMuted)
                    .multilineTextAlignment(.center)
                    .frame(maxWidth: 320)
            }
            .opacity(isCurrent ? 1 : 0)
            .offset(x: isCurrent ? 0 : 40)
        }
        .padding(.horizontal, Spacing.xxl)
        .animation(.spring(response: 0.5, dampingFraction: 0.85), value: isCurrent)
    }
}

// MARK: - Slide art

private struct SlideArt: View {
    let art: OnboardingSlide.Art

    var body: some View {
        if art == .brand {
            BrandMark(size: 116)
        } else {
            RoundedRectangle(cornerRadius: Radius.xxl, style: .continuous)
                .fill(
                    LinearGradient(
                        colors: [Palette.cardElevated, Palette.bgDeep],
                        startPoint: .topLeading,
                        endPoint: .bottomTrailing
                    )
                )
                .frame(width: 148, height: 148)
                .overlay(icon)
                .overlay(
                    RoundedRectangle(cornerRadius: Radius.xxl, style: .continuous)
                        .stroke(Palette.border, lineWidth: 1)
                )
                .posterShadow()
                .overlay(alignment: .bottom) { badge.offset(y: 16) }
        }
    }

    private var icon: some View {
        Group {
            switch art {
            case .space:
                Image(systemName: "movieclapper").foregroundStyle(Palette.primary)
            case .invite:
                Image(systemName: "ticket").foregroundStyle(Palette.accent)
            case .episode:
                Image(systemName: "camera").foregroundStyle(Palette.primary)
            case .ideas:
                Image(systemName: "lightbulb").foregroundStyle(Palette.accent)
            case .brand:
                EmptyView()
            }
        }
        .font(.system(size: 46, weight: .medium))
    }

    private var badge: some View {
        HStack(spacing: 6) {
            switch art {
            case .space:
                Image(systemName: "person.2.fill")
                    .font(.system(size: 14))
                    .foregroundStyle(Palette.text)
            case .invite:
                Text("CODE")
                    .font(.system(size: 13, weight: .heavy))
                    .tracking(1)
                    .foregroundStyle(Palette.text)
            case .episode:
                Text("S1 · E1")
                    .font(.system(size: 13, weight: .heavy))
                    .foregroundStyle(Palette.text)
            case .ideas:
                Image(systemName: "star.fill")
                    .font(.system(size: 14))
                    .foregroundStyle(Palette.accent)
            case .brand:
                EmptyView()
            }
        }
        .padding(.horizontal, 14)
        .frame(height: 32)
        .background(Palette.surface, in: Capsule())
        .overlay(Capsule().stroke(Palette.borderStrong, lineWidth: 1))
    }
}
