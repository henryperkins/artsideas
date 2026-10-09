import { createDraft, type Draft, type Session } from "@/lib/domain/domain";

export function shortDate(date: string): string {
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" }).format(new Date(`${date}T12:00:00Z`));
}
export function fullDate(date: string): string {
  return new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric", timeZone: "UTC" }).format(new Date(`${date}T12:00:00Z`));
}
export function capturedAt(date: string): string {
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: "America/Chicago", timeZoneName: "short" }).format(new Date(date));
}
export function sampleDraft(session: Session): Draft {
  const letterpress = /Analog Intelligence/i.test(session.title);
  const text = letterpress
    ? "Before the prompt, there was movable type.\n\nJoseph Makkos leads a hands-on letterpress workshop at the New Orleans Arts & Ideas Festival. Work with type and ink, and leave with a print of your own."
    : session.topicSummary
      ? `${session.topicSummary}\n\nExplore the idea with ${session.speaker ?? "the festival community"} at the New Orleans Arts & Ideas Festival.`
      : "Curiosity starts with a conversation.\n\nExplore the program at the New Orleans Arts & Ideas Festival.";
  return createDraft(session, {
    id: crypto.randomUUID(), platform: "linkedin", angle: "hands-on", editorialText: text,
    altText: "Typographic festival graphic on warm paper with bold lettering and geometric accents.",
    includeDate: !session.conflicts.some(c => c.field === "date"), includeTime: false, includeLocation: false,
  });
}
export function downloadFile(name: string, value: string, type = "text/plain;charset=utf-8"): void {
  const url = URL.createObjectURL(new Blob([value], { type }));
  const a = document.createElement("a"); a.href = url; a.download = name; a.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export async function request<T>(url: string, body?: unknown): Promise<T> {
  const response = await fetch(url, {
    method: body === undefined ? "GET" : "POST",
    headers: body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  let result: unknown;
  try { result = await response.json(); } catch { throw new Error("The workspace returned an unreadable response. Try again."); }
  if (!response.ok) {
    const error = result as { error?: string; code?: string; issues?: { message: string }[] };
    throw new Error(error.issues?.length ? error.issues.map(i => i.message).join(" ") : error.error ?? `Request failed (${response.status}).`);
  }
  return result as T;
}
