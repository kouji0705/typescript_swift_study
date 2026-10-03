import net from "node:net";

const HOST = "127.0.0.1";
const PORT = 9000;

const server = net.createServer((socket) => {
  const peer = `${socket.remoteAddress}:${socket.remotePort}`;
  console.log(`connected: ${peer}`);

  socket.setEncoding("utf8");

  socket.on("data", (chunk) => {
    const text = String(chunk).replace(/\n$/, "");
    console.log(`[${peer}] ${text}`);
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

server.listen(PORT, HOST, () => {
  console.log(`TypeScript TCP server listening on ${HOST}:${PORT}`);
});
