import SwiftUI

struct PodcastListView: View {
    @EnvironmentObject var audioPlayer: AudioPlayerService
    @State private var audios: [PodcastAudio] = []
    @State private var isLoading = true
    @State private var page = 1
    @State private var total = 0

    private let api = APIClient.shared

    var body: some View {
        NavigationStack {
            Group {
                if isLoading && audios.isEmpty {
                    ProgressView("Laden...")
                } else if audios.isEmpty {
                    ContentUnavailableView(
                        "Keine Podcasts",
                        systemImage: "headphones",
                        description: Text("Erstelle deinen ersten Podcast, um ihn hier zu sehen.")
                    )
                } else {
                    List {
                        ForEach(audios) { audio in
                            PodcastRow(audio: audio)
                                .onTapGesture {
                                    let baseURL = UserDefaults.standard.string(forKey: Constants.serverURLKey) ?? Constants.apiBaseURL
                                    let url = URL(string: "\(baseURL)/audio/\(audio.id)")!
                                    Task {
                                        await audioPlayer.play(
                                            audioId: audio.id,
                                            title: audio.script?.title ?? audio.fileName,
                                            streamURL: url
                                        )
                                    }
                                }
                        }

                        if audios.count < total {
                            Button("Mehr laden") {
                                page += 1
                                Task { await loadAudios(append: true) }
                            }
                        }
                    }
                    .listStyle(.plain)
                    .refreshable {
                        page = 1
                        await loadAudios()
                    }
                }
            }
            .navigationTitle("Podcasts")
            .task { await loadAudios() }
        }
    }

    private func loadAudios(append: Bool = false) async {
        isLoading = true
        do {
            let response: AudiosResponse = try await api.get("/audio", query: [
                URLQueryItem(name: "page", value: "\(page)"),
                URLQueryItem(name: "limit", value: "20"),
            ])

            if append {
                audios.append(contentsOf: response.audios)
            } else {
                audios = response.audios
            }
            total = response.total
        } catch {
            print("Load audios error: \(error)")
        }
        isLoading = false
    }
}

struct PodcastRow: View {
    let audio: PodcastAudio
    @EnvironmentObject var audioPlayer: AudioPlayerService

    var body: some View {
        HStack(spacing: 12) {
            // Play indicator
            ZStack {
                Circle()
                    .fill(audioPlayer.currentAudioId == audio.id ? Color.blue : Color.blue.opacity(0.1))
                    .frame(width: 44, height: 44)

                Image(systemName: audioPlayer.currentAudioId == audio.id && audioPlayer.isPlaying ? "pause.fill" : "play.fill")
                    .foregroundStyle(audioPlayer.currentAudioId == audio.id ? .white : .blue)
                    .font(.system(size: 16))
            }

            VStack(alignment: .leading, spacing: 4) {
                Text(audio.script?.title ?? audio.fileName)
                    .font(.headline)
                    .lineLimit(2)

                HStack(spacing: 8) {
                    Text(formatDuration(audio.duration))
                        .font(.caption)
                        .foregroundStyle(.secondary)

                    Text(formatFileSize(audio.fileSize))
                        .font(.caption)
                        .foregroundStyle(.secondary)

                    Spacer()

                    if audio.episode != nil {
                        Image(systemName: "checkmark.circle.fill")
                            .foregroundStyle(.green)
                            .font(.caption)
                    }
                }
            }
        }
        .padding(.vertical, 4)
    }

    private func formatDuration(_ seconds: Int) -> String {
        let minutes = seconds / 60
        let secs = seconds % 60
        return String(format: "%d:%02d Min.", minutes, secs)
    }

    private func formatFileSize(_ bytes: Int) -> String {
        let mb = Double(bytes) / 1_048_576
        return String(format: "%.1f MB", mb)
    }
}
