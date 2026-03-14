import SwiftUI

struct MiniPlayerView: View {
    @EnvironmentObject var audioPlayer: AudioPlayerService
    @State private var showFullPlayer = false

    var body: some View {
        VStack(spacing: 0) {
            // Progress bar
            GeometryReader { geo in
                ZStack(alignment: .leading) {
                    Rectangle()
                        .fill(.secondary.opacity(0.2))
                    Rectangle()
                        .fill(.blue)
                        .frame(width: audioPlayer.duration > 0
                            ? geo.size.width * (audioPlayer.currentTime / audioPlayer.duration)
                            : 0
                        )
                }
            }
            .frame(height: 2)

            // Controls
            HStack(spacing: 12) {
                // Title
                VStack(alignment: .leading, spacing: 2) {
                    Text(audioPlayer.currentEpisodeTitle ?? "")
                        .font(.subheadline.bold())
                        .lineLimit(1)
                    Text("PodBrief")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }

                Spacer()

                // Play/Pause
                Button {
                    audioPlayer.togglePlayPause()
                } label: {
                    Image(systemName: audioPlayer.isPlaying ? "pause.fill" : "play.fill")
                        .font(.title3)
                        .foregroundStyle(.primary)
                }
                .buttonStyle(.plain)

                // Skip forward
                Button {
                    audioPlayer.skip(by: 30)
                } label: {
                    Image(systemName: "goforward.30")
                        .font(.body)
                        .foregroundStyle(.secondary)
                }
                .buttonStyle(.plain)

                // Close
                Button {
                    audioPlayer.stop()
                } label: {
                    Image(systemName: "xmark")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
                .buttonStyle(.plain)
            }
            .padding(.horizontal)
            .padding(.vertical, 8)
        }
        .background(.ultraThinMaterial)
        .onTapGesture {
            showFullPlayer = true
        }
        .sheet(isPresented: $showFullPlayer) {
            PlayerView()
                .environmentObject(audioPlayer)
        }
    }
}
