"use client";

import { useState, useSyncExternalStore } from "react";
import { track } from "@/lib/analytics/client";
import { copy } from "@/copy";

const t = copy.share;
const noSubscribe = () => () => {};
const sendable = () => typeof navigator.share === "function";

/** The companions' link, ready to copy or to hand to the phone's share
 *  sheet (LINE, WhatsApp, mail). Analytics hear that it was copied or sent,
 *  never the link: it is the key to the plan. */
export function ShareLink({ url, title }: { url: string; title: string }) {
  const [copied, setCopied] = useState(false);
  // Known only in the browser; the server render leaves the button out.
  const canSend = useSyncExternalStore(noSubscribe, sendable, () => false);

  return (
    <div className="flex flex-col gap-2">
      <label htmlFor="share-url" className="text-[0.84rem] font-medium text-ink-2">{t.linkLabel}</label>
      <input
        id="share-url"
        readOnly
        value={url}
        onFocus={(e) => e.currentTarget.select()}
        className="mono min-h-10 w-full rounded-tile border border-rule bg-paper px-3 text-[0.8rem] text-ink-2"
      />
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(url);
              setCopied(true);
              track("share_link_copied");
              setTimeout(() => setCopied(false), 2000);
            } catch {
              // No clipboard (an old browser, a denied permission): the field selects on focus.
            }
          }}
          className="min-h-10 rounded-full bg-accent px-5 text-[0.88rem] font-medium text-white hover:bg-accent-deep"
        >
          <span aria-live="polite">{copied ? t.copied : t.copy}</span>
        </button>
        {canSend && (
          <button
            type="button"
            onClick={async () => {
              try {
                await navigator.share({ title, url });
                track("share_link_sent");
              } catch {
                // Closed without sending.
              }
            }}
            className="min-h-10 rounded-full border border-rule bg-surface px-4 text-[0.88rem] font-medium hover:bg-sunk"
          >
            {t.send}
          </button>
        )}
        {/* A new tab: the shared page runs no analytics, and the trip page stays as it is. */}
        <a href={url} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-10 items-center gap-1 rounded-full px-2 text-[0.86rem] sm:ml-auto text-ink-2 underline underline-offset-2 hover:bg-sunk">
          {t.preview}
          <span aria-hidden>↗</span>
        </a>
      </div>
    </div>
  );
}
