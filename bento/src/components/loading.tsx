import { copy } from "@/copy";

/** The loading state: the Bento mark with its umeboshi hopping from
 *  compartment to compartment. Keyframes live in globals.css so the
 *  animation is shared with the standalone SVG in public/logo.
 *
 *  The frame draws in currentColor, so it follows the palette: ink on rice
 *  in light mode, rice on dark in dark mode. A fixed hex here made it
 *  invisible in dark mode. `tone="light"` is for sitting on lacquer. */
export function BentoLoader({
  size = 40,
  tone = "dark",
  label = copy.loading.label,
}: {
  size?: number;
  tone?: "dark" | "light";
  label?: string;
}) {
  return (
    <span role="status" aria-live="polite" className={`inline-flex ${tone === "dark" ? "text-ink" : "text-rice"}`}>
      <svg width={size} height={size} viewBox="0 0 64 64" fill="none" aria-hidden="true">
        <rect x="4" y="4" width="56" height="56" rx="16" stroke="currentColor" strokeWidth="5" />
        <path d="M32 4v56M4 32h56" stroke="currentColor" strokeWidth="5" />
        <g className="bento-hop">
          <circle className="bento-squish" cx="0" cy="0" r="7" fill="#FF7757" />
        </g>
      </svg>
      <span className="sr-only">{label}</span>
    </span>
  );
}

/** Full-area loader for route transitions and slow screens. */
export function PageLoader({ caption }: { caption?: string }) {
  return (
    <div className="flex min-h-[60vh] flex-1 flex-col items-center justify-center gap-4">
      <BentoLoader size={56} label={caption ?? copy.loading.label} />
      <p className="disp text-[1rem] font-bold text-ink-2">{caption ?? copy.loading.packing}</p>
    </div>
  );
}

/** A grey stand-in for content that's on its way. */
export function Skeleton({ className = "" }: { className?: string }) {
  return <div aria-hidden className={`rounded-tile bg-sunk motion-safe:animate-pulse ${className}`} />;
}

/** The trip page while it loads: the shape of the real page — title, the
 *  day strip, the box and the chat — so nothing jumps when it arrives. */
export function TripSkeleton() {
  return (
    <main className="mx-auto w-full max-w-[1680px] px-4 py-6 sm:px-6 lg:px-10">
      <div className="flex items-center gap-3">
        <BentoLoader size={28} label={copy.loading.trip} />
        <span className="disp text-[1rem] font-bold text-ink-2">{copy.loading.packing}</span>
      </div>
      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(380px,34%)]">
        <div className="flex flex-col gap-4">
          <Skeleton className="h-12 w-2/3 max-w-md" />
          <Skeleton className="h-5 w-1/2 max-w-sm" />
          <Skeleton className="h-12 w-full" />
          <div className="flex gap-2">
            {Array.from({ length: 5 }, (_, i) => <Skeleton key={i} className="h-20 w-[7.2rem] shrink-0" />)}
          </div>
          <Skeleton className="h-80 w-full rounded-box" />
        </div>
        <Skeleton className="h-[min(80dvh,720px)] lg:h-[calc(100dvh-8.5rem)]" />
      </div>
    </main>
  );
}
