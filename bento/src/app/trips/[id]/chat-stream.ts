import type { Proposal } from "@/lib/bento-man/diff";

/** What /api/chat streams for one turn (route.ts). */
export type ChatStreamEvent =
  | { type: "text"; delta: string }
  | { type: "tool"; name: string; phase: "start" | "end"; ok: boolean }
  /** Replaces everything streamed so far. Sent when a model call is refused,
   *  before the reply is saved, so a failed save can't leave refused text
   *  on screen. */
  | { type: "replace"; text: string }
  | { type: "done"; messageId: string | null; text: string; proposal: Proposal | null }
  | { type: "error"; message: string };

/** The reply on screen after one event, before "done" settles it. */
export function nextContent(content: string, ev: ChatStreamEvent): string {
  if (ev.type === "text") return content + ev.delta;
  if (ev.type === "replace") return ev.text;
  if (ev.type === "tool" && ev.phase === "end" && content) return `${content}\n\n`;
  return content;
}
