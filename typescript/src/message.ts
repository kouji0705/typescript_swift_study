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
