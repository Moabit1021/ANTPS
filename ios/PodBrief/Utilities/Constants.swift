import Foundation

enum Constants {
    // MARK: - API Configuration
    // Change this to your PodBrief server URL
    static let apiBaseURL = "https://podbrief.example.com/api"

    // MARK: - Keychain
    static let keychainServiceName = "com.podbriefapp.PodBrief"
    static let keychainTokenKey = "api_token"

    // MARK: - User Defaults
    static let userDefaultsSuite = "com.podbriefapp.PodBrief"
    static let lastSyncKey = "lastSync"
    static let serverURLKey = "serverURL"

    // MARK: - Audio
    static let maxDownloadRetries = 3
    static let audioBufferSize = 4096
}
