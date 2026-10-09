# Swift と React を WebSocket でつなぐ

## はじめに

Swift からテキストと画像を送り、React で追記表示する最小構成です。ブラウザは生 TCP を扱えないので、通信はすべて WebSocket に揃えています。

```
Swift --WebSocket--> Node :9001 --WebSocket--> React :5173
```

メッセージは 1 フレーム 1 通の JSON です。

```json
{"type":"text","text":"こんにちは"}
{"type":"image","mime":"image/png","data":"..."}
```

起動は次のとおりです。

```bash
cd typescript && npm run dev
```

```bash
cd swift
swift run SocketClient こんにちは
swift run SocketClient ../samples/venusaur.png
swift run SocketClient ../samples/charizard.png
swift run SocketClient ../samples/blastoise.png
```

表示は `http://127.0.0.1:5173/` です。

## 成果物

![ws_image.gif](https://qiita-image-store.s3.ap-northeast-1.amazonaws.com/0/599049/cfaacde1-1579-47d2-af87-181909ffac60.gif)

## ディレクトリ構成

```
typescript_swift_study/
├── samples/
│   ├── venusaur.png
│   ├── charizard.png
│   └── blastoise.png
├── swift/
│   ├── Package.swift
│   └── Sources/SocketClient/
│       ├── main.swift
│       ├── Payload.swift
│       ├── Message.swift
│       └── WebSocketClient.swift
└── typescript/
    ├── package.json
    ├── tsconfig.json
    ├── src/
    │   ├── server.ts
    │   ├── config.ts
    │   ├── message.ts
    │   └── relay.ts
    └── web/
        ├── index.html
        ├── tsconfig.json
        ├── vite.config.ts
        └── src/
            ├── main.tsx
            ├── App.tsx
            ├── useMessages.ts
            ├── message.ts
            ├── MessageView.tsx
            ├── config.ts
            └── styles.css
```

## コード

### Swift

`main.swift` は起動だけです。引数の解釈、JSON 化、送信は分けています。

`swift/Package.swift`

```swift
// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "SocketClient",
    platforms: [.macOS(.v13)],
    targets: [
        .executableTarget(name: "SocketClient")
    ]
)
```

`swift/Sources/SocketClient/main.swift`

```swift
let message = Payload.fromCommandLine()
WebSocketClient.send(message.json)
print("sent: \(message.summary)")
```

`swift/Sources/SocketClient/Payload.swift`

```swift
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
```

`swift/Sources/SocketClient/Message.swift`

```swift
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
```

`swift/Sources/SocketClient/WebSocketClient.swift`

```swift
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
```

### Node（中継）

受け取ったフレームを、送り主以外へ broadcast します。

`typescript/package.json`

```json
{
  "name": "socket-server",
  "private": true,
  "type": "module",
  "scripts": {
    "start": "tsx src/server.ts",
    "web": "vite --config web/vite.config.ts",
    "dev": "concurrently -k \"npm:start\" \"npm:web\""
  },
  "dependencies": {
    "react": "^19.1.1",
    "react-dom": "^19.1.1",
    "ws": "^8.18.3"
  },
  "devDependencies": {
    "@types/node": "^22.18.8",
    "@types/react": "^19.1.13",
    "@types/react-dom": "^19.1.9",
    "@types/ws": "^8.18.1",
    "@vitejs/plugin-react": "^5.0.4",
    "concurrently": "^9.2.1",
    "tsx": "^4.20.6",
    "typescript": "^5.9.3",
    "vite": "^7.1.7"
  }
}
```

`typescript/tsconfig.json`

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "types": ["node"],
    "skipLibCheck": true
  },
  "include": ["src"]
}
```

`typescript/src/server.ts`

```ts
import { startRelay } from "./relay.js";

startRelay();
```

`typescript/src/config.ts`

```ts
export const HOST = "127.0.0.1";
export const WS_PORT = 9001;
export const MAX_PAYLOAD = 20 * 1024 * 1024;
```

`typescript/src/message.ts`

```ts
export function summarize(raw: string): string {
  try {
    const parsed = JSON.parse(raw) as {
      type?: string;
      text?: string;
      mime?: string;
      data?: string;
    };
    if (parsed.type === "image") {
      return `image ${parsed.mime ?? ""} (${parsed.data?.length ?? 0} chars b64)`;
    }
    if (parsed.type === "text") {
      return parsed.text ?? "";
    }
  } catch {
    // keep raw
  }
  return raw;
}
```

`typescript/src/relay.ts`

```ts
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
```

### React（表示）

受信した JSON を解釈し、テキストと画像を追記します。

`typescript/web/index.html`

```html
<!doctype html>
<html lang="ja">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>messages</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

`typescript/web/tsconfig.json`

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "jsx": "react-jsx",
    "strict": true,
    "skipLibCheck": true,
    "types": ["vite/client"]
  },
  "include": ["src", "vite.config.ts"]
}
```

`typescript/web/vite.config.ts`

```ts
import path from "node:path";
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const root = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  root,
  plugins: [react()],
  server: {
    host: "127.0.0.1",
    port: 5173,
  },
});
```

`typescript/web/src/main.tsx`

```tsx
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import "./styles.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
```

`typescript/web/src/App.tsx`

```tsx
import { MessageView } from "./MessageView";
import { useMessages } from "./useMessages";

export function App() {
  const messages = useMessages();

  return (
    <main>
      {messages.length === 0 ? <p>待機中</p> : null}
      {messages.map((message, index) => (
        <MessageView key={index} message={message} />
      ))}
    </main>
  );
}
```

`typescript/web/src/useMessages.ts`

```ts
import { useEffect, useState } from "react";
import { WS_URL } from "./config";
import { parseMessage, type Message } from "./message";

export function useMessages() {
  const [messages, setMessages] = useState<Message[]>([]);

  useEffect(() => {
    const ws = new WebSocket(WS_URL);
    ws.onmessage = (event) => {
      setMessages((prev) => [...prev, parseMessage(String(event.data))]);
    };
    return () => {
      ws.onmessage = null;
      if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
        ws.close();
      }
    };
  }, []);

  return messages;
}
```

`typescript/web/src/message.ts`

```ts
export type Message =
  | { kind: "text"; text: string }
  | { kind: "image"; mime: string; data: string };

export function parseMessage(raw: string): Message {
  try {
    const parsed = JSON.parse(raw) as {
      type?: string;
      text?: string;
      mime?: string;
      data?: string;
    };
    if (parsed.type === "image" && parsed.data) {
      return { kind: "image", mime: parsed.mime ?? "image/png", data: parsed.data };
    }
    if (parsed.type === "text") {
      return { kind: "text", text: parsed.text ?? "" };
    }
  } catch {
    // keep as plain text
  }
  return { kind: "text", text: raw };
}
```

`typescript/web/src/MessageView.tsx`

```tsx
import type { Message } from "./message";

export function MessageView({ message }: { message: Message }) {
  if (message.kind === "image") {
    return <img src={`data:${message.mime};base64,${message.data}`} alt="" />;
  }
  return <div>{message.text}</div>;
}
```

`typescript/web/src/config.ts`

```ts
export const WS_URL = "ws://127.0.0.1:9001";
```

`typescript/web/src/styles.css`

```css
:root {
  color-scheme: light;
}

body {
  margin: 1rem;
  color: #111;
  background: #fff;
  font-family: sans-serif;
}

img {
  max-width: 320px;
  height: auto;
  display: block;
  margin: 0.5rem 0;
}
```
