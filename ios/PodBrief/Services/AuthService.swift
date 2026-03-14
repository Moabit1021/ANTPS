import Foundation
import SwiftUI

struct LoginBody: Encodable {
    let email: String
    let password: String
}

struct GenerateInboxBody: Encodable {
    let generateInbox: Bool
}

@MainActor
class AuthService: ObservableObject {
    @Published var isAuthenticated = false
    @Published var profile: UserProfile?
    @Published var isLoading = false
    @Published var error: String?

    private let api = APIClient.shared

    init() {
        // Check if we have a stored token
        if KeychainService.load(key: Constants.keychainTokenKey) != nil {
            isAuthenticated = true
            Task { await loadProfile() }
        }
    }

    /// Login with email and password, then generate and store API token
    func login(serverURL: String, email: String, password: String) async {
        isLoading = true
        error = nil

        // Store server URL
        UserDefaults.standard.set(serverURL.trimmingCharacters(in: .init(charactersIn: "/")), forKey: Constants.serverURLKey)

        do {
            // Step 1: Login via NextAuth credentials to get a session
            // Since we're a mobile app, we use the token endpoint
            let tokenResponse: TokenResponse = try await api.post("/auth/token", body: LoginBody(email: email, password: password))

            // Store the token securely
            let saved = KeychainService.save(key: Constants.keychainTokenKey, value: tokenResponse.token)
            if !saved {
                error = "Token konnte nicht gespeichert werden"
                isLoading = false
                return
            }

            isAuthenticated = true
            await loadProfile()
        } catch let apiError as APIError {
            error = apiError.errorDescription
        } catch {
            self.error = error.localizedDescription
        }

        isLoading = false
    }

    /// Login with a pre-generated API token
    func loginWithToken(serverURL: String, token: String) async {
        isLoading = true
        error = nil

        UserDefaults.standard.set(serverURL.trimmingCharacters(in: .init(charactersIn: "/")), forKey: Constants.serverURLKey)

        let saved = KeychainService.save(key: Constants.keychainTokenKey, value: token)
        if !saved {
            error = "Token konnte nicht gespeichert werden"
            isLoading = false
            return
        }

        // Verify the token works
        do {
            let userProfile: UserProfile = try await api.get("/me")
            profile = userProfile
            isAuthenticated = true
        } catch {
            KeychainService.delete(key: Constants.keychainTokenKey)
            self.error = "Token ungültig oder Server nicht erreichbar"
        }

        isLoading = false
    }

    func loadProfile() async {
        do {
            let userProfile: UserProfile = try await api.get("/me")
            profile = userProfile
        } catch {
            // If unauthorized, log out
            if case APIError.unauthorized = error {
                logout()
            }
        }
    }

    func activateInbox() async {
        do {
            let updated: UserProfile = try await api.put("/me", body: GenerateInboxBody(generateInbox: true))
            profile = updated
        } catch {
            self.error = "Postfach konnte nicht aktiviert werden"
        }
    }

    func logout() {
        KeychainService.delete(key: Constants.keychainTokenKey)
        isAuthenticated = false
        profile = nil
    }
}
