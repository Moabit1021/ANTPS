import SwiftUI

struct CreateSourceSelection: Encodable {
    let sourceIds: [String]
    let speakers: Int
    let duration: Int
}

struct CreatePodcastView: View {
    @State private var sources: [Source] = []
    @State private var selectedSourceIds = Set<String>()
    @State private var searchQuery = ""
    @State private var searchResults: [SearchResult] = []
    @State private var speakers = 2
    @State private var duration = 10
    @State private var isLoading = false
    @State private var isGenerating = false
    @State private var error: String?
    @State private var successMessage: String?

    private let api = APIClient.shared

    var body: some View {
        NavigationStack {
            Form {
                // Topic Search Section
                Section("Themensuche") {
                    HStack {
                        TextField("z.B. KI im Gesundheitswesen", text: $searchQuery)
                        Button("Suchen") {
                            Task { await search() }
                        }
                        .disabled(searchQuery.count < 2)
                    }

                    if !searchResults.isEmpty {
                        ForEach(searchResults) { result in
                            Button {
                                toggleSelection(result.sourceId)
                            } label: {
                                HStack {
                                    VStack(alignment: .leading, spacing: 2) {
                                        Text(result.title)
                                            .font(.subheadline)
                                            .foregroundStyle(.primary)
                                        Text(result.matchedChunk)
                                            .font(.caption)
                                            .foregroundStyle(.secondary)
                                            .lineLimit(2)
                                        HStack {
                                            Text(String(format: "%.0f%% relevant", result.similarity * 100))
                                                .font(.caption2)
                                                .foregroundStyle(.blue)
                                            if let sender = result.senderName {
                                                Text("von \(sender)")
                                                    .font(.caption2)
                                                    .foregroundStyle(.secondary)
                                            }
                                        }
                                    }
                                    Spacer()
                                    if selectedSourceIds.contains(result.sourceId) {
                                        Image(systemName: "checkmark.circle.fill")
                                            .foregroundStyle(.blue)
                                    }
                                }
                            }
                        }
                    }
                }

                // Recent Sources Section
                Section("Neueste Newsletter (\(selectedSourceIds.count) ausgewaehlt)") {
                    if isLoading {
                        ProgressView()
                    } else {
                        ForEach(sources) { source in
                            Button {
                                toggleSelection(source.id)
                            } label: {
                                HStack {
                                    VStack(alignment: .leading, spacing: 2) {
                                        Text(source.title)
                                            .font(.subheadline)
                                            .foregroundStyle(.primary)
                                            .lineLimit(2)
                                        if let sender = source.senderName ?? source.senderEmail {
                                            Text(sender)
                                                .font(.caption)
                                                .foregroundStyle(.secondary)
                                        }
                                    }
                                    Spacer()
                                    if selectedSourceIds.contains(source.id) {
                                        Image(systemName: "checkmark.circle.fill")
                                            .foregroundStyle(.blue)
                                    } else {
                                        Image(systemName: "circle")
                                            .foregroundStyle(.secondary)
                                    }
                                }
                            }
                        }
                    }
                }

                // Configuration
                Section("Konfiguration") {
                    Picker("Sprecher", selection: $speakers) {
                        Text("1 (Monolog)").tag(1)
                        Text("2 (Dialog)").tag(2)
                    }

                    Picker("Dauer", selection: $duration) {
                        Text("5 Min.").tag(5)
                        Text("10 Min.").tag(10)
                        Text("15 Min.").tag(15)
                        Text("20 Min.").tag(20)
                        Text("30 Min.").tag(30)
                    }
                }

                // Generate Button
                Section {
                    Button {
                        Task { await generate() }
                    } label: {
                        HStack {
                            Spacer()
                            if isGenerating {
                                ProgressView()
                                    .padding(.trailing, 8)
                                Text("Generiere Podcast...")
                            } else {
                                Image(systemName: "wand.and.stars")
                                Text("Podcast erstellen")
                            }
                            Spacer()
                        }
                        .padding(.vertical, 4)
                    }
                    .disabled(selectedSourceIds.isEmpty || isGenerating)
                }

                // Messages
                if let error {
                    Section {
                        Text(error)
                            .foregroundStyle(.red)
                    }
                }

                if let success = successMessage {
                    Section {
                        Label(success, systemImage: "checkmark.circle.fill")
                            .foregroundStyle(.green)
                    }
                }
            }
            .navigationTitle("Podcast erstellen")
            .task { await loadSources() }
        }
    }

    private func toggleSelection(_ id: String) {
        if selectedSourceIds.contains(id) {
            selectedSourceIds.remove(id)
        } else {
            selectedSourceIds.insert(id)
        }
    }

    private func loadSources() async {
        isLoading = true
        do {
            let response: SourcesResponse = try await api.get("/sources", query: [
                URLQueryItem(name: "limit", value: "30"),
                URLQueryItem(name: "sort", value: "desc"),
            ])
            sources = response.sources
        } catch {
            self.error = "Newsletter konnten nicht geladen werden"
        }
        isLoading = false
    }

    private func search() async {
        do {
            let response: SearchResponse = try await api.get("/sources/search", query: [
                URLQueryItem(name: "q", value: searchQuery),
                URLQueryItem(name: "limit", value: "15"),
            ])
            searchResults = response.results
        } catch {
            self.error = "Suche fehlgeschlagen"
        }
    }

    private func generate() async {
        isGenerating = true
        error = nil
        successMessage = nil

        do {
            let body = CreateSourceSelection(
                sourceIds: Array(selectedSourceIds),
                speakers: speakers,
                duration: duration
            )
            let script: PodcastScript = try await api.post("/scripts/generate", body: body)
            successMessage = "Podcast '\(script.title)' wurde erstellt!"
            selectedSourceIds.removeAll()
            searchResults.removeAll()
        } catch let apiError as APIError {
            error = apiError.errorDescription
        } catch {
            self.error = error.localizedDescription
        }

        isGenerating = false
    }
}
