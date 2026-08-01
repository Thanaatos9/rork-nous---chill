import SwiftUI

struct MembersView: View {
    @Environment(SpaceStore.self) private var store
    @Environment(AppState.self) private var app
    @Environment(ToastCenter.self) private var toasts
    @Environment(\.dismiss) private var dismiss

    @State private var memberToRemove: SpaceMember?

    var body: some View {
        ZStack {
            ScreenBackground()
            ScrollView(showsIndicators: false) {
                VStack(alignment: .leading, spacing: Spacing.md) {
                    HStack(spacing: Spacing.md) {
                        IconButton(systemIcon: "chevron.left", size: 40) { dismiss() }
                        VStack(alignment: .leading, spacing: 2) {
                            Text("Membres").gType(.title)
                            Text("\(store.members.count) personne\(store.members.count > 1 ? "s" : "") dans l'aventure").gType(.caption)
                        }
                        Spacer()
                    }
                    .padding(.bottom, Spacing.xs)

                    if store.isOwner {
                        SpaceInviteCard(spaceId: store.spaceId, spaceName: store.space?.name ?? "notre espace")
                            .padding(.bottom, Spacing.md)
                    }

                    if store.loadingMembers && store.members.isEmpty {
                        Loader(label: "Chargement des membres…").frame(height: 200)
                    } else {
                        ForEach(Array(store.members.enumerated()), id: \.element.id) { i, member in
                            memberCard(member, index: i)
                        }
                    }
                }
                .padding(.horizontal, Spacing.lg)
                .padding(.top, Spacing.sm)
                .padding(.bottom, Spacing.xxxl)
            }
            .safeAreaPadding(.top, 50)
            .refreshable {
                await store.reloadMembers()
            }
        }
        .alert("Retirer ce membre ?", isPresented: Binding(get: { memberToRemove != nil }, set: { if !$0 { memberToRemove = nil } })) {
            Button("Annuler", role: .cancel) { memberToRemove = nil }
            Button("Retirer", role: .destructive) {
                if let m = memberToRemove { remove(m) }
                memberToRemove = nil
            }
        } message: {
            Text("\(memberToRemove?.profile?.name ?? "Ce membre") n'aura plus accès à cet espace.")
        }
    }

    // MARK: - Member card

    private func memberCard(_ member: SpaceMember, index: Int) -> some View {
        let isMe = member.userId == app.userId
        let memberIsOwner = member.role == .owner
        let participating = Permissions.canParticipate(member)
        let showControls = store.isOwner && !memberIsOwner

        return GatherCard {
            VStack(spacing: showControls ? Spacing.md : 0) {
                HStack(spacing: Spacing.md) {
                    AvatarView(profile: member.profile, size: 44)
                    VStack(alignment: .leading, spacing: 4) {
                        HStack(spacing: 6) {
                            Text(member.profile?.name ?? "Membre").gType(.h3).lineLimit(1)
                            if isMe { Text("· toi").gType(.caption).foregroundStyle(Palette.primary) }
                        }
                        RoleBadge(role: Permissions.effectiveRole(member))
                    }
                    Spacer(minLength: 0)
                    if showControls {
                        Button { memberToRemove = member } label: {
                            Image(systemName: "trash").font(.system(size: 17)).foregroundStyle(Palette.textFaint)
                        }
                        .buttonStyle(.plain)
                    }
                }
                if showControls {
                    Divider2()
                    HStack {
                        VStack(alignment: .leading, spacing: 2) {
                            Text("Peut participer").font(.system(size: 14, weight: .semibold)).foregroundStyle(Palette.text)
                            Text("Créer des épisodes, écrire des reviews").gType(.caption)
                        }
                        Spacer()
                        Toggle("", isOn: Binding(
                            get: { participating },
                            set: { _ in togglePromotion(member, participating: participating) }
                        ))
                        .labelsHidden()
                        .tint(Palette.primary)
                    }
                }
            }
        }
        .floatIn(delay: Double(index) * 0.04)
    }

    // MARK: - Actions

