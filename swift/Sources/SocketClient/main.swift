let message = Payload.fromCommandLine()
WebSocketClient.send(message.json)
print("sent: \(message.summary)")
