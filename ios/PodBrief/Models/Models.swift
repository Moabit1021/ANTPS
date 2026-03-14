import Foundation

// MARK: - User & Auth

struct UserProfile: Codable, Identifiable {
    let id: String
    let email: String
    let name: String?
    let role: String
    let inboxEmail: String?
    let inboxAlias: String?
    let hasApiToken: Bool
    let inboxDomain: String?
}

struct LoginResponse: Codable {
    let token: String
    let message: String?
}

struct TokenResponse: Codable {
    let token: String
    let message: String
}

// MARK: - Sources

struct Source: Codable, Identifiable {
    let id: String
    let type: String
    let title: String
    let senderEmail: String?
    let senderName: String?
    let receivedAt: String
    let status: String
    let createdAt: String
}

struct SourcesResponse: Codable {
    let sources: [Source]
    let total: Int
    let page: Int
    let limit: Int
}

// MARK: - Search

struct SearchResult: Codable, Identifiable {
    let sourceId: String
    let title: String
    let senderName: String?
    let receivedAt: String
    let similarity: Double
    let matchedChunk: String

    var id: String { sourceId }
}

struct SearchResponse: Codable {
    let query: String
    let results: [SearchResult]
    let count: Int
}

// MARK: - Scripts

struct PodcastScript: Codable, Identifiable {
    let id: String
    let title: String
    let content: String?
    let version: Int
    let status: String
    let createdAt: String
    let config: ScriptConfig?
}

struct ScriptConfig: Codable {
    let speakers: Int?
    let duration: Int?
    let suggestedTitle: String?
    let suggestedDescription: String?
}

struct ScriptsResponse: Codable {
    let scripts: [PodcastScript]
    let total: Int
    let page: Int
    let limit: Int
}

// MARK: - Audio

struct PodcastAudio: Codable, Identifiable {
    let id: String
    let scriptId: String
    let fileName: String
    let fileSize: Int
    let duration: Int
    let status: String
    let createdAt: String
    let script: ScriptRef?
    let episode: EpisodeRef?
}

struct ScriptRef: Codable {
    let id: String
    let title: String
}

struct EpisodeRef: Codable {
    let id: String
}

struct AudiosResponse: Codable {
    let audios: [PodcastAudio]
    let total: Int
    let page: Int
    let limit: Int
}

// MARK: - Episodes

struct Episode: Codable, Identifiable {
    let id: String
    let title: String
    let description: String
    let episodeNumber: Int
    let status: String
    let publishedAt: String?
    let createdAt: String
}

// MARK: - Automations

struct AutomationRule: Codable, Identifiable {
    let id: String
    let name: String
    let isActive: Bool
    let schedule: String
    let topicFilter: String?
    let speakers: Int
    let duration: Int
    let autoPublish: Bool
    let lastRunAt: String?
    let createdAt: String
}

// MARK: - Dashboard

struct DashboardStats: Codable {
    let newSourcesToday: Int
    let totalSources: Int
    let draftScripts: Int
    let totalScripts: Int
    let totalAudio: Int
    let publishedEpisodes: Int
    let totalEpisodes: Int
    let totalAutomations: Int?
}

struct Activity: Codable, Identifiable {
    let type: String
    let title: String
    let date: String
    let id: String
    let status: String?
}

struct DashboardResponse: Codable {
    let stats: DashboardStats
    let activities: [Activity]
}

// MARK: - Generic

struct ErrorResponse: Codable {
    let error: String
}

struct SuccessResponse: Codable {
    let success: Bool?
}
