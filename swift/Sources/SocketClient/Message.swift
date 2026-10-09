import Foundation

enum Message {
    case text(String)
    case image(path: String, mime: String, bytes: Data)

    var json: String {
        let body: [String: String]
        switch self {
        case .text(let text):
            body = ["type": "text", "text": text]
        case .image(_, let mime, let bytes):
            body = [
                "type": "image",
                "mime": mime,
                "data": bytes.base64EncodedString(),
            ]
        }
        return String(data: try! JSONSerialization.data(withJSONObject: body), encoding: .utf8)!
    }

    var summary: String {
        switch self {
        case .text(let text):
            return text
        case .image(let path, _, let bytes):
            return "image \(path) (\(bytes.count) bytes)"
        }
    }
}
