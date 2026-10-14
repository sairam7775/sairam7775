import { cookies } from "next/headers";
import { TOUR_IDS, type TourId } from "./steps";

export const TOUR_COOKIE = "bento_tour";

/** Which tours this browser has finished or skipped. A cookie, not a
 *  column: the server can read it before rendering, so a tour never
 *  flashes in for someone who has already seen it. */
export function parseSeen(value: string | undefined): TourId[] {
  return (value ?? "").split(".").filter((x): x is TourId => (TOUR_IDS as string[]).includes(x));
}

export async function tourSeen(id: TourId): Promise<boolean> {
  return parseSeen((await cookies()).get(TOUR_COOKIE)?.value).includes(id);
}
