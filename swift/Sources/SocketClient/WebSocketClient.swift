import Foundation

enum WebSocketClient {
    static func send(_ json: String, to url: URL = URL(string: "ws://127.0.0.1:9001")!) {
        let session = URLSession(configuration: .default)
        let task = session.webSocketTask(with: url)
        task.resume()

        let sent = DispatchSemaphore(value: 0)
        task.send(.string(json)) { error in
            if let error {
                fputs("send failed: \(error)\n", stderr)
                exit(1)
            }
            sent.signal()
        }

        if sent.wait(timeout: .now() + 10) == .timedOut {
            fputs("send timeout\n", stderr)
            exit(1)
        }

        task.cancel(with: .normalClosure, reason: nil)
        session.finishTasksAndInvalidate()
    }
}
