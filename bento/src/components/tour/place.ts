export interface Box {
  top: number;
  left: number;
  width: number;
  height: number;
}

export const PAD = 8;
const GAP = 14;
const EDGE = 12;

/** Where the tour card goes: below the target if it fits, else above it,
 *  else pinned to the bottom of the viewport over the target, so the
 *  buttons are always on screen. `cardH` is the card's measured height. */
export function placeCard(box: Box, cardH: number, width: number, vw: number, vh: number) {
  const left = Math.min(Math.max(EDGE, box.left), vw - width - EDGE);
  const belowTop = box.top + box.height + PAD + GAP;
  if (belowTop + cardH <= vh - EDGE) return { top: belowTop, left };
  const aboveTop = box.top - PAD - GAP - cardH;
  if (aboveTop >= EDGE) return { top: aboveTop, left };
  return { top: Math.max(EDGE, vh - EDGE - cardH), left };
}
