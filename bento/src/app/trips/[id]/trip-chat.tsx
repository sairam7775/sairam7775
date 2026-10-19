"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { copy } from "@/copy";

const PHONE_QUERY = "(max-width: 1023px)";

/** One chat instance stays mounted while its phone presentation changes. */
export function TripChat({ children }: { children: ReactNode }) {
  const [phone, setPhone] = useState(false);
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLElement>(null);
  const mobileOpen = phone && open;
  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    const media = window.matchMedia(PHONE_QUERY);
    const maybeOpenFromLink = () => {
      if (media.matches && window.location.hash === "#bento-man") setOpen(true);
    };
    const update = () => {
      setPhone(media.matches);
      maybeOpenFromLink();
    };

    update();
    media.addEventListener("change", update);
    window.addEventListener("hashchange", maybeOpenFromLink);
    return () => {
      media.removeEventListener("change", update);
      window.removeEventListener("hashchange", maybeOpenFromLink);
    };
  }, []);

  useEffect(() => {
    if (!mobileOpen) return;

    const htmlOverflow = document.documentElement.style.overflow;
    const bodyOverflow = document.body.style.overflow;
    const triggerButton = trigger.current;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    document.documentElement.style.overflow = "hidden";
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", onKeyDown);
    document.getElementById("chat-input")?.focus({ preventScroll: true });

    return () => {
      document.documentElement.style.overflow = htmlOverflow;
      document.body.style.overflow = bodyOverflow;
      document.removeEventListener("keydown", onKeyDown);
      if (window.matchMedia(PHONE_QUERY).matches) triggerButton?.focus({ preventScroll: true });
    };
  }, [mobileOpen, close]);

  const keepFocusIn = (event: ReactKeyboardEvent<HTMLElement>) => {
    if (event.key !== "Tab") return;

    const focusable = [...(panel.current?.querySelectorAll<HTMLElement>(
      'button:not([disabled]), textarea:not([disabled]), input:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])',
    ) ?? [])].filter((el) => el.getClientRects().length > 0);
    if (focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  return (
    <>
      <button
        ref={trigger}
        type="button"
        data-tour="chat"
        aria-expanded={mobileOpen}
        aria-controls="bento-man"
        onClick={() => setOpen(true)}
        className="fixed right-4 bottom-[calc(env(safe-area-inset-bottom)+1rem)] z-20 inline-flex min-h-11 items-center rounded-full bg-accent px-5 text-[0.9rem] font-medium text-on-accent shadow-tile hover:bg-accent-deep lg:hidden"
        hidden={mobileOpen}
      >
        {copy.trip.askBentoMan}
      </button>

      {mobileOpen && (
        <button
          type="button"
          aria-label={copy.trip.closeBentoMan}
          onClick={close}
          className="fixed inset-0 z-30 bg-lacquer/50 lg:hidden"
        />
      )}

      <section
        ref={panel}
        id="bento-man"
        data-tour="chat"
        role={mobileOpen ? "dialog" : undefined}
        aria-modal={mobileOpen || undefined}
        aria-labelledby="bento-man-title"
        aria-hidden={phone && !open ? true : undefined}
        onKeyDown={mobileOpen ? keepFocusIn : undefined}
        className={`tile up relative scroll-mt-4 bg-surface! flex-col overflow-hidden lg:sticky lg:top-6 lg:flex lg:h-[calc(100dvh-8.5rem)] lg:min-h-[520px] lg:rounded-tile ${mobileOpen ? "fixed inset-x-0 bottom-0 z-40 flex h-[85dvh] rounded-t-box" : "hidden"}`}
        style={{ animationDelay: ".15s" }}
      >
        <button
          type="button"
          onClick={close}
          className="absolute top-2.5 right-3 z-10 inline-flex min-h-11 items-center rounded-full border border-rule bg-surface px-4 text-[0.85rem] text-ink-2 hover:bg-sunk lg:hidden"
        >
          {copy.trip.closeBentoMan}
        </button>
        {children}
      </section>
    </>
  );
}
