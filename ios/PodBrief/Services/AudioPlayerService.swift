import Foundation
import AVFoundation
import MediaPlayer
import Combine

@MainActor
class AudioPlayerService: ObservableObject {
    @Published var isPlaying = false
    @Published var currentEpisodeTitle: String?
    @Published var currentAudioId: String?
    @Published var currentTime: TimeInterval = 0
    @Published var duration: TimeInterval = 0
    @Published var isLoading = false

    private var player: AVPlayer?
    private var timeObserver: Any?
    private var cancellables = Set<AnyCancellable>()

    init() {
        setupAudioSession()
        setupRemoteCommands()
    }

    // MARK: - Audio Session

    private func setupAudioSession() {
        do {
            let session = AVAudioSession.sharedInstance()
            try session.setCategory(.playback, mode: .spokenAudio, options: [])
            try session.setActive(true)
        } catch {
            print("Audio session setup failed: \(error)")
        }
    }

    // MARK: - Remote Commands (Lock Screen / Bluetooth)

    private func setupRemoteCommands() {
        let commandCenter = MPRemoteCommandCenter.shared()

        commandCenter.playCommand.addTarget { [weak self] _ in
            Task { @MainActor in
                self?.resume()
            }
            return .success
        }

        commandCenter.pauseCommand.addTarget { [weak self] _ in
            Task { @MainActor in
                self?.pause()
            }
            return .success
        }

        commandCenter.togglePlayPauseCommand.addTarget { [weak self] _ in
            Task { @MainActor in
                self?.togglePlayPause()
            }
            return .success
        }

        commandCenter.skipForwardCommand.preferredIntervals = [30]
        commandCenter.skipForwardCommand.addTarget { [weak self] event in
            guard let skipEvent = event as? MPSkipIntervalCommandEvent else { return .commandFailed }
            Task { @MainActor in
                self?.skip(by: skipEvent.interval)
            }
            return .success
        }

        commandCenter.skipBackwardCommand.preferredIntervals = [15]
        commandCenter.skipBackwardCommand.addTarget { [weak self] event in
            guard let skipEvent = event as? MPSkipIntervalCommandEvent else { return .commandFailed }
            Task { @MainActor in
                self?.skip(by: -skipEvent.interval)
            }
            return .success
        }

        commandCenter.changePlaybackPositionCommand.addTarget { [weak self] event in
            guard let posEvent = event as? MPChangePlaybackPositionCommandEvent else { return .commandFailed }
            Task { @MainActor in
                self?.seek(to: posEvent.positionTime)
            }
            return .success
        }
    }

    // MARK: - Playback Control

    func play(audioId: String, title: String, streamURL: URL? = nil) async {
        isLoading = true
        currentAudioId = audioId
        currentEpisodeTitle = title

        // Stop current playback
        player?.pause()
        removeTimeObserver()

        let url: URL
        if let streamURL {
            url = streamURL
        } else {
            // Check local download first
            let localURL = localFileURL(for: audioId)
            if FileManager.default.fileExists(atPath: localURL.path) {
                url = localURL
            } else {
                // Stream from server
                let baseURL = UserDefaults.standard.string(forKey: Constants.serverURLKey) ?? Constants.apiBaseURL
                guard let token = KeychainService.load(key: Constants.keychainTokenKey) else {
                    isLoading = false
                    return
                }
                // Use streaming URL with auth header via AVURLAsset
                guard var components = URLComponents(string: "\(baseURL)/audio/\(audioId)") else {
                    isLoading = false
                    return
                }
                components.queryItems = [URLQueryItem(name: "token", value: token)]
                guard let streamingURL = components.url else {
                    isLoading = false
                    return
                }
                url = streamingURL
            }
        }

        let playerItem = AVPlayerItem(url: url)
        player = AVPlayer(playerItem: playerItem)

        // Observe time
        let interval = CMTime(seconds: 0.5, preferredTimescale: CMTimeScale(NSEC_PER_SEC))
        timeObserver = player?.addPeriodicTimeObserver(forInterval: interval, queue: .main) { [weak self] time in
            Task { @MainActor [weak self] in
                guard let self else { return }
                self.currentTime = time.seconds
                if let duration = self.player?.currentItem?.duration.seconds, !duration.isNaN {
                    self.duration = duration
                }
                self.updateNowPlayingInfo()
            }
        }

        // Observe when playback ends
        NotificationCenter.default.addObserver(
            forName: .AVPlayerItemDidPlayToEndTime,
            object: playerItem,
            queue: .main
        ) { [weak self] _ in
            Task { @MainActor [weak self] in
                self?.isPlaying = false
                self?.currentTime = 0
            }
        }

        player?.play()
        isPlaying = true
        isLoading = false

        updateNowPlayingInfo()
    }

    func pause() {
        player?.pause()
        isPlaying = false
    }

    func resume() {
        player?.play()
        isPlaying = true
    }

    func togglePlayPause() {
        if isPlaying {
            pause()
        } else {
            resume()
        }
    }

    func stop() {
        player?.pause()
        removeTimeObserver()
        player = nil
        isPlaying = false
        currentAudioId = nil
        currentEpisodeTitle = nil
        currentTime = 0
        duration = 0
        MPNowPlayingInfoCenter.default().nowPlayingInfo = nil
    }

    func seek(to time: TimeInterval) {
        let cmTime = CMTime(seconds: time, preferredTimescale: CMTimeScale(NSEC_PER_SEC))
        player?.seek(to: cmTime)
        currentTime = time
    }

    func skip(by seconds: TimeInterval) {
        let newTime = max(0, min(currentTime + seconds, duration))
        seek(to: newTime)
    }

    // MARK: - Now Playing Info

    private func updateNowPlayingInfo() {
        var info = [String: Any]()
        info[MPMediaItemPropertyTitle] = currentEpisodeTitle ?? "PodBrief"
        info[MPMediaItemPropertyArtist] = "PodBrief"
        info[MPNowPlayingInfoPropertyElapsedPlaybackTime] = currentTime
        info[MPMediaItemPropertyPlaybackDuration] = duration
        info[MPNowPlayingInfoPropertyPlaybackRate] = isPlaying ? 1.0 : 0.0
        MPNowPlayingInfoCenter.default().nowPlayingInfo = info
    }

    // MARK: - Download

    func downloadForOffline(audioId: String) async throws {
        let localURL = localFileURL(for: audioId)
        if FileManager.default.fileExists(atPath: localURL.path) { return }

        let downloadedURL = try await APIClient.shared.downloadAudio(audioId: audioId)
        // Already moved to the right place by APIClient
        print("Downloaded audio to: \(downloadedURL)")
    }

    func isDownloaded(audioId: String) -> Bool {
        FileManager.default.fileExists(atPath: localFileURL(for: audioId).path)
    }

    private func localFileURL(for audioId: String) -> URL {
        let documentsDir = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0]
        return documentsDir.appendingPathComponent("audio/\(audioId).mp3")
    }

    // MARK: - Cleanup

    private func removeTimeObserver() {
        if let observer = timeObserver {
            player?.removeTimeObserver(observer)
            timeObserver = nil
        }
    }

    deinit {
        // Note: deinit cannot be @MainActor, but cleanup is safe
    }
}
