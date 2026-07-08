import SwiftUI

struct MembersView: View {
    @Environment(SpaceStore.self) private var store
    @Environment(AppState.self) private var app
    @Environment(ToastCenter.self) private var toasts
    @Environment(\.dismiss) private var dismiss

    @State private var invites: [InviteCode] = []
    @State private var composingInvite = false
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

                    if store.loadingMembers && store.members.isEmpty {
                        Loader(label: "Chargement des membres…").frame(height: 200)
                    } else {
                        ForEach(Array(store.members.enumerated()), id: \.element.id) { i, member in
                            memberCard(member, index: i)
                        }
                    }

                    if store.isOwner {
                        invitesSection.padding(.top, Spacing.xl)
                    }
                }
                .padding(.horizontal, Spacing.lg)
                .padding(.top, Spacing.sm)
                .padding(.bottom, Spacing.xxxl)
            }
            .safeAreaPadding(.top, 50)
            .refreshable {
                await store.reloadMembers()
                await loadInvites()
            }
        }
        .task(id: store.isOwner) { if store.isOwner { await loadInvites() } }
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

    // MARK: - Invites

    private var invitesSection: some View {
        VStack(alignment: .leading, spacing: Spacing.md) {
            SectionHeader("Codes d'invitation") {
                Button { withAnimation { composingInvite.toggle() } } label: {
                    Text(composingInvite ? "Fermer" : "Nouveau").font(.system(size: 13, weight: .bold)).foregroundStyle(Palette.primary)
                }
                .buttonStyle(.plain)
            }

            if composingInvite {
                InviteComposer(spaceId: store.spaceId) {
                    composingInvite = false
                    await loadInvites()
                }
                .floatIn()
            }

            if invites.isEmpty && !composingInvite {
                GatherCard {
                    VStack(spacing: 6) {
                        Image(systemName: "ticket").font(.system(size: 22)).foregroundStyle(Palette.textMuted)
                        Text("Crée un code pour inviter de nouvelles personnes.").gType(.bodyMuted).multilineTextAlignment(.center)
                    }
                    .frame(maxWidth: .infinity)
                }
            } else {
                ForEach(invites) { invite in
                    InviteRow(invite: invite) { await loadInvites() }
                }
            }
        }
    }

    // MARK: - Actions

    private func loadInvites() async {
        invites = (try? await MemberService.inviteCodes(spaceId: store.spaceId)) ?? []
    }

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

private struct InviteComposer: View {
    var spaceId: String
    var onCreated: () async -> Void

    @Environment(AppState.self) private var app
    @Environment(ToastCenter.self) private var toasts

    @State private var role: MemberRole = .member
    @State private var maxUses = ""
    @State private var hasExpiry = false
    @State private var expiry = Calendar.current.date(byAdding: .month, value: 1, to: Date()) ?? Date()
    @State private var saving = false

    var body: some View {
        GatherCard(elevated: true) {
            VStack(spacing: Spacing.md) {
                Field(label: "Rôle attribué") {
                    HStack(spacing: Spacing.sm) {
                        roleButton(.member, "Membre")
                        roleButton(.observer, "Observateur")
                    }
                }
                HStack(spacing: Spacing.md) {
                    Field(label: "Usages max") {
                        GatherTextField(placeholder: "Illimité", text: $maxUses, keyboard: .numberPad)
                    }
                    Field(label: "Expiration") {
                        VStack(spacing: 6) {
                            Toggle("Expire", isOn: $hasExpiry).tint(Palette.primary).font(.system(size: 13, weight: .semibold))
                            if hasExpiry {
                                DatePickerChip(date: $expiry, range: Date()...)
                            }
                        }
                    }
                }
                GatherButton("Générer le code", systemIcon: "plus", loading: saving, fullWidth: true, action: create)
            }
        }
    }

    private func roleButton(_ r: MemberRole, _ label: String) -> some View {
        Button { role = r } label: {
            Text(label)
                .font(.system(size: 14, weight: .bold))
                .foregroundStyle(role == r ? .white : Palette.textMuted)
                .frame(maxWidth: .infinity)
                .padding(.vertical, 11)
                .background(role == r ? Palette.primary : Palette.surface, in: RoundedRectangle(cornerRadius: Radius.md, style: .continuous))
        }
        .buttonStyle(PressableStyle(scale: 0.97, haptic: false))
    }

    private func create() {
        guard let uid = app.userId else { return }
        saving = true
        Task {
            do {
                let max = Int(maxUses.filter { $0.isNumber })
                _ = try await MemberService.createInvite(
                    spaceId: spaceId, userId: uid, role: role,
                    maxUses: (maxUses.isEmpty ? nil : max),
                    expiresAt: hasExpiry ? ISO8601DateFormatter().string(from: expiry) : nil
                )
                toasts.success("Code créé")
                await onCreated()
            } catch {
                toasts.error(FriendlyError.message(error))
            }
            saving = false
        }
    }
}

private struct InviteRow: View {
    var invite: InviteCode
    var onChange: () async -> Void

    @Environment(ToastCenter.self) private var toasts
    @State private var confirmRevoke = false

    var body: some View {
        GatherCard {
            VStack(spacing: Spacing.md) {
                HStack(alignment: .top) {
                    VStack(alignment: .leading, spacing: 4) {
                        Text(invite.code).font(.system(size: 22, weight: .heavy)).tracking(4).foregroundStyle(Palette.text)
                        HStack(spacing: 6) {
                            BadgeView(invite.role == .member ? "Membre" : "Observateur", tone: invite.role == .member ? .primary : .muted)
                            if invite.isExpired || invite.isExhausted {
                                BadgeView(invite.isExpired ? "Expiré" : "Épuisé", tone: .destructive)
                            }
                        }
                    }
                    Spacer()
                    Button { confirmRevoke = true } label: {
                        Image(systemName: "trash").font(.system(size: 17)).foregroundStyle(Palette.textFaint)
                    }
                    .buttonStyle(.plain)
                }
                HStack {
                    Text(usageText).gType(.caption)
                    Spacer()
                    HStack(spacing: Spacing.sm) {
                        IconButton(systemIcon: "doc.on.doc", variant: .secondary, size: 38) {
                            UIPasteboard.general.string = invite.code
                            toasts.success("Code copié")
                        }
                        ShareLink(item: "Rejoins notre espace sur Gather 🎬\nCode : \(invite.code)") {
                            Image(systemName: "square.and.arrow.up").font(.system(size: 16, weight: .semibold))
                                .foregroundStyle(.white).frame(width: 38, height: 38)
                                .background(Palette.primary, in: Circle())
                        }
                    }
                }
            }
        }
        .alert("Révoquer ce code ?", isPresented: $confirmRevoke) {
            Button("Annuler", role: .cancel) {}
            Button("Révoquer", role: .destructive) {
                Task {
                    do { try await MemberService.revokeInvite(id: invite.id); await onChange() }
                    catch { toasts.error(FriendlyError.message(error)) }
                }
            }
        } message: {
            Text("Il ne pourra plus être utilisé.")
        }
    }

    private var usageText: String {
        var s = "\(invite.uses) utilisation\(invite.uses > 1 ? "s" : "")"
        if let max = invite.maxUses { s += " / \(max)" }
        if let exp = invite.expiresAt { s += " · exp. \(DateParse.formatDate(exp))" }
        return s
    }
}
