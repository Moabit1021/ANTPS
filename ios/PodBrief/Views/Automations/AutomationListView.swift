import SwiftUI

struct CreateAutomationBody: Encodable {
    let name: String
    let schedule: String
    let topicFilter: String?
    let speakers: Int
    let duration: Int
    let autoPublish: Bool
}

struct ToggleActiveBody: Encodable {
    let isActive: Bool
}

struct AutomationListView: View {
    @State private var rules: [AutomationRule] = []
    @State private var isLoading = true
    @State private var showCreate = false
    @State private var deleteId: String?

    // Create form
    @State private var formName = ""
    @State private var formSchedule = "0 8 * * *"
    @State private var formTopic = ""
    @State private var formSpeakers = 2
    @State private var formDuration = 10
    @State private var formAutoPublish = false

    private let api = APIClient.shared

    private let schedulePresets = [
        ("Taeglich um 8:00", "0 8 * * *"),
        ("Mo-Fr um 7:00", "0 7 * * 1-5"),
        ("Montags um 8:00", "0 8 * * 1"),
        ("Alle 6 Stunden", "0 */6 * * *"),
        ("Taeglich um 18:00", "0 18 * * *"),
    ]

    var body: some View {
        NavigationStack {
            Group {
                if isLoading && rules.isEmpty {
                    ProgressView("Laden...")
                } else if rules.isEmpty {
                    ContentUnavailableView(
                        "Keine Automationen",
                        systemImage: "bolt.slash",
                        description: Text("Erstelle eine Automation, um regelmaessig Podcasts zu generieren.")
                    )
                } else {
                    List {
                        ForEach(rules) { rule in
                            AutomationRow(rule: rule) {
                                Task { await toggleActive(rule) }
                            }
                            .swipeActions(edge: .trailing) {
                                Button(role: .destructive) {
                                    deleteId = rule.id
                                } label: {
                                    Label("Loeschen", systemImage: "trash")
                                }
                            }
                        }
                    }
                    .listStyle(.plain)
                    .refreshable { await loadRules() }
                }
            }
            .navigationTitle("Automationen")
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button {
                        showCreate = true
                    } label: {
                        Image(systemName: "plus")
                    }
                }
            }
            .sheet(isPresented: $showCreate) {
                createSheet
            }
            .alert("Automation loeschen?", isPresented: Binding(
                get: { deleteId != nil },
                set: { if !$0 { deleteId = nil } }
            )) {
                Button("Abbrechen", role: .cancel) {}
                Button("Loeschen", role: .destructive) {
                    if let id = deleteId {
                        Task { await deleteRule(id) }
                    }
                }
            }
            .task { await loadRules() }
        }
    }

    private var createSheet: some View {
        NavigationStack {
            Form {
                Section("Grundeinstellungen") {
                    TextField("Name", text: $formName)

                    Picker("Zeitplan", selection: $formSchedule) {
                        ForEach(schedulePresets, id: \.1) { preset in
                            Text(preset.0).tag(preset.1)
                        }
                    }
                }

                Section("Themen-Filter") {
                    TextField("z.B. KI im Gesundheitswesen", text: $formTopic)
                    Text("Wenn gesetzt, werden nur thematisch relevante Newsletter verwendet.")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }

                Section("Podcast-Konfiguration") {
                    Picker("Sprecher", selection: $formSpeakers) {
                        Text("1 (Monolog)").tag(1)
                        Text("2 (Dialog)").tag(2)
                    }

                    Picker("Dauer", selection: $formDuration) {
                        Text("5 Min.").tag(5)
                        Text("10 Min.").tag(10)
                        Text("15 Min.").tag(15)
                        Text("20 Min.").tag(20)
                        Text("30 Min.").tag(30)
                    }

                    Toggle("Auto-Veroeffentlichung", isOn: $formAutoPublish)
                }
            }
            .navigationTitle("Neue Automation")
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button("Abbrechen") { showCreate = false }
                }
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Erstellen") {
                        Task { await createRule() }
                    }
                    .disabled(formName.isEmpty)
                }
            }
        }
    }

    private func loadRules() async {
        isLoading = true
        do {
            rules = try await api.get("/automations")
        } catch {
            print("Load automations error: \(error)")
        }
        isLoading = false
    }

    private func toggleActive(_ rule: AutomationRule) async {
        do {
            let _: AutomationRule = try await api.put(
                "/automations/\(rule.id)",
                body: ToggleActiveBody(isActive: !rule.isActive)
            )
            await loadRules()
        } catch {
            print("Toggle automation error: \(error)")
        }
    }

    private func createRule() async {
        do {
            let _: AutomationRule = try await api.post("/automations", body: CreateAutomationBody(
                name: formName,
                schedule: formSchedule,
                topicFilter: formTopic.isEmpty ? nil : formTopic,
                speakers: formSpeakers,
                duration: formDuration,
                autoPublish: formAutoPublish
            ))
            showCreate = false
            formName = ""
            formTopic = ""
            await loadRules()
        } catch {
            print("Create automation error: \(error)")
        }
    }

    private func deleteRule(_ id: String) async {
        do {
            try await api.delete("/automations/\(id)")
            rules.removeAll { $0.id == id }
        } catch {
            print("Delete automation error: \(error)")
        }
        deleteId = nil
    }
}

struct AutomationRow: View {
    let rule: AutomationRule
    let onToggle: () -> Void

    var body: some View {
        HStack {
            VStack(alignment: .leading, spacing: 4) {
                HStack(spacing: 6) {
                    Image(systemName: rule.isActive ? "bolt.fill" : "bolt.slash")
                        .foregroundStyle(rule.isActive ? .yellow : .secondary)
                        .font(.caption)

                    Text(rule.name)
                        .font(.headline)
                }

                HStack(spacing: 8) {
                    Label(rule.schedule, systemImage: "clock")
                        .font(.caption)
                        .foregroundStyle(.secondary)

                    Text("\(rule.speakers == 1 ? "Mono" : "Dialog") | \(rule.duration) Min.")
                        .font(.caption)
                        .foregroundStyle(.secondary)

                    if rule.autoPublish {
                        Text("Auto")
                            .font(.caption2)
                            .padding(.horizontal, 4)
                            .padding(.vertical, 1)
                            .background(.green.opacity(0.1))
                            .foregroundStyle(.green)
                            .clipShape(Capsule())
                    }
                }

                if let topic = rule.topicFilter {
                    Text("Thema: \(topic)")
                        .font(.caption)
                        .foregroundStyle(.blue)
                }
            }

            Spacer()

            Button {
                onToggle()
            } label: {
                Text(rule.isActive ? "Pausieren" : "Aktivieren")
                    .font(.caption)
            }
            .buttonStyle(.bordered)
        }
        .padding(.vertical, 4)
        .opacity(rule.isActive ? 1 : 0.6)
    }
}
