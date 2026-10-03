# Swift → TypeScript → React

ブラウザは TCP を扱えないので、Node が TCP 受信を WebSocket に中継し、React が追記表示する。

```
Swift --TCP:9000--> Node --WS:9001--> React :5173
```

## ディレクトリ

```
typescript_swift_study/
├── swift/
│   ├── Package.swift
│   └── Sources/SocketClient/main.swift
└── typescript/
    ├── package.json
    ├── src/server.ts
    └── web/
        ├── index.html
        ├── vite.config.ts
        └── src/
            ├── main.tsx
            └── App.tsx
```

## コード

### Swift（送信）

`NWConnection` で `127.0.0.1:9000` へ UTF-8 + `\n` を1通送る。

```swift
let connection = NWConnection(host: "127.0.0.1", port: 9000, using: .tcp)
connection.start(queue: .global())
// ready 待ち
let message = payload + "\n"
connection.send(content: Data(message.utf8), completion: .contentProcessed { _ in })
connection.cancel()
```

### TypeScript（中継）

TCP で受け取り、接続中の WebSocket へ同じ文言を broadcast する。

```typescript
import net from "node:net";
import { WebSocketServer, WebSocket } from "ws";

const wss = new WebSocketServer({ host: "127.0.0.1", port: 9001 });

function broadcast(text: string) {
  for (const client of wss.clients) {
    if (client.readyState === WebSocket.OPEN) client.send(text);
  }
}

net.createServer((socket) => {
  socket.setEncoding("utf8");
  socket.on("data", (chunk) => {
    broadcast(String(chunk).replace(/\n$/, ""));
  });
}).listen(9000, "127.0.0.1");
```

### React（表示）

受信した行を配列へ追記する。

```tsx
const [messages, setMessages] = useState<string[]>([]);

useEffect(() => {
  const ws = new WebSocket("ws://127.0.0.1:9001");
  ws.onmessage = (event) => {
    setMessages((prev) => [...prev, String(event.data)]);
  };
  return () => ws.close();
}, []);

return (
  <main>
    {messages.length === 0 ? <p>待機中</p> : null}
    {messages.map((message, index) => (
      <div key={index}>{message}</div>
    ))}
  </main>
);
```

## 実行

```bash
cd typescript && npm run dev
cd swift && swift run SocketClient こんにちは
```

表示は `http://127.0.0.1:5173/`。
