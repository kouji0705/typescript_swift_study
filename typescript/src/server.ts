import net from "node:net";
import { WebSocketServer, WebSocket } from "ws";

const HOST = "127.0.0.1";
const TCP_PORT = 9000;
const WS_PORT = 9001;

const wss = new WebSocketServer({ host: HOST, port: WS_PORT });

wss.on("listening", () => {
  console.log(`WebSocket listening on ws://${HOST}:${WS_PORT}`);
});

function broadcast(text: string) {
  for (const client of wss.clients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(text);
    }
  }
}

const server = net.createServer((socket) => {
  const peer = `${socket.remoteAddress}:${socket.remotePort}`;
  console.log(`connected: ${peer}`);

  socket.setEncoding("utf8");

  socket.on("data", (chunk) => {
    const text = String(chunk).replace(/\n$/, "");
    console.log(`[${peer}] ${text}`);
    broadcast(text);
  });

  socket.on("end", () => {
    console.log(`disconnected: ${peer}`);
  });

  socket.on("error", (err) => {
    console.error(`socket error (${peer}):`, err.message);
  });
});

server.on("error", (err) => {
  console.error("server error:", err.message);
  process.exit(1);
});

server.listen(TCP_PORT, HOST, () => {
  console.log(`TCP listening on ${HOST}:${TCP_PORT}`);
});
