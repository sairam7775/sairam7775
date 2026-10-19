"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore, useTransition, type CSSProperties, type KeyboardEvent } from "react";
import { createPortal } from "react-dom";
import { markTourSeen } from "./actions";
import { TOURS, type TourId } from "./steps";
import { copy } from "@/copy";
import { PAD, placeCard, type Box } from "./place";
import { BentoManFigure } from "@/components/mascot/figure";

const CARD_W = 360;
const noSubscribe = () => () => {};

/** A spotlight tour. It starts by itself the first time a page is opened
 *  (`seen` comes from a cookie, read on the server); Settings → "Show the
 *  tour again" clears the cookie to replay it. Esc skips; arrow keys step. It dims with a plain box-shadow,
 *  not a filter, so nothing re-rasterises behind it. */
export function Tour({ id, seen }: { id: TourId; seen: boolean }) {
  const steps = TOURS[id];
  const [open, setOpen] = useState(!seen);
  const [i, setI] = useState(0);
  const [box, setBox] = useState<Box | null>(null);
  const [cardH, setCardH] = useState(190);
  const [, start] = useTransition();
  const card = useRef<HTMLDivElement>(null);
  const step = steps[i];
  // The overlay is portalled to <body>, which exists only in the browser.
  const mounted = useSyncExternalStore(noSubscribe, () => true, () => false);

  const close = useCallback(() => {
    setOpen(false);
    setI(0);
    start(() => markTourSeen(id));
  }, [id]);

  // Follow the target through scrolling and resizing. State is only set
  // inside callbacks (a frame, an event), never in the effect body.
  useEffect(() => {
    if (!open) return;
    const el = step.target ? document.querySelector<HTMLElement>(`[data-tour="${step.target}"]`) : null;
    let frame = 0;
    const measure = () => {
      frame = 0;
      const r = el?.getBoundingClientRect();
      setBox(r && r.width > 0 && r.height > 0 ? { top: r.top, left: r.left, width: r.width, height: r.height } : null);
      if (card.current) setCardH(card.current.offsetHeight);
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(measure);
    };
    el?.scrollIntoView({ block: "center", inline: "nearest" });
    schedule();
    window.addEventListener("resize", schedule);
    window.addEventListener("scroll", schedule, true);
    return () => {
      if (frame) cancelAnimationFrame(frame);
      window.removeEventListener("resize", schedule);
      window.removeEventListener("scroll", schedule, true);
    };
  }, [open, step, mounted]);

  // Move focus to the card on each step, so a keyboard or screen-reader
  // user lands on what changed.
  useEffect(() => {
    if (open) card.current?.focus();
  }, [open, i, mounted]);

  // The card is modal: Tab and Shift+Tab go round its buttons, never out
  // to the page behind the dim.
  const keepFocusIn = (e: KeyboardEvent<HTMLDivElement>) => {
    const buttons = [...(card.current?.querySelectorAll("button") ?? [])];
    if (buttons.length === 0) return;
    const first = buttons[0], end = buttons[buttons.length - 1];
    const at = document.activeElement;
    if (e.shiftKey && (at === first || at === card.current)) {
      e.preventDefault();
      end.focus();
    } else if (!e.shiftKey && at === end) {
      e.preventDefault();
      first.focus();
    }
  };

  const last = i === steps.length - 1;
  const next = () => (last ? close() : setI(i + 1));
  const back = () => setI(Math.max(0, i - 1));

  if (!open || !mounted) return null;

  // clientWidth, not innerWidth: a desktop scrollbar isn't room for the card.
  const vw = document.documentElement.clientWidth;
  const vh = window.innerHeight;
  const width = Math.min(CARD_W, vw - 24);
  let style: CSSProperties;
  if (box) {
    style = { ...placeCard(box, cardH, width, vw, vh), width };
  } else {
    // Centred with coordinates, not a translate: the card's pop animation
    // owns `transform` and would undo it.
    style = { top: Math.max(12, (vh - cardH) / 2), left: (vw - width) / 2, width };
  }

  // Portalled: the page tiles animate in with a transform, and a
  // transformed ancestor makes `position: fixed` relative to it —
  // the card landed off-screen on phones, under the page's own tiles.
  const overlay = (
    <>
      <div className="fixed inset-0 z-50" onClick={close} aria-hidden>
        {box ? (
          <div
            className="pointer-events-none absolute rounded-2xl"
            style={{
              top: box.top - PAD,
              left: box.left - PAD,
              width: box.width + PAD * 2,
              height: box.height + PAD * 2,
              boxShadow: "0 0 0 9999px rgba(20, 14, 16, 0.55)",
            }}
          />
        ) : (
          <div className="absolute inset-0 bg-[rgba(20,14,16,0.55)]" />
        )}
      </div>
      <div
        ref={card}
        role="dialog"
        aria-modal="true"
        aria-labelledby="tour-title"
        aria-describedby="tour-body"
        tabIndex={-1}
        onKeyDown={(e) => {
          if (e.key === "Tab") keepFocusIn(e);
          else if (e.key === "Escape") close();
          else if (e.key === "ArrowRight") next();
          else if (e.key === "ArrowLeft") back();
        }}
        className="pop fixed z-50 rounded-tile bg-surface p-5 shadow-tile outline-none"
        style={style}
      >
        {i === 0 ? (
          <BentoManFigure key="hello" figure="head-hello" size={36} className="mb-2" />
        ) : (
          <BentoManFigure key="rest" figure="head-rest" size={36} className="mb-2" />
        )}
        <p className="mono text-[0.7rem] uppercase tracking-[0.1em] text-ink-3">
          {copy.tour.stepOf(i + 1, steps.length)}
        </p>
        <h2 id="tour-title" className="mt-1 text-[1.15rem] font-bold">{step.title}</h2>
        <p id="tour-body" className="mt-1.5 text-[0.92rem] leading-relaxed text-ink-2">{step.body}</p>
        <div className="mt-4 flex items-center gap-2">
          <button type="button" onClick={close} className="min-h-10 rounded-full px-3 text-[0.85rem] text-ink-2 hover:bg-sunk hover:text-ink">
            {copy.tour.skip}
          </button>
          <span className="ml-auto" />
          {i > 0 && (
            <button type="button" onClick={back} className="min-h-10 rounded-full border border-rule px-4 text-[0.88rem] hover:bg-sunk">
              {copy.tour.back}
            </button>
          )}
          <button type="button" onClick={next} className="min-h-10 rounded-full bg-accent px-5 text-[0.9rem] font-medium text-on-accent hover:bg-accent-deep">
            {last ? copy.tour.done : copy.tour.next}
          </button>
        </div>
      </div>
    </>
  );

  return createPortal(overlay, document.body);
}
