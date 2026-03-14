import SwiftUI

struct InboxView: View {
    @EnvironmentObject var authService: AuthService
    @State private var sources: [Source] = []
    @State private var total = 0
    @State private var isLoading = true
    @State private var page = 1
    @State private var searchQuery = ""

    private let api = APIClient.shared

    var body: some View {
        NavigationStack {
            Group {
                if isLoading && sources.isEmpty {
                    ProgressView("Laden...")
                } else if sources.isEmpty {
                    ContentUnavailableView(
                        "Postfach leer",
                        systemImage: "tray",
                        description: Text("Leite Newsletter an deine Adresse weiter, um loszulegen.")
                    )
                } else {
                    List {
                        ForEach(sources) { source in
                            SourceRow(source: source)
                        }

                        if sources.count < total {
                            Button("Mehr laden") {
                                page += 1
                                Task { await loadSources(append: true) }
                            }
                            .frame(maxWidth: .infinity)
                        }
                    }
                    .listStyle(.plain)
                    .refreshable {
                        page = 1
                        await loadSources()
                    }
                }
            }
            .navigationTitle("Postfach")
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    if let email = authService.profile?.inboxEmail {
                        Button {
                            UIPasteboard.general.string = email
                        } label: {
                            Label("E-Mail kopieren", systemImage: "doc.on.doc")
                        }
                    }
                }
            }
            .searchable(text: $searchQuery, prompt: "Thema suchen...")
            .onSubmit(of: .search) {
                Task { await semanticSearch() }
            }
            .task {
                await loadSources()
                if authService.profile?.inboxEmail == nil {
                    await authService.activateInbox()
                }
            }
        }
    }

    private func loadSources(append: Bool = false) async {
        isLoading = true
        do {
            let response: SourcesResponse = try await api.get("/sources", query: [
                URLQueryItem(name: "page", value: "\(page)"),
                URLQueryItem(name: "limit", value: "20"),
                URLQueryItem(name: "sort", value: "desc"),
            ])

            if append {
                sources.append(contentsOf: response.sources)
            } else {
                sources = response.sources
            }
            total = response.total
        } catch {
            print("Load sources error: \(error)")
        }
        isLoading = false
    }

    private func semanticSearch() async {
        guard !searchQuery.isEmpty else {
            page = 1
            await loadSources()
            return
        }

        isLoading = true
        do {
            let response: SearchResponse = try await api.get("/sources/search", query: [
                URLQueryItem(name: "q", value: searchQuery),
                URLQueryItem(name: "limit", value: "20"),
            ])

            sources = response.results.map { result in
                Source(
                    id: result.sourceId,
                    type: "NEWSLETTER",
                    title: result.title,
                    senderEmail: nil,
                    senderName: result.senderName,
                    receivedAt: result.receivedAt,
                    status: "READY",
                    createdAt: result.receivedAt
                )
            }
            total = response.count
        } catch {
            print("Search error: \(error)")
        }
        isLoading = false
    }
}
