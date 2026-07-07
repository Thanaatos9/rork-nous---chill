import Foundation
import Observation

@MainActor
@Observable
final class EpisodeDetailViewModel {
    let episodeId: String

    var episode: Episode?
    var spaceDetail: SpaceDetail?
    var members: [SpaceMember] = []
    var reviews: [Review] = []
    var myReview: Review?
    var comments: [EpisodeComment] = []
    var likeState = EpisodeLikeState(count: 0, liked: false)
    var isLoading = true

    init(episodeId: String) {
        self.episodeId = episodeId
    }

    var spaceId: String { episode?.spaceId ?? "" }
    var membership: SpaceMember? { spaceDetail?.membership }
    var canParticipate: Bool { Permissions.canParticipate(membership) }
    var isObserver: Bool { Permissions.effectiveRole(membership) == .observer }
    var unlocked: Bool { spaceDetail?.space.unlocked ?? false }

    /// Members able to write reviews (owner or promoted member).
    var reviewers: [SpaceMember] {
        members.filter { $0.role == .owner || ($0.role == .member && $0.canCreateEpisodes) }
    }

    var answeredIds: Set<String> { Set(reviews.map { $0.authorId }) }

    func load(userId: String?) async {
        guard let episode = try? await EpisodeService.episode(id: episodeId) else {
            isLoading = false
            return
        }
        self.episode = episode
        let sid = episode.spaceId

        async let space = try? await SpaceService.space(id: sid, userId: userId ?? "")
        async let members = (try? await MemberService.members(spaceId: sid)) ?? []
        async let reviews = (try? await ReviewService.reviews(episodeId: episodeId)) ?? []
        async let comments = (try? await SocialService.comments(episodeId: episodeId)) ?? []
        async let likes = (try? await EpisodeService.likeState(episodeId: episodeId, userId: userId)) ?? EpisodeLikeState(count: 0, liked: false)
        async let mine: Review? = {
            guard let uid = userId else { return nil }
            return try? await ReviewService.myReview(episodeId: episodeId, userId: uid)
        }()

        self.spaceDetail = await space
        self.members = await members
        self.reviews = await reviews
        self.comments = await comments
        self.likeState = await likes
        self.myReview = await mine
        self.isLoading = false
    }

    func reloadEpisode() async {
        if let e = try? await EpisodeService.episode(id: episodeId) { episode = e }
    }

    func reloadComments() async {
        comments = (try? await SocialService.comments(episodeId: episodeId)) ?? []
    }

    func reloadReviews(userId: String?) async {
        reviews = (try? await ReviewService.reviews(episodeId: episodeId)) ?? []
        if let uid = userId { myReview = try? await ReviewService.myReview(episodeId: episodeId, userId: uid) }
    }

    func toggleLike(userId: String) async {
        let liked = likeState.liked
        likeState = EpisodeLikeState(count: likeState.count + (liked ? -1 : 1), liked: !liked)
        try? await EpisodeService.toggleLike(episodeId: episodeId, userId: userId, currentlyLiked: liked)
        likeState = (try? await EpisodeService.likeState(episodeId: episodeId, userId: userId)) ?? likeState
    }

    func addMedia(_ media: [PickedMedia]) async throws {
        var uploaded: [(url: String, type: String)] = []
        for item in media {
            let url = try await StorageService.upload(
                kind: .episodes, spaceId: spaceId, userId: membership?.userId, episodeId: episodeId,
                data: item.data, contentType: item.contentType, ext: item.ext
            )
            uploaded.append((url, item.type))
        }
        try await EpisodeService.addMedia(episodeId: episodeId, uploaded: uploaded)
        await reloadEpisode()
    }

    func addComment(userId: String, body: String) async throws {
        try await SocialService.addComment(episodeId: episodeId, userId: userId, body: body)
        await reloadComments()
    }

    func deleteComment(id: String) async {
        try? await SocialService.deleteComment(id: id)
        await reloadComments()
    }

    func toggleReaction(commentId: String, userId: String, emoji: String, active: Bool) async {
        try? await SocialService.toggleReaction(commentId: commentId, userId: userId, emoji: emoji, active: active)
        await reloadComments()
    }
}
