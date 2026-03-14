import Foundation

enum APIError: LocalizedError {
    case unauthorized
    case forbidden
    case notFound
    case serverError(String)
    case networkError(Error)
    case decodingError(Error)

    var errorDescription: String? {
        switch self {
        case .unauthorized: return "Nicht autorisiert. Bitte erneut anmelden."
        case .forbidden: return "Keine Berechtigung."
        case .notFound: return "Nicht gefunden."
        case .serverError(let msg): return msg
        case .networkError(let err): return "Netzwerkfehler: \(err.localizedDescription)"
        case .decodingError(let err): return "Datenfehler: \(err.localizedDescription)"
        }
    }
}

@MainActor
class APIClient: ObservableObject {
    static let shared = APIClient()

    private var baseURL: String {
        UserDefaults.standard.string(forKey: Constants.serverURLKey) ?? Constants.apiBaseURL
    }

    private var token: String? {
        KeychainService.load(key: Constants.keychainTokenKey)
    }

    // MARK: - Generic Request

    func request<T: Decodable>(
        _ method: String,
        path: String,
        body: Encodable? = nil,
        queryItems: [URLQueryItem]? = nil
    ) async throws -> T {
        var components = URLComponents(string: "\(baseURL)\(path)")!
        if let queryItems {
            components.queryItems = queryItems
        }

        var request = URLRequest(url: components.url!)
        request.httpMethod = method
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")

        if let token {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }

        if let body {
            request.httpBody = try JSONEncoder().encode(body)
        }

        let (data, response): (Data, URLResponse)
        do {
            (data, response) = try await URLSession.shared.data(for: request)
        } catch {
            throw APIError.networkError(error)
        }

        guard let httpResponse = response as? HTTPURLResponse else {
            throw APIError.serverError("Ungültige Antwort vom Server")
        }

        switch httpResponse.statusCode {
        case 200...299:
            do {
                return try JSONDecoder().decode(T.self, from: data)
            } catch {
                throw APIError.decodingError(error)
            }
        case 401:
            throw APIError.unauthorized
        case 403:
            throw APIError.forbidden
        case 404:
            throw APIError.notFound
        default:
            if let errorResponse = try? JSONDecoder().decode(ErrorResponse.self, from: data) {
                throw APIError.serverError(errorResponse.error)
            }
            throw APIError.serverError("Server Fehler (\(httpResponse.statusCode))")
        }
    }

    // MARK: - Convenience Methods

    func get<T: Decodable>(_ path: String, query: [URLQueryItem]? = nil) async throws -> T {
        try await request("GET", path: path, queryItems: query)
    }

    func post<T: Decodable>(_ path: String, body: Encodable? = nil) async throws -> T {
        try await request("POST", path: path, body: body)
    }

    func put<T: Decodable>(_ path: String, body: Encodable? = nil) async throws -> T {
        try await request("PUT", path: path, body: body)
    }

    func delete(_ path: String) async throws {
        let _: SuccessResponse = try await request("DELETE", path: path)
    }

    // MARK: - Audio Download

    func downloadAudio(audioId: String) async throws -> URL {
        var components = URLComponents(string: "\(baseURL)/audio/\(audioId)")!
        components.queryItems = [URLQueryItem(name: "download", value: "true")]

        var request = URLRequest(url: components.url!)
        if let token {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }

        let (tempURL, response) = try await URLSession.shared.download(for: request)

        guard let httpResponse = response as? HTTPURLResponse,
              (200...299).contains(httpResponse.statusCode) else {
            throw APIError.serverError("Audio-Download fehlgeschlagen")
        }

        // Move to permanent location
        let documentsDir = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0]
        let audioDir = documentsDir.appendingPathComponent("audio", isDirectory: true)
        try FileManager.default.createDirectory(at: audioDir, withIntermediateDirectories: true)

        let destURL = audioDir.appendingPathComponent("\(audioId).mp3")
        if FileManager.default.fileExists(atPath: destURL.path) {
            try FileManager.default.removeItem(at: destURL)
        }
        try FileManager.default.moveItem(at: tempURL, to: destURL)

        return destURL
    }
}
