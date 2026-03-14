import SwiftUI

struct MainTabView: View {
    @EnvironmentObject var audioPlayer: AudioPlayerService

    var body: some View {
        ZStack(alignment: .bottom) {
            TabView {
                InboxView()
                    .tabItem {
                        Label("Postfach", systemImage: "tray.full")
                    }

                PodcastListView()
                    .tabItem {
                        Label("Podcasts", systemImage: "headphones")
                    }

                CreatePodcastView()
                    .tabItem {
                        Label("Erstellen", systemImage: "plus.circle.fill")
                    }

                AutomationListView()
                    .tabItem {
                        Label("Auto", systemImage: "bolt.fill")
                    }

                SettingsView()
                    .tabItem {
                        Label("Mehr", systemImage: "ellipsis")
                    }
            }

            // Mini Player
            if audioPlayer.currentAudioId != nil {
                MiniPlayerView()
                    .padding(.bottom, 49) // Tab bar height
            }
        }
    }
}
