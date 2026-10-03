import Foundation
import Network

let host = NWEndpoint.Host("127.0.0.1")
let port = NWEndpoint.Port(integerLiteral: 9000)
let connection = NWConnection(host: host, port: port, using: .tcp)

let ready = DispatchSemaphore(value: 0)
var connectError: Error?

connection.stateUpdateHandler = { state in
    switch state {
    case .ready:
        ready.signal()
    case .failed(let error), .waiting(let error):
        connectError = error
        ready.signal()
    default:
        break
    }
}

connection.start(queue: .global())
ready.wait()

if let connectError {
    fputs("connect failed: \(connectError)\n", stderr)
    exit(1)
}

let payload = ProcessInfo.processInfo.arguments.dropFirst().joined(separator: " ")
let message = (payload.isEmpty ? "hello from Swift" : payload) + "\n"
let data = Data(message.utf8)

let sent = DispatchSemaphore(value: 0)
connection.send(content: data, completion: .contentProcessed { error in
    if let error {
        fputs("send failed: \(error)\n", stderr)
        exit(1)
    }
    sent.signal()
})
sent.wait()

print("sent: \(message.dropLast())")
connection.cancel()
