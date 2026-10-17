"use client";

import { copy } from "@/copy";

/** Last resort, when the root layout itself fails: it replaces the whole
 *  document, so it can't rely on the app's stylesheet. */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: "system-ui, sans-serif", background: "#fbf8f3", color: "#231c1e" }}>
        <main style={{ maxWidth: 480, margin: "0 auto", padding: "64px 20px" }}>
          <h1 style={{ fontSize: 28, margin: 0 }}>{copy.status.globalError.title}</h1>
          <p style={{ lineHeight: 1.6, color: "#5b5053" }}>
            {copy.status.globalError.body}
          </p>
          {error.digest && <p style={{ fontFamily: "monospace", fontSize: 12, color: "#8a7f82" }}>{copy.common.reference(error.digest)}</p>}
          <button
            type="button"
            onClick={reset}
            style={{ minHeight: 44, padding: "0 20px", border: 0, borderRadius: 999, background: "#e8673a", color: "#fff", fontSize: 16 }}
          >
            {copy.common.tryAgain}
          </button>
        </main>
      </body>
    </html>
  );
}
