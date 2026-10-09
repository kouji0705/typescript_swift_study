import type { Message } from "./message";

export function MessageView({ message }: { message: Message }) {
  if (message.kind === "image") {
    return <img src={`data:${message.mime};base64,${message.data}`} alt="" />;
  }
  return <div>{message.text}</div>;
}
