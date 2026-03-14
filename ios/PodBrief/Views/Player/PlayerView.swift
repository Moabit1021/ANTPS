import SwiftUI

struct PlayerView: View {
    @EnvironmentObject var audioPlayer: AudioPlayerService
    @Environment(\.dismiss) var dismiss

    var body: some View {
        VStack(spacing: 32) {
            // Dismiss handle
            Capsule()
                .fill(.secondary.opacity(0.3))
                .frame(width: 40, height: 5)
                .padding(.top, 8)

            Spacer()

            // Artwork placeholder
            RoundedRectangle(cornerRadius: 16)
                .fill(
                    LinearGradient(
                        colors: [.blue.opacity(0.3), .purple.opacity(0.3)],
                        startPoint: .topLeading,
                        endPoint: .bottomTrailing
                    )
                )
                .frame(width: 280, height: 280)
                .overlay {
                    Image(systemName: "radio")
                        .font(.system(size: 64))
                        .foregroundStyle(.white.opacity(0.8))
                }

            // Title
            VStack(spacing: 4) {
                Text(audioPlayer.currentEpisodeTitle ?? "Kein Titel")
                    .font(.title2.bold())
                    .multilineTextAlignment(.center)
                    .lineLimit(3)

                Text("PodBrief")
                    .foregroundStyle(.secondary)
            }
            .padding(.horizontal)

            // Progress
            VStack(spacing: 4) {
                Slider(
                    value: Binding(
                        get: { audioPlayer.currentTime },
                        set: { audioPlayer.seek(to: $0) }
                    ),
                    in: 0...max(audioPlayer.duration, 1)
                )

                HStack {
                    Text(formatTime(audioPlayer.currentTime))
                        .font(.caption)
                        .foregroundStyle(.secondary)
                    Spacer()
                    Text("-\(formatTime(max(0, audioPlayer.duration - audioPlayer.currentTime)))")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
            }
            .padding(.horizontal)

            // Controls
            HStack(spacing: 40) {
                // Skip backward 15s
                Button {
                    audioPlayer.skip(by: -15)
                } label: {
                    Image(systemName: "gobackward.15")
                        .font(.title)
                        .foregroundStyle(.primary)
                }

                // Play/Pause
                Button {
                    audioPlayer.togglePlayPause()
                } label: {
                    Image(systemName: audioPlayer.isPlaying ? "pause.circle.fill" : "play.circle.fill")
                        .font(.system(size: 64))
                        .foregroundStyle(.blue)
                }

                // Skip forward 30s
                Button {
                    audioPlayer.skip(by: 30)
                } label: {
                    Image(systemName: "goforward.30")
                        .font(.title)
                        .foregroundStyle(.primary)
                }
            }

            Spacer()
        }
        .padding()
    }

    private func formatTime(_ seconds: TimeInterval) -> String {
        let mins = Int(seconds) / 60
        let secs = Int(seconds) % 60
        return String(format: "%d:%02d", mins, secs)
    }
}
