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
      <div className="flex flex-wrap gap-2">
        <input
          id="share-url"
          readOnly
          value={url}
          onFocus={(e) => e.currentTarget.select()}
          className="mono min-h-10 min-w-0 flex-1 basis-56 rounded-tile border border-rule bg-paper px-3 text-[0.8rem] text-ink-2"
        />
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
          className="min-h-10 rounded-full bg-accent px-4 text-[0.86rem] font-medium text-white hover:bg-accent-deep"
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
            className="min-h-10 rounded-full border border-rule bg-surface px-4 text-[0.86rem] font-medium hover:bg-sunk"
          >
            {t.send}
          </button>
        )}
      </div>
    </div>
  );
}
