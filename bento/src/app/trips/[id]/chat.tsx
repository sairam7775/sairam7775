"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { BentoMark } from "@/components/logo";
import { BentoLoader } from "@/components/loading";
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
  // proposal. Skipped mid-turn, when the server doesn't have the turn yet;
  // once a turn is done both its messages are stored, so the server's list
  // is complete. (Keeping local "u-" copies here duplicated the traveller's
  // message: it never gets its server id, so it was always "in flight".)
  useEffect(() => {
    if (busyRef.current) return;
    setMessages(initial);
  }, [initial]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const [activity, setActivity] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const list = useRef<HTMLDivElement>(null);
  const field = useRef<HTMLTextAreaElement>(null);
  // Follow new text only while the traveller is at the bottom; someone
  // scrolled up to re-read a proposal shouldn't be yanked back down.
  // Scrolls the conversation itself — scrollIntoView moved the whole page.
  const pinned = useRef(true);

  useEffect(() => {
    const el = list.current;
    if (el && pinned.current) el.scrollTop = el.scrollHeight;
  }, [messages, activity, error]);

  // The box grows with what's typed, up to a few lines, then scrolls.
  useEffect(() => {
    const el = field.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, [input]);

  async function send(e: FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || busy) return;
    setInput("");
    setError(null);
    setBusy(true);
    pinned.current = true;
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
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setMessages((m) => m.filter((x) => x.id !== draftId || x.content));
      // A refusal before the turn started (throttle, spend cap) never stored
      // the message; give the words back rather than lose them.
      setInput((current) => current || text);
    } finally {
      setActivity(null);
      busyRef.current = false;
      setBusy(false);
      // Refresh on every outcome, after busy clears, so the sync effect
      // above applies it. An Accept clicked mid-turn re-rendered the page
      // while we were busy and was skipped; this brings it back in, success
      // or failure.
      router.refresh();
    }
  }

  // Back to the box once a reply lands, so the next question can follow.
  // Not on first load: that would pop the keyboard up on a phone.
  const sentOnce = useRef(false);
  useEffect(() => {
    if (busy) sentOnce.current = true;
    else if (sentOnce.current) field.current?.focus();
  }, [busy]);

  const examples = [
    "Ten nights in November, first time, we like temples and food, no hiking.",
    "Suggest a route",
    "Plan my days",
  ];

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center gap-3 border-b border-rule px-4 py-3">
        <BentoMark size={28} />
        <div className="min-w-0">
          <h2 className="text-[1rem] font-bold leading-tight">Bento Man</h2>
          <p className="truncate text-[0.8rem] text-ink-3">Plans the trip with you. Nothing changes until you accept it.</p>
        </div>
      </div>

      <div
        ref={list}
        onScroll={(e) => {
          const el = e.currentTarget;
          pinned.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
        }}
        className="min-h-0 flex-1 space-y-5 overflow-y-auto overscroll-contain px-4 py-4"
        aria-busy={busy}
      >
        {messages.length === 0 && (
          <div className="up rounded-tile bg-sunk px-5 py-5 text-[0.95rem] leading-relaxed text-ink-2">
            <p>Tell Bento Man what kind of trip this is. Dates and how many nights are the useful first thing; the rest can come as you go.</p>
            <p className="mt-4 text-[0.8rem] font-medium text-ink-3">Try one of these</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {examples.map((x) => (
                <button
                  key={x}
                  type="button"
                  onClick={() => {
                    setInput(x);
                    field.current?.focus();
                  }}
                  className="min-h-9 rounded-full border border-rule bg-surface px-3 py-1.5 text-left text-[0.85rem] text-ink hover:border-ink/30"
                >
                  {x}
                </button>
              ))}
            </div>
          </div>
        )}
        {messages.map((m) =>
          m.role === "user" ? (
            <div key={m.id} className="flex justify-end">
              <p className="max-w-[85%] whitespace-pre-wrap break-words rounded-tile rounded-br-md bg-lacquer px-4 py-2.5 text-[0.95rem] leading-relaxed text-rice">{m.content}</p>
            </div>
          ) : (
            <div key={m.id} className="flex gap-3">
              <span className="mt-0.5 shrink-0"><BentoMark size={24} /></span>
              <div className="min-w-0 flex-1">
                {m.content ? (
                  <p className="whitespace-pre-wrap break-words text-[0.95rem] leading-relaxed">{m.content}</p>
                ) : (
                  <Working label={activity ?? "Thinking"} />
                )}
                {m.content && activity && busy && m.id.startsWith("a-") && <Working label={activity} className="mt-2" />}
                {m.proposal && m.status && <ProposalCard tripId={tripId} messageId={m.id} proposal={m.proposal} status={m.status} />}
              </div>
            </div>
          ),
        )}
        {error && (
          <p role="alert" className="rounded-r-lg border-l-[3px] border-ume bg-ume-soft px-4 py-2.5 text-[0.9rem] text-ink-2">
            {error}
          </p>
        )}
      </div>

      <form onSubmit={send} className="border-t border-rule bg-surface px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <div className="flex items-end gap-2">
          <label htmlFor="chat-input" className="sr-only">Message Bento Man</label>
          <textarea
            id="chat-input"
            ref={field}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                e.currentTarget.form?.requestSubmit();
              }
            }}
            rows={1}
            placeholder={busy ? "Bento Man is answering…" : "Ask Bento Man…"}
            readOnly={busy}
            className="min-h-11 flex-1 resize-none rounded-tile border border-rule bg-paper px-4 py-2.5 text-[0.95rem] leading-snug read-only:opacity-60"
          />
          <button type="submit" disabled={busy || !input.trim()} className="h-11 shrink-0 rounded-full bg-accent px-5 text-[0.9rem] font-medium text-white hover:bg-accent-deep disabled:opacity-50">
            Send
          </button>
        </div>
        <p className="mt-1.5 hidden text-[0.75rem] text-ink-3 sm:block">Enter to send · Shift + Enter for a new line</p>
      </form>
    </div>
  );
}

/** What Bento Man is doing right now, in words. */
function Working({ label, className = "" }: { label: string; className?: string }) {
  return (
    <p className={`flex items-center gap-2 text-[0.85rem] text-ink-3 ${className}`}>
      <BentoLoader size={18} label={label} />
      {label[0].toUpperCase() + label.slice(1)}…
    </p>
  );
}
