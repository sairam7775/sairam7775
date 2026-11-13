/** Where the trip page's chat finds the first message from "Plan a Japan
 *  trip" (lib/trips/guided-start.ts): the tab's session storage, never the
 *  address (analytics records addresses, and nothing a traveller writes goes
 *  in one). The chat reads it once and removes it. On its own, so the two
 *  browser components that use it don't bring guided-start's zod along. */
export const starterKey = (tripId: string) => `bento-start:${tripId}`;
