"use server";

import { cookies } from "next/headers";
import { parseSeen, TOUR_COOKIE } from "./seen";
import { TOUR_IDS, type TourId } from "./steps";

/** Remember that this browser has seen a tour, so it doesn't start again. */
export async function markTourSeen(id: TourId) {
  if (!(TOUR_IDS as string[]).includes(id)) return;
  const jar = await cookies();
  const seen = new Set(parseSeen(jar.get(TOUR_COOKIE)?.value));
  seen.add(id);
  jar.set(TOUR_COOKIE, [...seen].join("."), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
}
