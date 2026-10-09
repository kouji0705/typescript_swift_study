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
