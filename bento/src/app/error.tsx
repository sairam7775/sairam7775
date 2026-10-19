"use client";

import Link from "next/link";
import { useEffect } from "react";
import { StatusPage, primaryButton, secondaryButton } from "@/components/status-page";
import { trackError } from "@/lib/analytics/client";
import { copy } from "@/copy";
import { BentoManFigure } from "@/components/mascot/figure";

/** Any page that throws lands here instead of a bare error screen. The
 *  digest lets a reported problem be matched to the server log. */
export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
    trackError(error, { digest: error.digest ?? null, boundary: "page" });
  }, [error]);

  return (
    <StatusPage kicker={copy.status.error.kicker} title={copy.status.error.title} figure={<BentoManFigure figure="full-lost" size={120} />}>
      <p>{copy.status.error.body}</p>
      {error.digest && <p className="mono mt-3 text-[0.75rem] text-ink-3">{copy.common.reference(error.digest)}</p>}
      <div className="mt-6 flex flex-wrap gap-3">
        <button type="button" onClick={reset} className={primaryButton}>{copy.common.tryAgain}</button>
        <Link href="/trips" className={secondaryButton}>{copy.common.yourTrips}</Link>
      </div>
    </StatusPage>
  );
}
