import { useEffect, useState } from "react";

export function App() {
  const [messages, setMessages] = useState<string[]>([]);

  useEffect(() => {
    const ws = new WebSocket("ws://127.0.0.1:9001");
    ws.onmessage = (event) => {
      setMessages((prev) => [...prev, String(event.data)]);
    };
    return () => {
      ws.onmessage = null;
      if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
        ws.close();
      }
    };
  }, []);

  return (
    <main>
      {messages.length === 0 ? <p>待機中</p> : null}
      {messages.map((message, index) => (
        <div key={index}>{message}</div>
      ))}
    </main>
  );
}