    private func togglePromotion(_ member: SpaceMember, participating: Bool) {
        Task {
            do {
                try await MemberService.setParticipation(spaceId: store.spaceId, userId: member.userId, canParticipate: !participating)
                await store.reloadMembers()
            } catch {
                toasts.error(FriendlyError.message(error))
            }
        }
    }

    private func remove(_ member: SpaceMember) {
        Task {
            do {
                try await MemberService.removeMember(spaceId: store.spaceId, userId: member.userId)
                await store.reloadMembers()
            } catch {
                toasts.error(FriendlyError.message(error))
            }
        }
    }
}

/// The space's single invite code: one address to share with everyone, rather
/// than one ticket per person. Regenerating it invalidates the previous code.
private struct SpaceInviteCard: View {
    var spaceId: String
    var spaceName: String

    @Environment(AppState.self) private var app
    @Environment(ToastCenter.self) private var toasts

    @State private var invite: InviteCode?
    @State private var loading = true
    @State private var working = false
    @State private var confirmRegenerate = false

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.md) {
            SectionHeader("Code de l'espace")
            GatherCard(elevated: true, glow: true) {
                VStack(spacing: Spacing.md) {
                    VStack(spacing: Spacing.sm) {
                        if let code = invite?.code {
                            Text(code)
                                .font(.system(size: 34, weight: .heavy))
                                .tracking(6)
                                .foregroundStyle(Palette.text)
                        } else {
                            Group {
                                if loading || working {
                                    ProgressView().tint(Palette.primary)
                                } else {
                                    Text("Code indisponible").gType(.bodyMuted)
                                }
                            }
                            .frame(height: 42)
                        }
                        Text("Un seul code pour tout l'espace. Chaque personne qui l'utilise rejoint en observateur — tu l'autorises ensuite à participer ci-dessous.")
                            .gType(.bodyMuted)
                            .multilineTextAlignment(.center)
                            .frame(maxWidth: 300)
                    }
                    .frame(maxWidth: .infinity)

                    HStack(spacing: Spacing.md) {
                        GatherButton("Copier", systemIcon: "doc.on.doc", variant: .secondary,
                                     disabled: invite == nil, fullWidth: true) {
                            guard let code = invite?.code else { return }
                            UIPasteboard.general.string = code
                            toasts.success("Code copié")
                        }
                        if let code = invite?.code {
                            ShareLink(item: "Rejoins « \(spaceName) » sur Gather 🎬\nCode : \(code)") {
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

                    Divider2()

                    HStack {
                        Text(usageText).gType(.caption)
                        Spacer()
                        Button { confirmRegenerate = true } label: {
                            HStack(spacing: 6) {
                                Image(systemName: "arrow.triangle.2.circlepath").font(.system(size: 14))
                                Text("Régénérer").font(.system(size: 13, weight: .bold))
                            }
                            .foregroundStyle(Palette.textMuted)
                        }
                        .buttonStyle(.plain)
                        .disabled(working)
                    }
                }
            }
        }
        .task { await load() }
        .alert("Régénérer le code ?", isPresented: $confirmRegenerate) {
            Button("Annuler", role: .cancel) {}
            Button("Régénérer", role: .destructive) { regenerate() }
        } message: {
            Text("L'ancien code cessera immédiatement de fonctionner. Les membres déjà présents gardent leur accès.")
        }
    }

    private var usageText: String {
        guard let invite else { return " " }
        return "\(invite.uses) arrivée\(invite.uses > 1 ? "s" : "") via ce code"
    }

    private func load() async {
        guard let uid = app.userId else { loading = false; return }
        invite = try? await MemberService.spaceInviteCode(spaceId: spaceId, userId: uid)
        loading = false
    }

    private func regenerate() {
        guard let uid = app.userId else { return }
        working = true
        Task {
            do {
                invite = try await MemberService.regenerateInviteCode(spaceId: spaceId, userId: uid)
                toasts.success("Nouveau code généré")
            } catch {
                toasts.error(FriendlyError.message(error))
            }
            working = false
        }
    }
}
