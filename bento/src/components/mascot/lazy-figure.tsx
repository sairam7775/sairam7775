"use client";

import { lazy, Suspense, type ComponentProps } from "react";

const Figure = lazy(() => import("./figure").then((m) => ({ default: m.BentoManFigure })));

/** BentoManFigure, with its art loaded only when it renders. For the error
 *  and not-found boundaries, which Next bundles with every page: importing
 *  the figure there directly would ship his art to pages that never show
 *  him. The server still renders him; until his code arrives in the browser
 *  an empty box of his size holds the space. (React.lazy, not next/dynamic,
 *  whose loader added 4 KB to every page.) */
export function LazyBentoManFigure(props: ComponentProps<typeof Figure>) {
  // The full figure's drawing is 96 wide by 132 tall; keep in step with CANVAS.
  const width = props.figure.startsWith("full") ? Math.round((props.size * 96) / 132) : props.size;
  return (
    <Suspense fallback={<span aria-hidden="true" className="inline-block align-middle" style={{ width, height: props.size }} />}>
      <Figure {...props} />
    </Suspense>
  );
}
