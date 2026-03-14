import SwiftUI

struct SourceRow: View {
    let source: Source

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(source.title)
                .font(.headline)
                .lineLimit(2)

            HStack(spacing: 8) {
                if let sender = source.senderName ?? source.senderEmail {
                    Text(sender)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }

                Text(formatDate(source.receivedAt))
                    .font(.caption)
                    .foregroundStyle(.secondary)

                Spacer()

                Text(source.status)
                    .font(.caption2)
                    .padding(.horizontal, 6)
                    .padding(.vertical, 2)
                    .background(statusColor.opacity(0.1))
                    .foregroundStyle(statusColor)
                    .clipShape(Capsule())
            }
        }
        .padding(.vertical, 4)
    }

    private var statusColor: Color {
        switch source.status {
        case "NEW": return .blue
        case "READY": return .green
        case "USED": return .gray
        case "ARCHIVED": return .orange
        default: return .secondary
        }
    }

    private func formatDate(_ dateString: String) -> String {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        guard let date = formatter.date(from: dateString) else {
            // Try without fractional seconds
            formatter.formatOptions = [.withInternetDateTime]
            guard let date = formatter.date(from: dateString) else { return dateString }
            return formatRelative(date)
        }
        return formatRelative(date)
    }

    private func formatRelative(_ date: Date) -> String {
        let formatter = RelativeDateTimeFormatter()
        formatter.locale = Locale(identifier: "de_DE")
        formatter.unitsStyle = .abbreviated
        return formatter.localizedString(for: date, relativeTo: Date())
    }
}
