import SwiftUI

@main
struct PodBriefApp: App {
    @StateObject private var authService = AuthService()
    @StateObject private var audioPlayer = AudioPlayerService()

    var body: some Scene {
        WindowGroup {
            if authService.isAuthenticated {
                MainTabView()
                    .environmentObject(authService)
                    .environmentObject(audioPlayer)
            } else {
                LoginView()
                    .environmentObject(authService)
            }
        }
    }
}
