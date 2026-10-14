/** The Bento mark: a bento box, four compartments, one umeboshi.
 *  Inline so it inherits nothing from the network and recolours per tone. */
export function BentoMark({
  size = 26,
  tone = "dark",
  className,
}: {
  size?: number;
  tone?: "dark" | "light";
  className?: string;
}) {
  const line = tone === "dark" ? "#221C1E" : "#FBF8F3";
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      aria-hidden="true"
      className={className}
    >
      <rect x="4" y="4" width="56" height="56" rx="16" stroke={line} strokeWidth="5" />
      <path d="M32 4v56M4 32h56" stroke={line} strokeWidth="5" />
      <circle cx="18" cy="18" r="7" fill="#FF7757" />
    </svg>
  );
}

/** Mark plus the word. Use for headers; the mark alone for tight spaces. */
export function BentoLogo({
  size = 26,
  tone = "dark",
}: {
  size?: number;
  tone?: "dark" | "light";
}) {
  return (
    <span className="inline-flex items-center gap-2.5">
      <BentoMark size={size} tone={tone} />
      <span
        className="font-bold tracking-tight"
        style={{ fontSize: size * 0.72, lineHeight: 1 }}
      >
        Bento
      </span>
    </span>
  );
}
