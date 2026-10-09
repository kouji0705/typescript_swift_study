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
