import Foundation
import Supabase

@MainActor
enum MemberService {
    private static let codeAlphabet = Array("ABCDEFGHJKLMNPQRSTUVWXYZ23456789")

    private static func generateCode(length: Int = 7) -> String {
        String((0..<length).map { _ in codeAlphabet.randomElement()! })
    }

    static func members(spaceId: String) async throws -> [SpaceMember] {
        var members: [SpaceMember] = try await supabase
            .from("space_members")
            .select()
            .eq("space_id", value: spaceId)
            .order("joined_at", ascending: true)
            .execute()
            .value

        let profiles = try await ProfileService.profilesMap(members.map { $0.userId })
        for i in members.indices { members[i].profile = profiles[members[i].userId] }

        let rank: [MemberRole: Int] = [.owner: 0, .member: 1, .observer: 2]
        return members.sorted { (rank[$0.role] ?? 3) < (rank[$1.role] ?? 3) }
    }

    static func setParticipation(spaceId: String, userId: String, canParticipate: Bool) async throws {
        let patch: [String: AnyJSON] = canParticipate
            ? ["role": .string("member"), "can_create_episodes": .bool(true)]
            : ["can_create_episodes": .bool(false)]
        try await updateMember(spaceId: spaceId, userId: userId, patch: patch)
    }

    static func updateMember(spaceId: String, userId: String, patch: [String: AnyJSON]) async throws {
        try await supabase
            .from("space_members")
            .update(patch)
            .eq("space_id", value: spaceId)
            .eq("user_id", value: userId)
            .execute()
    }

    static func removeMember(spaceId: String, userId: String) async throws {
        try await supabase
            .from("space_members")
            .delete()
            .eq("space_id", value: spaceId)
            .eq("user_id", value: userId)
            .execute()
    }

    // MARK: - Space invite code

    /// A space has exactly ONE permanent invite code — the address of the space
    /// rather than a ticket handed to a specific person. It never expires and has
    /// no usage limit; anyone holding it joins as an observer. Mirrors lib/invites.ts.
    static func spaceInviteCode(spaceId: String, userId: String) async throws -> InviteCode {
        if let existing = try await readInviteCode(spaceId: spaceId) { return existing }
        return try await insertInviteCode(spaceId: spaceId, userId: userId)
    }

    /// Replaces the space's code with a fresh one. Existing members keep their
    /// access — only the old code stops working.
    static func regenerateInviteCode(spaceId: String, userId: String) async throws -> InviteCode {
        try await supabase.from("invite_codes").delete().eq("space_id", value: spaceId).execute()
        return try await insertInviteCode(spaceId: spaceId, userId: userId)
    }

    /// Reads the space's code, tolerating legacy spaces that still hold several rows.
    private static func readInviteCode(spaceId: String) async throws -> InviteCode? {
        let rows: [InviteCode] = try await supabase
            .from("invite_codes")
            .select()
            .eq("space_id", value: spaceId)
            .order("created_at", ascending: true)
            .limit(1)
            .execute()
            .value
        return rows.first
    }

    private static func insertInviteCode(spaceId: String, userId: String) async throws -> InviteCode {
        // The historical per-person columns are kept for schema compatibility but
        // always written as observer / unlimited / never.
        for _ in 0..<3 {
            do {
                let payload: [String: AnyJSON] = [
                    "code": .string(generateCode()),
                    "space_id": .string(spaceId),
                    "role": .string(MemberRole.observer.rawValue),
                    "max_uses": .null,
                    "use_count": .integer(0),
                    "expires_at": .null,
                    "created_by": .string(userId),
                ]
                return try await supabase
                    .from("invite_codes")
                    .insert(payload)
                    .select()
                    .single()
                    .execute()
                    .value
            } catch {
                let msg = String(describing: error).lowercased()
                guard msg.contains("duplicate") || msg.contains("already exists")
                    || msg.contains("conflict") || msg.contains("23505") else { throw error }

                // Either the random code collided, or another device just created
                // the space code. Re-read before burning another attempt.
                if let existing = try await readInviteCode(spaceId: spaceId) { return existing }
            }
        }
        throw GatherError.message("Impossible de générer le code de l'espace. Réessaie.")
    }
}
