import SwiftUI

struct SettingsView: View {
    @EnvironmentObject var authService: AuthService
    @State private var showTokenAlert = false
    @State private var generatedToken = ""
    @State private var isGeneratingToken = false
    @State private var showLogoutConfirm = false

    private let api = APIClient.shared

    var body: some View {
        NavigationStack {
            Form {
                // Profile
                Section("Profil") {
                    if let profile = authService.profile {
                        LabeledContent("E-Mail", value: profile.email)
                        LabeledContent("Rolle", value: profile.role == "ADMIN" ? "Administrator" : "Creator")
                        if let name = profile.name {
                            LabeledContent("Name", value: name)
                        }
                    }
                }

                // Inbox
                Section("Postfach") {
                    if let email = authService.profile?.inboxEmail {
                        HStack {
                            Text(email)
                                .font(.system(.body, design: .monospaced))
                            Spacer()
                            Button {
                                UIPasteboard.general.string = email
                            } label: {
                                Image(systemName: "doc.on.doc")
                            }
                        }
                    } else {
                        Button("Postfach aktivieren") {
                            Task { await authService.activateInbox() }
                        }
                    }
                }

                // API Token
                Section("API Token") {
                    if authService.profile?.hasApiToken == true {
                        Text("Token aktiv")
                            .foregroundStyle(.green)
                    }

                    Button("Neuen Token generieren") {
                        Task { await generateToken() }
                    }
                    .disabled(isGeneratingToken)
                }

                // Server
                Section("Server") {
                    LabeledContent("URL", value: UserDefaults.standard.string(forKey: Constants.serverURLKey) ?? "Nicht konfiguriert")
                }

                // App Info
                Section("App") {
                    LabeledContent("Version", value: "1.0.0")
                    LabeledContent("Build", value: "1")
                }

                // Logout
                Section {
                    Button(role: .destructive) {
                        showLogoutConfirm = true
                    } label: {
                        HStack {
                            Spacer()
                            Text("Abmelden")
                            Spacer()
                        }
                    }
                }
            }
            .navigationTitle("Einstellungen")
            .alert("API Token generiert", isPresented: $showTokenAlert) {
                Button("Kopieren") {
                    UIPasteboard.general.string = generatedToken
                }
                Button("OK", role: .cancel) {}
            } message: {
                Text("Dein neuer Token:\n\(generatedToken)\n\nSpeichere ihn sicher - er wird nicht erneut angezeigt.")
            }
            .alert("Abmelden?", isPresented: $showLogoutConfirm) {
                Button("Abbrechen", role: .cancel) {}
                Button("Abmelden", role: .destructive) {
                    authService.logout()
                }
            }
        }
    }

    private func generateToken() async {
        isGeneratingToken = true
        do {
            let response: TokenResponse = try await api.post("/auth/token")
            generatedToken = response.token
            showTokenAlert = true
            await authService.loadProfile()
        } catch {
            print("Generate token error: \(error)")
        }
        isGeneratingToken = false
    }
}
