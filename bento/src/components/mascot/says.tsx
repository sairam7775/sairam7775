import type { CSSProperties, ReactNode } from "react";
import { BentoManFigure } from "./figure";
import type { FigureKey } from "./types";

/** Bento Man saying something: him on the left, his words in a speech
 *  bubble whose tail points at him (`.says` in globals.css). The one look
 *  for everything he says to the traveller — the home page's sample note,
 *  the Bookings tip, the trips greeting, his chat replies. He stays
 *  decoration; the words are the message.
 *
 *  `tone`: "page" is a tile on the page; "panel" is a sunk bubble inside a
 *  surface that is already a tile (the chat). */
export function BentoManSays({
  figure,
  size,
  tone = "page",
  className = "",
  bubbleClassName = "px-4 py-3", // padding included: pass your own to change it
  style,
  children,
}: {
  figure: FigureKey;
  size: number;
  tone?: "page" | "panel";
  className?: string;
  bubbleClassName?: string;
  style?: CSSProperties;
  children?: ReactNode;
}) {
  return (
    <div className={`flex items-start gap-3 ${className}`} style={style}>
      <span className="shrink-0"><BentoManFigure key={figure} figure={figure} size={size} /></span>
      <div className={`says ${tone === "panel" ? "bg-sunk" : "tile"} min-w-0 flex-1 ${bubbleClassName}`}>
        {children}
      </div>
    </div>
  );
}
