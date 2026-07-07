import Foundation
import Supabase

@MainActor
enum StorageService {
    enum Kind: String {
        case covers
        case avatars
        case episodes
    }

    private struct Candidate {
        let template: String
        let folder: String
    }

    private static let templateCacheKey = "gather.media.upload-template.v1"

    /// Inline data-URL fallback is only used for small images (covers/avatars).
    private static let inlineFallbackMaxBytes = 900_000

    /// Ordered candidate folders for an upload. The storage security rules live
    /// in an external Supabase project we cannot inspect; empirical probing
    /// showed the policy matches the SECOND path segment (cast to uuid) against
    /// the user's space memberships. Every candidate therefore puts a uuid in
    /// position 2, with different prefixes in position 1 to cover the possible
    /// policy variants. The first template that succeeds is cached (UserDefaults)
    /// and tried first on the next upload. Mirrors expo/lib/media.ts.
    private static func candidates(kind: Kind, spaceId: String?, userId: String?, episodeId: String?) -> [Candidate] {
        guard let spaceId, !spaceId.isEmpty else { return [] }
        var list: [Candidate] = [Candidate(template: "kind-first", folder: "\(kind.rawValue)/\(spaceId)")]
        if let userId, !userId.isEmpty {
            list.append(Candidate(template: "user-first", folder: "\(userId)/\(spaceId)"))
        }
        if kind != .episodes {
            list.append(Candidate(template: "episodes-first", folder: "episodes/\(spaceId)"))
        }
        list.append(Candidate(template: "spaces-first", folder: "spaces/\(spaceId)"))
        if let episodeId, !episodeId.isEmpty {
            list.append(Candidate(template: "space-episode", folder: "\(spaceId)/\(episodeId)"))
        }
        list.append(Candidate(template: "space-kind", folder: "\(spaceId)/\(kind.rawValue)"))
        return list
    }

    /// True when the failure comes from the storage security rules, meaning
    /// another path format is worth trying. Network/size errors abort probing.
    private static func isPolicyRejection(_ error: Error) -> Bool {
        let msg = String(describing: error).lowercased()
        return msg.contains("row-level security") || msg.contains("invalid input syntax")
            || msg.contains("unauthorized") || msg.contains("violates")
            || msg.contains("policy") || msg.contains("uuid") || msg.contains("not allowed")
    }

    /// Uploads bytes to the episode-media bucket and returns a displayable URL.
    /// Tries every candidate path format (cached winner first); small images
    /// fall back to an inline data URL so covers and avatars keep working even
    /// if the storage rules refuse every path.
    static func upload(
        kind: Kind,
        spaceId: String?,
        userId: String?,
        episodeId: String? = nil,
        data: Data,
        contentType: String,
        ext: String
    ) async throws -> String {
        guard !data.isEmpty else { throw GatherError.message("Le fichier sélectionné est vide.") }

        var list = candidates(kind: kind, spaceId: spaceId, userId: userId, episodeId: episodeId)
        let cached = UserDefaults.standard.string(forKey: templateCacheKey)
        if let cached, let idx = list.firstIndex(where: { $0.template == cached }), idx > 0 {
            let hit = list.remove(at: idx)
            list.insert(hit, at: 0)
        }

        var lastError: Error?
        for candidate in list {
            do {
                let url = try await uploadBytes(folder: candidate.folder, data: data, contentType: contentType, ext: ext)
                print("[media] upload OK via template \"\(candidate.template)\" (\(candidate.folder))")
                if candidate.template != cached {
                    UserDefaults.standard.set(candidate.template, forKey: templateCacheKey)
                }
                return url
            } catch {
                print("[media] template \"\(candidate.template)\" (\(candidate.folder)) rejected: \(error)")
                lastError = error
                if !isPolicyRejection(error) { break }
            }
        }

        // Storage refused every path (or none was buildable). Small images are
        // stored inline as a data URL — renders in AsyncImage, RN and web alike.
        if kind != .episodes, contentType.hasPrefix("image/"), data.count <= inlineFallbackMaxBytes {
            print("[media] all storage paths refused — using inline image fallback")
            return "data:\(contentType);base64,\(data.base64EncodedString())"
        }

        print("[media] upload failed on every candidate: \(String(describing: lastError))")
        throw GatherError.message("Le stockage a refusé l'envoi du fichier. Réessaie — et si ça persiste, dis-le nous.")
    }

    private static func uploadBytes(folder: String, data: Data, contentType: String, ext: String) async throws -> String {
        let stamp = Int(Date().timeIntervalSince1970 * 1000)
        let random = String(UUID().uuidString.prefix(6)).lowercased()
        let path = "\(folder)/\(stamp)-\(random).\(ext)"

        _ = try await supabase.storage
            .from(SupabaseManager.mediaBucket)
            .upload(path, data: data, options: FileOptions(contentType: contentType, upsert: false))

        let url = try supabase.storage.from(SupabaseManager.mediaBucket).getPublicURL(path: path)
        return url.absoluteString
    }
}
