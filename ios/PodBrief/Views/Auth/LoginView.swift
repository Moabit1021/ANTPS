import SwiftUI

struct LoginView: View {
    @EnvironmentObject var authService: AuthService

    @State private var serverURL = ""
    @State private var email = ""
    @State private var password = ""
    @State private var apiToken = ""
    @State private var useTokenLogin = false

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 24) {
                    // Logo
                    VStack(spacing: 8) {
                        Image(systemName: "radio")
                            .font(.system(size: 48))
                            .foregroundStyle(.blue)

                        Text("PodBrief")
                            .font(.largeTitle.bold())

                        Text("Newsletter zu Podcasts")
                            .foregroundStyle(.secondary)
                    }
                    .padding(.top, 40)

                    // Server URL
                    VStack(alignment: .leading, spacing: 6) {
                        Text("Server-URL")
                            .font(.caption)
                            .foregroundStyle(.secondary)

                        TextField("https://podbrief.example.com/api", text: $serverURL)
                            .textFieldStyle(.roundedBorder)
                            .autocapitalization(.none)
                            .disableAutocorrection(true)
                            .keyboardType(.URL)
                    }

                    if useTokenLogin {
                        // Token Login
                        VStack(alignment: .leading, spacing: 6) {
                            Text("API Token")
                                .font(.caption)
                                .foregroundStyle(.secondary)

                            SecureField("pb_...", text: $apiToken)
                                .textFieldStyle(.roundedBorder)
                                .autocapitalization(.none)
                        }

                        Button {
                            Task {
                                await authService.loginWithToken(
                                    serverURL: serverURL,
                                    token: apiToken
                                )
                            }
                        } label: {
                            if authService.isLoading {
                                ProgressView()
                                    .frame(maxWidth: .infinity)
                            } else {
                                Text("Mit Token anmelden")
                                    .frame(maxWidth: .infinity)
                            }
                        }
                        .buttonStyle(.borderedProminent)
                        .disabled(serverURL.isEmpty || apiToken.isEmpty || authService.isLoading)
                    } else {
                        // Email/Password Login
                        VStack(alignment: .leading, spacing: 6) {
                            Text("E-Mail")
                                .font(.caption)
                                .foregroundStyle(.secondary)

                            TextField("admin@example.com", text: $email)
                                .textFieldStyle(.roundedBorder)
                                .autocapitalization(.none)
                                .disableAutocorrection(true)
                                .keyboardType(.emailAddress)
                        }

                        VStack(alignment: .leading, spacing: 6) {
                            Text("Passwort")
                                .font(.caption)
                                .foregroundStyle(.secondary)

                            SecureField("Passwort", text: $password)
                                .textFieldStyle(.roundedBorder)
                        }

                        Button {
                            Task {
                                await authService.login(
                                    serverURL: serverURL,
                                    email: email,
                                    password: password
                                )
                            }
                        } label: {
                            if authService.isLoading {
                                ProgressView()
                                    .frame(maxWidth: .infinity)
                            } else {
                                Text("Anmelden")
                                    .frame(maxWidth: .infinity)
                            }
                        }
                        .buttonStyle(.borderedProminent)
                        .disabled(serverURL.isEmpty || email.isEmpty || password.isEmpty || authService.isLoading)
                    }

                    // Error
                    if let error = authService.error {
                        Text(error)
                            .foregroundStyle(.red)
                            .font(.caption)
                            .multilineTextAlignment(.center)
                    }

                    // Toggle login method
                    Button {
                        useTokenLogin.toggle()
                    } label: {
                        Text(useTokenLogin ? "Mit E-Mail anmelden" : "Mit API Token anmelden")
                            .font(.caption)
                    }

                    Spacer()
                }
                .padding(.horizontal, 24)
            }
        }
    }
}
