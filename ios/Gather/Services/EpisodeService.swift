import Foundation
import Supabase

@MainActor
enum EpisodeService {
    private nonisolated struct UserIdRow: Decodable, Sendable { var userId: String }

    private static let mediaSelect = "*, episode_media(id, episode_id, url, type, created_at)"

    static func episodes(spaceId: String) async throws -> [Episode] {
        try await supabase
            .from("episodes")
            .select(mediaSelect)
            .eq("space_id", value: spaceId)
            .order("date", ascending: false, nullsFirst: false)
            .order("created_at", ascending: false)
            .execute()
            .value
    }

    static func episode(id: String) async throws -> Episode {
        try await supabase
            .from("episodes")
            .select(mediaSelect)
            .eq("id", value: id)
            .single()
            .execute()
            .value
    }

    static func createEpisode(
        spaceId: String,
        userId: String,
        title: String,
        date: String?,
        place: String,
        duration: Int?,
        tags: [String],
        uploaded: [(url: String, type: String)]
    ) async throws -> Episode {
        let coverUrl = uploaded.first(where: { $0.type == "image" })?.url
        let payload: [String: AnyJSON] = [
            "space_id": .string(spaceId),
            "title": .string(title.trimmed),
            "date": date.map { AnyJSON.string($0) } ?? .null,
            "place": place.trimmed.isEmpty ? .null : .string(place.trimmed),
            "duration": duration.map { AnyJSON.integer($0) } ?? .null,
            "tags": tags.isEmpty ? .null : .array(tags.map { AnyJSON.string($0) }),
            "cover_url": coverUrl.map { AnyJSON.string($0) } ?? .null,
            "created_by": .string(userId),
        ]
        let episode: Episode = try await supabase
            .from("episodes")
            .insert(payload)
            .select()
            .single()
            .execute()
            .value

        if !uploaded.isEmpty {
            let rows = uploaded.map { item in
                AnyJSON.object([
                    "episode_id": .string(episode.id),
                    "url": .string(item.url),
                    "type": .string(item.type),
                ])
            }
            try await supabase.from("episode_media").insert(AnyJSON.array(rows)).execute()
        }
        return episode
    }

    static func setCover(episodeId: String, url: String) async throws {
        try await supabase
            .from("episodes")
            .update(["cover_url": AnyJSON.string(url)])
            .eq("id", value: episodeId)
            .execute()
    }

    static func deleteEpisode(id: String) async throws {
        try await supabase.from("episodes").delete().eq("id", value: id).execute()
    }

    static func addMedia(episodeId: String, uploaded: [(url: String, type: String)]) async throws {
        guard !uploaded.isEmpty else { return }
        let rows = uploaded.map { item in
            AnyJSON.object([
                "episode_id": .string(episodeId),
                "url": .string(item.url),
                "type": .string(item.type),
            ])
        }
        try await supabase.from("episode_media").insert(AnyJSON.array(rows)).execute()
    }

    static func likeState(episodeId: String, userId: String?) async throws -> EpisodeLikeState {
        let rows: [UserIdRow] = try await supabase
            .from("episode_likes")
            .select("user_id")
            .eq("episode_id", value: episodeId)
            .execute()
            .value
        let users = rows.map { $0.userId }
        return EpisodeLikeState(count: users.count, liked: userId.map { users.contains($0) } ?? false)
    }

    static func toggleLike(episodeId: String, userId: String, currentlyLiked: Bool) async throws {
        if currentlyLiked {
            try await supabase
                .from("episode_likes")
                .delete()
                .eq("episode_id", value: episodeId)
                .eq("user_id", value: userId)
                .execute()
        } else {
            try await supabase.from("episode_likes").insert([
                "episode_id": AnyJSON.string(episodeId),
                "user_id": .string(userId),
            ]).execute()
        }
    }
}
