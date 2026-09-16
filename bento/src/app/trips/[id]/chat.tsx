"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { BentoMark } from "@/components/logo";
import type { Proposal } from "@/lib/bento-man/diff";
import { ProposalCard, type ProposalStatus } from "./proposal-card";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  proposal: Proposal | null;
  status: ProposalStatus | null;
}

const TOOL_LABEL: Record<string, string> = {
  set_preferences: "noting that down",
  set_trip_dates: "setting the dates",
  assess_route: "checking the route",
  propose_route: "laying out the route",
  suggest_route: "thinking about the route",
  plan_days: "planning the days",
  replan_day: "re-planning the day",
  get_place: "looking that up",
  route_between: "checking the trains",
};

type Event =
  | { type: "text"; delta: string }
  | { type: "tool"; name: string; phase: "start" | "end"; ok: boolean }
  | { type: "done"; messageId: string | null; text: string; proposal: Proposal | null }
  | { type: "error"; message: string };

export function Chat({ tripId, initial }: { tripId: string; initial: ChatMessage[] }) {
  const router = useRouter();
  const [messages, setMessages] = useState<ChatMessage[]>(initial);
  // The server is the truth for a proposal's status. After Accept or
  // Reject the page re-renders with a new `initial`; without this the card
  // keeps its buttons and a second click hits an already-answered
  // proposal. An in-flight turn is kept: it has no server row yet.
  useEffect(() => {
    if (busyRef.current) return;
    setMessages((local) => {
      const ids = new Set(initial.map((m) => m.id));
      const inFlight = local.filter((m) => !ids.has(m.id) && (m.id.startsWith("u-") || m.id.startsWith("a-")));
      return [...initial, ...inFlight];
    });
  }, [initial]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const [activity, setActivity] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const bottom = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottom.current?.scrollIntoView({ block: "end" });
  }, [messages, activity]);

  async function send(e: FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || busy) return;
    setInput("");
    setError(null);
    setBusy(true);
    busyRef.current = true;
    const userId = `u-${Date.now()}`;
    const draftId = `a-${Date.now()}`;
    setMessages((m) => [
      ...m,
      { id: userId, role: "user", content: text, proposal: null, status: null },
      { id: draftId, role: "assistant", content: "", proposal: null, status: null },
    ]);
    const patch = (p: Partial<ChatMessage>) => setMessages((m) => m.map((x) => (x.id === draftId ? { ...x, ...p } : x)));

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tripId, message: text }),
      });
      if (!res.ok || !res.body) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `Bento Man didn't answer (${res.status}).`);
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let content = "";
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let idx;
        while ((idx = buffer.indexOf("\n\n")) >= 0) {
          const line = buffer.slice(0, idx).trim();
          buffer = buffer.slice(idx + 2);
          if (!line.startsWith("data: ")) continue;
          const ev = JSON.parse(line.slice(6)) as Event;
          if (ev.type === "text") {
            content += ev.delta;
            patch({ content });
          } else if (ev.type === "tool") {
            setActivity(ev.phase === "start" ? (TOOL_LABEL[ev.name] ?? "working") : null);
            if (ev.phase === "end" && content) content += "\n\n";
          } else if (ev.type === "done") {
            patch({ id: ev.messageId ?? draftId, content: ev.text, proposal: ev.proposal, status: ev.proposal ? "proposed" : null });
          } else if (ev.type === "error") {
            throw new Error(ev.message);
          }
        }
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setMessages((m) => m.filter((x) => x.id !== draftId || x.content));
    } finally {
      setActivity(null);
      busyRef.current = false;
      setBusy(false);
    }
  }

  return (
    <div className="flex h-full min-h-[60vh] flex-col">
      <div className="flex-1 space-y-5 overflow-y-auto px-1 py-2">
        {messages.length === 0 && (
          <div className="up rounded-tile bg-sunk px-5 py-6 text-[0.92rem] text-ink-2">
            <p>Tell Bento Man what kind of trip this is. Dates and how many nights are the useful first thing; the rest can come as you go.</p>
            <p className="mt-2 mono text-[0.7rem] text-ink-3">Try: “Ten nights in November, first time, we like temples and food, no hiking.”</p>
          </div>
        )}
        {messages.map((m) =>
          m.role === "user" ? (
            <div key={m.id} className="flex justify-end">
              <p className="max-w-[85%] whitespace-pre-wrap rounded-tile rounded-br-md bg-lacquer px-4 py-2.5 text-[0.92rem] leading-relaxed text-rice">{m.content}</p>
            </div>
          ) : (
            <div key={m.id} className="flex gap-3">
              <span className="mt-1 shrink-0"><BentoMark size={22} /></span>
              <div className="min-w-0 max-w-[92%] flex-1">
                {m.content ? (
                  <p className="whitespace-pre-wrap text-[0.95rem] leading-relaxed">{m.content}</p>
                ) : (
                  <p className="mono text-[0.72rem] text-ink-3">{activity ?? "thinking"}…</p>
                )}
                {m.content && activity && busy && m.id.startsWith("a-") && (
                  <p className="mono mt-2 text-[0.68rem] text-ink-3">{activity}…</p>
                )}
                {m.proposal && m.status && <ProposalCard tripId={tripId} messageId={m.id} proposal={m.proposal} status={m.status} />}
              </div>
            </div>
          ),
        )}
        {error && <p className="border-l-[3px] border-ume bg-ume-soft px-4 py-2.5 text-[0.85rem] text-ink-2">{error}</p>}
        <div ref={bottom} />
      </div>

      <form onSubmit={send} className="sticky bottom-0 mt-3 flex items-end gap-2 border-t border-rule bg-surface pt-3 pb-[env(safe-area-inset-bottom,0px)]">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              e.currentTarget.form?.requestSubmit();
            }
          }}
          rows={2}
          placeholder="Ask Bento Man…"
          disabled={busy}
          className="min-h-[2.75rem] flex-1 resize-none rounded-tile border border-rule bg-paper px-4 py-2.5 text-[0.95rem] disabled:opacity-60"
        />
        <button type="submit" disabled={busy || !input.trim()} className="rounded-full bg-accent px-5 py-2.5 text-[0.9rem] font-medium text-white hover:bg-accent-deep disabled:opacity-50">
          Send
        </button>
      </form>
    </div>
  );
}
