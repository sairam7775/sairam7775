"use client";

import { useCallback, useEffect, useRef, useState, useTransition, type CSSProperties } from "react";
import { markTourSeen } from "./actions";
import { TOURS, type TourId } from "./steps";

interface Box {
  top: number;
  left: number;
  width: number;
  height: number;
}

const PAD = 8;
const CARD_W = 360;
const GAP = 14;

/** A spotlight tour. It starts by itself the first time a page is opened
 *  (`seen` comes from a cookie, read on the server) and can be replayed from
 *  its button. Esc skips; arrow keys step. It dims with a plain box-shadow,
 *  not a filter, so nothing re-rasterises behind it. */
export function Tour({ id, seen }: { id: TourId; seen: boolean }) {
  const steps = TOURS[id];
  const [open, setOpen] = useState(!seen);
  const [i, setI] = useState(0);
  const [box, setBox] = useState<Box | null>(null);
  const [, start] = useTransition();
  const card = useRef<HTMLDivElement>(null);
  const step = steps[i];

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
  }, [open, step]);

  // Move focus to the card on each step, so a keyboard or screen-reader
  // user lands on what changed.
  useEffect(() => {
    if (open) card.current?.focus();
  }, [open, i]);

  const last = i === steps.length - 1;
  const next = () => (last ? close() : setI(i + 1));
  const back = () => setI(Math.max(0, i - 1));

  const button = (
    <button
      type="button"
      onClick={() => {
        setI(0);
        setOpen(true);
      }}
      className="min-h-10 rounded-full px-3 text-[0.85rem] text-ink-2 hover:bg-sunk hover:text-ink"
    >
      Tour
    </button>
  );
  if (!open) return button;

  const vw = typeof window === "undefined" ? 1024 : window.innerWidth;
  const vh = typeof window === "undefined" ? 768 : window.innerHeight;
  const width = Math.min(CARD_W, vw - 24);
  let style: CSSProperties;
  if (box) {
    const below = box.top + box.height + PAD + GAP + 190 < vh;
    const left = Math.min(Math.max(12, box.left), vw - width - 12);
    style = below ? { top: box.top + box.height + PAD + GAP, left, width } : { bottom: vh - box.top + PAD + GAP, left, width };
  } else {
    style = { top: "50%", left: "50%", width, transform: "translate(-50%, -50%)" };
  }

  return (
    <>
      {button}
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
          if (e.key === "Escape") close();
          else if (e.key === "ArrowRight") next();
          else if (e.key === "ArrowLeft") back();
        }}
        className="pop fixed z-50 rounded-tile bg-surface p-5 shadow-tile outline-none"
        style={style}
      >
        <p className="mono text-[0.7rem] uppercase tracking-[0.1em] text-ink-3">
          Step {i + 1} of {steps.length}
        </p>
        <h2 id="tour-title" className="mt-1 text-[1.15rem] font-bold">{step.title}</h2>
        <p id="tour-body" className="mt-1.5 text-[0.92rem] leading-relaxed text-ink-2">{step.body}</p>
        <div className="mt-4 flex items-center gap-2">
          <button type="button" onClick={close} className="min-h-10 rounded-full px-3 text-[0.85rem] text-ink-2 hover:bg-sunk hover:text-ink">
            Skip
          </button>
          <span className="ml-auto" />
          {i > 0 && (
            <button type="button" onClick={back} className="min-h-10 rounded-full border border-rule px-4 text-[0.88rem] hover:bg-sunk">
              Back
            </button>
          )}
          <button type="button" onClick={next} className="min-h-10 rounded-full bg-accent px-5 text-[0.9rem] font-medium text-white hover:bg-accent-deep">
            {last ? "Done" : "Next"}
          </button>
        </div>
      </div>
    </>
  );
}
