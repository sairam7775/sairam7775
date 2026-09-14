/** The loading state: the Bento mark with its umeboshi hopping from
 *  compartment to compartment. Keyframes live in globals.css so the
 *  animation is shared with the standalone SVG in public/logo. */
export function BentoLoader({
  size = 40,
  tone = "dark",
  label = "Loading",
}: {
  size?: number;
  tone?: "dark" | "light";
  label?: string;
}) {
  const line = tone === "dark" ? "#221C1E" : "#FBF8F3";
  return (
    <span role="status" aria-live="polite" className="inline-flex">
      <svg width={size} height={size} viewBox="0 0 64 64" fill="none" aria-hidden="true">
        <rect x="4" y="4" width="56" height="56" rx="16" stroke={line} strokeWidth="5" />
        <path d="M32 4v56M4 32h56" stroke={line} strokeWidth="5" />
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
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4">
      <BentoLoader size={48} label={caption ?? "Loading"} />
      {caption && <p className="mono text-[0.72rem] uppercase tracking-[0.12em] text-ink-3">{caption}</p>}
    </div>
  );
}
