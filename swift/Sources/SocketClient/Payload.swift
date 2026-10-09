import Foundation

enum Payload {
    static func fromCommandLine() -> Message {
        let joined = ProcessInfo.processInfo.arguments.dropFirst().joined(separator: " ")
        if joined.isEmpty {
            return .text("hello from Swift")
        }

        let path = (joined as NSString).expandingTildeInPath
        var isDir: ObjCBool = false
        if FileManager.default.fileExists(atPath: path, isDirectory: &isDir),
           !isDir.boolValue,
           let mime = mimeType(for: path),
           let bytes = FileManager.default.contents(atPath: path)
        {
            return .image(path: path, mime: mime, bytes: bytes)
        }

        return .text(joined)
    }

    private static func mimeType(for path: String) -> String? {
        switch URL(fileURLWithPath: path).pathExtension.lowercased() {
        case "png": return "image/png"
        case "jpg", "jpeg": return "image/jpeg"
        case "gif": return "image/gif"
        case "webp": return "image/webp"
        default: return nil
        }
    }
}
