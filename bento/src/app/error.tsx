"use client";

import Link from "next/link";
import { useEffect } from "react";
import { StatusPage, primaryButton, secondaryButton } from "@/components/status-page";

/** Any page that throws lands here instead of a bare error screen. The
 *  digest lets a reported problem be matched to the server log. */
export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <StatusPage kicker="Something went wrong" title="That didn’t load.">
      <p>
        It&rsquo;s on our side, not yours, and nothing in your plan was changed. Try again — if it keeps happening,
        come back in a few minutes.
      </p>
      {error.digest && <p className="mono mt-3 text-[0.75rem] text-ink-3">Reference: {error.digest}</p>}
      <div className="mt-6 flex flex-wrap gap-3">
        <button type="button" onClick={reset} className={primaryButton}>Try again</button>
        <Link href="/trips" className={secondaryButton}>Your trips</Link>
      </div>
    </StatusPage>
  );
}
