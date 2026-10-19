"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { BentoManFigure } from "@/components/mascot/figure";
import type { Proposal } from "@/lib/bento-man/diff";
import { ProposalCard, type ProposalStatus } from "./proposal-card";
import { copy } from "@/copy";
import { reasonOf, track } from "@/lib/analytics/client";
import { starterKey } from "@/lib/trips/guided-start";

const t = copy.chat;

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  proposal: Proposal | null;
  status: ProposalStatus | null;
}

const TOOL_LABEL: Record<string, string> = t.tools;

type Event =
  | { type: "text"; delta: string }
  | { type: "tool"; name: string; phase: "start" | "end"; ok: boolean }
  | { type: "done"; messageId: string | null; text: string; proposal: Proposal | null }
  | { type: "error"; message: string };

/** `ask` arrives from a gap card's "Ask Bento Man": it starts in the box,
 *  ready to send or edit — never sent on the traveller's behalf. */
export function Chat({ tripId, cityNames, initial, ask }: { tripId: string; cityNames: Record<string, string>; initial: ChatMessage[]; ask?: string }) {
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
  const [input, setInput] = useState(ask ?? "");
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

  // A trip started from "Plan a Japan trip" leaves its first message in the
  // tab's session storage (lib/trips/guided-start.ts): it goes in the box,
  // once, ready to send or edit, never sent for the traveller. Set in a
  // frame, not the effect body; storage can be off, which just skips it.
  useEffect(() => {
    if (ask || initial.length > 0) return;
    // Read and removed together in the frame, so an effect run twice in
    // development doesn't lose it.
    const frame = requestAnimationFrame(() => {
      try {
        const text = sessionStorage.getItem(starterKey(tripId));
        if (!text) return;
        setInput(text);
        sessionStorage.removeItem(starterKey(tripId));
      } catch {
        // Storage off (a private window): the box simply starts empty.
      }
    });
    return () => cancelAnimationFrame(frame);
    // Only on arrival: a later re-render must not put it back.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // A conversation mounted out of sight (the phone's closed sheet) has no
  // height to scroll to the bottom of. When it appears, or its box changes
  // size, show the latest message, unless the traveller had scrolled up.
  useEffect(() => {
    const el = list.current;
    if (!el) return;
    const resized = new ResizeObserver(() => {
      if (pinned.current) el.scrollTop = el.scrollHeight;
    });
    resized.observe(el);
    return () => resized.disconnect();
  }, []);

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
    // Analytics: how long, which tools, what came back. Never the text.
    const sentAt = performance.now();
    const tools: string[] = [];
    track("bento_man_message_sent", { first: messages.length === 0, chars: text.length });

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tripId, message: text }),
      });
      if (!res.ok || !res.body) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? t.noAnswer(res.status));
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
            setActivity(ev.phase === "start" ? (TOOL_LABEL[ev.name] ?? t.working) : null);
            if (ev.phase === "end") tools.push(ev.ok ? ev.name : `${ev.name}:failed`);
            if (ev.phase === "end" && content) content += "\n\n";
          } else if (ev.type === "done") {
            patch({ id: ev.messageId ?? draftId, content: ev.text, proposal: ev.proposal, status: ev.proposal ? "proposed" : null });
            track("bento_man_replied", {
              ms: Math.round(performance.now() - sentAt),
              tools,
              proposal: Boolean(ev.proposal),
              proposal_route: Boolean(ev.proposal?.route),
              proposal_dates: Boolean(ev.proposal?.dates),
              proposal_days: ev.proposal?.days.length ?? 0,
            });
          } else if (ev.type === "error") {
            throw new Error(ev.message);
          }
        }
      }
    } catch (err) {
      track("bento_man_failed", {
        ms: Math.round(performance.now() - sentAt),
        reason: err instanceof TypeError ? "offline" : err instanceof Error ? reasonOf(err.message, copy.server) : "other",
        tools,
      });
      // fetch() rejects with a TypeError when the network itself failed.
      setError(
        err instanceof TypeError
          ? t.offline
          : err instanceof Error
            ? err.message
            : t.failed,
      );
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

  const examples = Object.values(t.examples);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center gap-3 border-b border-rule px-4 py-3 pr-20 lg:pr-4">
        <BentoManFigure figure="head-rest" size={28} />
        <div className="min-w-0">
          <h2 id="bento-man-title" className="text-[1rem] font-bold leading-tight">{t.name}</h2>
          <p className="truncate text-[0.8rem] text-ink-3">{t.tagline}</p>
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
            <div className="flex items-start gap-4">
              <BentoManFigure figure="full-hello" size={88} />
              <p>{t.intro}</p>
            </div>
            <p className="mt-4 text-[0.8rem] font-medium text-ink-3">{t.tryThese}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {examples.map((x) => (
                <button
                  key={x}
                  type="button"
                  onClick={() => {
                    setInput(x);
                    track("bento_man_example_used", { example: Object.entries(t.examples).find(([, v]) => v === x)?.[0] ?? "other" });
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
              <span className="mt-0.5 shrink-0"><BentoManFigure figure="head-rest" size={24} /></span>
              <div className="min-w-0 flex-1">
                {m.content ? (
                  <p className="whitespace-pre-wrap break-words text-[0.95rem] leading-relaxed">{m.content}</p>
                ) : (
                  <Working label={activity ?? t.thinking} />
                )}
                {m.content && activity && busy && m.id.startsWith("a-") && <Working label={activity} className="mt-2" />}
                {m.proposal && m.status && <ProposalCard tripId={tripId} messageId={m.id} proposal={m.proposal} status={m.status} cityNames={cityNames} />}
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
          <label htmlFor="chat-input" className="sr-only">{t.inputLabel}</label>
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
            placeholder={busy ? t.answering : t.placeholder}
            readOnly={busy}
            className="min-h-11 flex-1 resize-none rounded-tile border border-rule bg-paper px-4 py-2.5 text-[0.95rem] leading-snug read-only:opacity-60"
          />
          <button type="submit" disabled={busy || !input.trim()} className="h-11 shrink-0 rounded-full bg-accent px-5 text-[0.9rem] font-medium text-on-accent hover:bg-accent-deep disabled:opacity-50">
            {t.send}
          </button>
        </div>
        <p className="mt-1.5 hidden text-[0.75rem] text-ink-3 sm:block">{t.keys}</p>
        <p className="mt-1 text-[0.72rem] leading-snug text-ink-3">{t.trust}</p>
      </form>
    </div>
  );
}

/** What Bento Man is doing right now, in words, with him thinking beside it.
 *  The words are the live region; the figure is decoration. */
function Working({ label, className = "" }: { label: string; className?: string }) {
  return (
    <p role="status" aria-live="polite" className={`flex items-center gap-2 text-[0.85rem] text-ink-3 ${className}`}>
      <BentoManFigure figure="head-think" size={20} />
      {label}…
    </p>
  );
}
