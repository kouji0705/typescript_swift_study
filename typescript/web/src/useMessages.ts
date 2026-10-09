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
