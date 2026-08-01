import Foundation
import Supabase

@MainActor
enum SpaceService {
    private nonisolated struct MembershipRow: Decodable, Sendable {
        var role: MemberRole
        var canCreateEpisodes: Bool
        var joinedAt: String?
        var spaceId: String?
        var userId: String?
        var spaces: Space?
    }

    static func mySpaces(userId: String) async throws -> [SpaceWithMembership] {
        let rows: [MembershipRow] = try await supabase
            .from("space_members")
            .select("role, can_create_episodes, joined_at, space_id, user_id, spaces(*)")
            .eq("user_id", value: userId)
            .execute()
            .value

        return rows.compactMap { row -> SpaceWithMembership? in
            guard let space = row.spaces else { return nil }
            let membership = SpaceMember(
                spaceId: row.spaceId,
                userId: row.userId ?? userId,
                role: row.role,
                canCreateEpisodes: row.canCreateEpisodes,
                joinedAt: row.joinedAt,
                profile: nil
            )
            return SpaceWithMembership(space: space, membership: membership)
        }
        .sorted { ($0.space.createdAt ?? "") > ($1.space.createdAt ?? "") }
    }

    static func space(id: String, userId: String) async throws -> SpaceDetail {
        let space: Space = try await supabase
            .from("spaces")
            .select()
            .eq("id", value: id)
            .single()
            .execute()
            .value

        let memberships: [SpaceMember] = try await supabase
            .from("space_members")
            .select()
            .eq("space_id", value: id)
            .eq("user_id", value: userId)
            .limit(1)
            .execute()
            .value

        return SpaceDetail(space: space, membership: memberships.first)
    }

    struct CreateSpaceResult {
        var space: Space
        /// Nil only if the code could not be generated — the space itself is fine.
        var inviteCode: InviteCode?
    }

    static func createSpace(
        userId: String,
        name: String,
        description: String,
        coverUrl: String?,
        seasonStart: String?,
        seasonEnd: String?
    ) async throws -> CreateSpaceResult {
        let payload: [String: AnyJSON] = [
            "name": .string(name.trimmed),
            "description": description.trimmed.isEmpty ? .null : .string(description.trimmed),
            "cover_url": coverUrl.map { AnyJSON.string($0) } ?? .null,
            "created_by": .string(userId),
            "season_start": seasonStart.map { AnyJSON.string($0) } ?? .null,
            "season_end": seasonEnd.map { AnyJSON.string($0) } ?? .null,
            "season_unlocked": .bool(false),
        ]
        let space: Space = try await supabase
            .from("spaces")
            .insert(payload)
            .select()
            .single()
            .execute()
            .value

        // Ensure creator is registered as owner (a DB trigger may already do this).
        do {
            try await supabase.from("space_members").insert([
                "space_id": AnyJSON.string(space.id),
                "user_id": .string(userId),
                "role": .string("owner"),
                "can_create_episodes": .bool(true),
            ]).execute()
        } catch {
            let msg = String(describing: error).lowercased()
            if !(msg.contains("duplicate") || msg.contains("already exists") || msg.contains("conflict")) {
                throw error
            }
        }

        // Every space owns one permanent invite code from birth. Best-effort:
        // the members screen creates it later if this failed.
        let inviteCode = try? await MemberService.spaceInviteCode(spaceId: space.id, userId: userId)
        return CreateSpaceResult(space: space, inviteCode: inviteCode)
    }

    static func joinSpace(rawCode: String, userId: String) async throws -> JoinResult {
        let code = rawCode.trimmed.uppercased()
        guard !code.isEmpty else { throw GatherError.message("Saisis un code d'invitation.") }

        // One code per space: a valid code resolves to exactly one space.
        let invites: [InviteCode] = try await supabase
            .from("invite_codes")
            .select()
            .eq("code", value: code)
            .limit(1)
            .execute()
            .value
        guard let invite = invites.first, let spaceId = invite.spaceId else {
            throw GatherError.message("Code d'invitation invalide. Vérifie-le auprès du propriétaire de l'espace.")
        }

        let existing: [SpaceMember] = try await supabase
            .from("space_members")
            .select("space_id, user_id, role, can_create_episodes, joined_at")
            .eq("space_id", value: spaceId)
            .eq("user_id", value: userId)
            .limit(1)
            .execute()
            .value
        if !existing.isEmpty {
            return JoinResult(spaceId: spaceId, alreadyMember: true)
        }

        // Everyone enters as an observer; the owner promotes from the members screen.
        try await supabase.from("space_members").insert([
            "space_id": AnyJSON.string(spaceId),
            "user_id": .string(userId),
            "role": .string(MemberRole.observer.rawValue),
            "can_create_episodes": .bool(false),
        ]).execute()

        // Best-effort usage counter (RLS may restrict this to the owner).
        try? await supabase
            .from("invite_codes")
            .update(["use_count": AnyJSON.integer(invite.uses + 1)])
            .eq("id", value: invite.id)
            .execute()

        return JoinResult(spaceId: spaceId, alreadyMember: false)
    }

    static func unlockSeason(id: String) async throws {
        _ = try await updateSpace(id: id, patch: ["season_unlocked": .bool(true)])
    }

    static func updateDetails(
        id: String,
        name: String,
        description: String,
        coverUrl: String?,
        seasonStart: String,
        seasonEnd: String
    ) async throws {
        _ = try await updateSpace(id: id, patch: [
            "name": .string(name.trimmed),
            "description": description.trimmed.isEmpty ? .null : .string(description.trimmed),
            "cover_url": coverUrl.map { AnyJSON.string($0) } ?? .null,
            "season_start": .string(seasonStart),
            "season_end": .string(seasonEnd),
        ])
    }

    /// Sets only the cover URL. Kept here so views don't need the Supabase JSON types.
    static func updateCover(id: String, coverUrl: String) async throws -> Space {
        try await updateSpace(id: id, patch: ["cover_url": .string(coverUrl)])
    }

    static func updateSpace(id: String, patch: [String: AnyJSON]) async throws -> Space {
        try await supabase
            .from("spaces")
            .update(patch)
            .eq("id", value: id)
            .select()
            .single()
            .execute()
            .value
    }

    static func deleteSpace(id: String) async throws {
        try await supabase.from("spaces").delete().eq("id", value: id).execute()
    }
}

nonisolated enum GatherError: LocalizedError {
    case message(String)
    var errorDescription: String? {
        switch self {
        case .message(let m): return m
        }
    }
}
