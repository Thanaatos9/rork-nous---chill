import Foundation

/// Domain models mirroring the existing Gather Supabase schema.
/// All decoded off the main actor, so every type is `nonisolated`.
/// The PostgREST decoder is configured with `.convertFromSnakeCase`,
/// so properties are camelCase even though columns are snake_case.

nonisolated enum MemberRole: String, Codable, Sendable, Hashable {
    case owner, member, observer
}

nonisolated struct Profile: Codable, Identifiable, Hashable, Sendable {
    let id: String
    var name: String?
    var avatarUrl: String?
    var bio: String?
    var createdAt: String?
    var updatedAt: String?
}

nonisolated struct Space: Codable, Identifiable, Hashable, Sendable {
    let id: String
    var name: String
    var description: String?
    var coverUrl: String?
    var createdBy: String?
    var seasonStart: String?
    var seasonEnd: String?
    var seasonUnlocked: Bool?
    var createdAt: String?

    var unlocked: Bool { seasonUnlocked ?? false }
}

nonisolated struct SpaceMember: Codable, Identifiable, Hashable, Sendable {
    var spaceId: String?
    var userId: String
    var role: MemberRole
    var canCreateEpisodes: Bool
    var joinedAt: String?
    var profile: Profile?

    var id: String { userId }
}

/// The single permanent invite code of a space (one row per space). Anyone with
/// the code joins as an observer; regenerating it invalidates the previous one.
nonisolated struct InviteCode: Codable, Identifiable, Hashable, Sendable {
    let id: String
    var code: String
    var spaceId: String?
    var useCount: Int?
    var createdBy: String?
    var createdAt: String?

    var uses: Int { useCount ?? 0 }
}

/// Decodes a value that may arrive as a number or a numeric string (episode duration).
nonisolated enum FlexibleNumber: Codable, Hashable, Sendable {
    case number(Double)
    case text(String)

    init(from decoder: Decoder) throws {
        let c = try decoder.singleValueContainer()
        if let d = try? c.decode(Double.self) {
            self = .number(d)
        } else if let s = try? c.decode(String.self) {
            self = .text(s)
        } else {
            self = .text("")
        }
    }

    func encode(to encoder: Encoder) throws {
        var c = encoder.singleValueContainer()
        switch self {
        case .number(let d): try c.encode(d)
        case .text(let s): try c.encode(s)
        }
    }
}

/// Decodes tags whether they arrive as an array or a stringified list.
nonisolated struct TagList: Codable, Hashable, Sendable {
    let values: [String]

    init(values: [String]) { self.values = values }

    init(from decoder: Decoder) throws {
        let c = try decoder.singleValueContainer()
        if let arr = try? c.decode([String].self) {
            values = arr.map { $0.trimmingCharacters(in: .whitespaces) }.filter { !$0.isEmpty }
        } else if let s = try? c.decode(String.self) {
            values = TagList.parse(s)
        } else {
            values = []
        }
    }

    func encode(to encoder: Encoder) throws {
        var c = encoder.singleValueContainer()
        try c.encode(values)
    }

    static func parse(_ raw: String) -> [String] {
        let s = raw.trimmingCharacters(in: .whitespaces)
        if s.hasPrefix("[") {
            if let data = s.data(using: .utf8), let arr = try? JSONDecoder().decode([String].self, from: data) {
                return arr.filter { !$0.isEmpty }
            }
            return []
        }
        return s.split(separator: ",").map { $0.trimmingCharacters(in: .whitespaces) }.filter { !$0.isEmpty }
    }
}

nonisolated struct EpisodeMedia: Codable, Identifiable, Hashable, Sendable {
    let id: String
    var episodeId: String?
    var url: String
    var type: String?
    var createdAt: String?

    var isVideo: Bool { type == "video" }
}

nonisolated struct Episode: Codable, Identifiable, Hashable, Sendable {
    let id: String
    var spaceId: String
    var title: String
    var date: String?
    var place: String?
    var duration: FlexibleNumber?
    var tags: TagList?
    var coverUrl: String?
    var createdBy: String?
    var createdAt: String?
    var updatedAt: String?
    var episodeMedia: [EpisodeMedia]?

    var media: [EpisodeMedia] { episodeMedia ?? [] }
    var mediaCount: Int { media.count }
    var hasVideo: Bool { media.contains { $0.isVideo } }

    /// First image, else first media, else nil.
    var cover: String? {
        if let coverUrl, !coverUrl.isEmpty { return coverUrl }
        if let img = media.first(where: { !$0.isVideo }) { return img.url }
        return media.first?.url
    }
}

nonisolated struct Review: Codable, Identifiable, Hashable, Sendable {
    let id: String
    var episodeId: String
    var authorId: String
    var spaceId: String?
    var rating: Int?
    var favoriteMoment: String?
    var awkwardMoment: String?
    var funnyQuote: String?
    var summary: String?
    var song: String?
    var createdAt: String?
    var updatedAt: String?
    var profile: Profile?
}

nonisolated struct CommentReaction: Codable, Hashable, Sendable {
    var commentId: String
    var userId: String
    var emoji: String
    var createdAt: String?
}

nonisolated struct EpisodeComment: Codable, Identifiable, Hashable, Sendable {
    let id: String
    var episodeId: String
    var authorId: String
    var body: String
    var createdAt: String?
    var profile: Profile?
    var reactions: [CommentReaction]?
}

nonisolated struct IdeaVote: Codable, Hashable, Sendable {
    var ideaId: String
    var userId: String
}

nonisolated struct Idea: Codable, Identifiable, Hashable, Sendable {
    let id: String
    var spaceId: String?
    var title: String
    var description: String?
    var status: String?
    var proposedBy: String?
    var createdAt: String?
    var profile: Profile?
    var voteCount: Int = 0
    var voted: Bool = false

    private enum CodingKeys: String, CodingKey {
        case id, spaceId, title, description, status, proposedBy, createdAt
    }
}

nonisolated struct AppNotification: Codable, Identifiable, Hashable, Sendable {
    let id: String
    var userId: String?
    var spaceId: String?
    var title: String?
    var body: String?
    var url: String?
    var readAt: String?
    var createdAt: String?

    var isUnread: Bool { (readAt ?? "").isEmpty }
}

nonisolated struct Synthese: Codable, Identifiable, Hashable, Sendable {
    let id: String
    var spaceId: String?
    var videoUrl: String?
    var content: String?
    var summary: String?
    var createdAt: String?
}

// MARK: - Composite view models

nonisolated struct SpaceWithMembership: Identifiable, Hashable, Sendable {
    var space: Space
    var membership: SpaceMember
    var id: String { space.id }
}

nonisolated struct SpaceDetail: Hashable, Sendable {
    var space: Space
    var membership: SpaceMember?
}

nonisolated struct JoinResult: Sendable {
    var spaceId: String
    var alreadyMember: Bool
}

nonisolated struct EpisodeLikeState: Sendable {
    var count: Int
    var liked: Bool
}
