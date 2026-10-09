import { WebSocketServer, WebSocket } from "ws";
import { HOST, MAX_PAYLOAD, WS_PORT } from "./config.js";
import { summarize } from "./message.js";

function broadcast(wss: WebSocketServer, text: string, except: WebSocket) {
  for (const client of wss.clients) {
    if (client !== except && client.readyState === WebSocket.OPEN) {
      client.send(text);
    }
  }
}

export function startRelay() {
  const wss = new WebSocketServer({ host: HOST, port: WS_PORT, maxPayload: MAX_PAYLOAD });

  wss.on("listening", () => {
    console.log(`WebSocket listening on ws://${HOST}:${WS_PORT}`);
  });

  wss.on("connection", (socket, request) => {
    const peer = request.socket.remoteAddress ?? "unknown";
    console.log(`connected: ${peer}`);

    socket.on("message", (data) => {
      const text = String(data);
      console.log(`[${peer}] ${summarize(text)}`);
      broadcast(wss, text, socket);
    });

    socket.on("close", () => {
      console.log(`disconnected: ${peer}`);
    });

    socket.on("error", (err) => {
      console.error(`socket error (${peer}):`, err.message);
    });
  });
}
