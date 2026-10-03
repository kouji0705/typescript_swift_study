# Swift から TypeScript へ送る、最小 TCP Socket 通信

Swift 側で作ったデータを、同じマシン上の TypeScript（Node.js）にリアルタイムで届けたい。HTTP や WebSocket まで持ち出す前に、まずは **TCP Socket の最小構成** を動かしてみる記事です。

このリポジトリの実装は次の役割分担です。

- **TypeScript**: TCP サーバー（受信して標準出力に出す）
- **Swift**: TCP クライアント（1通送って切断する）

方向は **Swift → TypeScript** だけです。双方向や再接続は後から足せます。

## なぜ TCP から始めるか

言語が違っても、TCP は「バイト列を順番どおり届ける」という共通の土台です。

- HTTP はリクエスト／レスポンスの約束が乗る
- WebSocket は握手とフレームが乗る
- **素の TCP** は接続と送受信だけ

まずは接続と送信が通ることを確認すると、あとで JSON や独自プロトコルを載せる場所がはっきりします。

今回の約束はこれだけです。

1. 接続先は `127.0.0.1:9000`
2. 中身は UTF-8 テキスト
3. 1メッセージは末尾に改行 `\n`

改行を区切りにすると、受信側は「1行＝1通」として扱えます。今回のサーバーはさらに単純で、届いたチャンクの末尾改行を外して表示するだけです。

## ディレクトリ構成

```
typescript_swift_study/
├── typescript/                 # Node.js TCP サーバー
│   ├── package.json
│   ├── tsconfig.json
│   └── src/server.ts
└── swift/                      # Swift Package のクライアント
    ├── Package.swift
    └── Sources/SocketClient/main.swift
```

macOS 前提です。TypeScript 側は Node.js、Swift 側は Swift 5.9 以上と macOS 13 以上を想定しています。

## TypeScript: 待ち受けサーバー

Node.js 標準の `net` モジュールだけで十分です。追加のソケットライブラリは使っていません。

実行用に `tsx` を入れ、`npm start` で TypeScript をそのまま起動します。

```typescript
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

server.listen(PORT, HOST, () => {
  console.log(`TypeScript TCP server listening on ${HOST}:${PORT}`);
});
```

ポイントは次の3つです。

**`net.createServer`**  
クライアントが接続するたびにコールバックが呼ばれ、その接続専用の `socket` が渡されます。

**`setEncoding("utf8")`**  
`data` イベントの中身を Buffer ではなく文字列として扱います。今回はテキストだけなのでこれで足ります。バイナリを扱うなら encoding は付けず Buffer のまま処理します。

**`listen` の順**  
サーバーを先に起動しないと、Swift 側は接続に失敗します。クライアントは「相手が待っている」ことが前提です。

`data` は「1回の `send` が必ず1回の `data` になる」わけではありません。TCP はストリームなので、分割や結合が起き得ます。最小実装では無視していますが、本番ではバッファに溜めて `\n` で切る、といった組み立てが必要です。

## Swift: 送って終わるクライアント

Swift は `Network` フレームワークの `NWConnection` を使います。POSIX の `socket()` よりも macOS / iOS らしい書き方です。

`Package.swift` は実行ファイル1つだけの最小構成です。

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

クライアント本体の流れは次のとおりです。

1. `127.0.0.1:9000` へ TCP 接続を作る
2. 状態が `.ready` になるまで待つ
3. コマンドライン引数（なければ `"hello from Swift"`）に `\n` を付けて送る
4. 送信完了後に切断する

接続は非同期なので、CLI では `DispatchSemaphore` で「準備完了」と「送信完了」を待っています。アプリ本体なら Combine や async/await に置き換えると読みやすくなります。

送信部分の核はこれです。

```swift
let connection = NWConnection(host: host, port: port, using: .tcp)
connection.start(queue: .global())
// ... ready 待ち ...

let message = (payload.isEmpty ? "hello from Swift" : payload) + "\n"
connection.send(content: Data(message.utf8), completion: .contentProcessed { error in
    // 失敗時は終了、成功時はシグナル
})
```

`using: .tcp` を忘れると、意図しないプロトコルになるので注意してください。文字列は `Data(message.utf8)` にしてから送ります。TypeScript 側の UTF-8 指定と揃えるためです。

## 動かしてみる

ターミナルを2つ用意します。**サーバーを先に**起動してください。

```bash
cd typescript
npm install   # 初回のみ
npm start
```

次のような行が出れば待ち受け中です。

```
TypeScript TCP server listening on 127.0.0.1:9000
```

別ターミナルでクライアントを実行します。

```bash
cd swift
swift run SocketClient
```

引数を付けると、その文言がそのまま送られます。

```bash
swift run SocketClient こんにちは
```

サーバー側の例です。

```
connected: 127.0.0.1:xxxxx
[127.0.0.1:xxxxx] こんにちは
disconnected: 127.0.0.1:xxxxx
```

Swift 側には `sent: こんにちは` と出ます。接続 → 1通 → 切断、までが一巡です。

`connect failed` になる典型例は、サーバーがまだ起動していないか、ポート番号が食い違っていることです。両方 `9000` を見ているか確認してください。

## この最小実装で分かること

- 言語が違っても、TCP と UTF-8 さえ合意すれば届く
- サーバーは「待って、読んで、ログする」だけで成立する
- クライアントは「つなぐ、書く、切る」だけで成立する

逆に、まだやっていないこともはっきりしています。

- TypeScript から Swift への返信
- 接続の維持と再接続
- JSON などのメッセージ形式
- ファイアウォールや別マシン（LAN）越え
- iOS アプリからの送信（ATS やローカルネットワーク権限）

次の一歩としては、サーバーが受け取った文字列をそのまま `socket.write` で返す echo が分かりやすいです。Swift 側で `receive` を足せば、往復が目に見えるようになります。

## まとめ

Swift の `NWConnection` と Node.js の `net.Server` を、同じホストの同じポートでつなぐだけで、言語をまたいだ Socket 通信は始まります。

まずはこの「1通送って、ログに出る」状態を手元で再現し、その上にメッセージ形式を載せていくのが近道です。
