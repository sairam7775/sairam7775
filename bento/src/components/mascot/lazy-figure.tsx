"use client";

import { lazy, Suspense, type ComponentProps } from "react";
import type { BentoManFigure } from "./figure";
import { withFallback } from "./lazy-load";

type Props = ComponentProps<typeof BentoManFigure>;

/** An empty box of his size: the placeholder while his code loads, and what
 *  stays if it can't. */
function Space({ figure, size }: Props) {
  // The full figure's drawing is 96 wide by 132 tall; keep in step with CANVAS.
  const width = figure.startsWith("full") ? Math.round((size * 96) / 132) : size;
  return <span aria-hidden="true" className="inline-block align-middle" style={{ width, height: size }} />;
}

const Figure = lazy(withFallback<Props>(() => import("./figure").then((m) => m.BentoManFigure), Space));

/** BentoManFigure, with its art loaded only when it renders. For the error
 *  and not-found boundaries, which Next bundles with every page: importing
 *  the figure there directly would ship his art to pages that never show
 *  him. The server still renders him; until his code arrives in the browser
 *  an empty box of his size holds the space, and stays if it never arrives.
 *  (React.lazy, not next/dynamic, whose loader added 4 KB to every page.) */
export function LazyBentoManFigure(props: Props) {
  return (
    <Suspense fallback={<Space {...props} />}>
      <Figure {...props} />
    </Suspense>
  );
}
