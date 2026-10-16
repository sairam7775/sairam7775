/** The walkthrough, one short tour per page. A step with a `target` points
 *  at the element marked `data-tour="<target>"`; with none (or when that
 *  element isn't on the page right now) it is a centred card. Copy follows
 *  the voice rule: plain, no cheerleading. The tour only points; it never
 *  changes anything. */

export type TourId = "trips" | "trip" | "vault";

export interface TourStep {
  target?: string;
  title: string;
  body: string;
}

export const TOURS: Record<TourId, TourStep[]> = {
  trips: [
    {
      title: "Welcome to Bento",
      body: "A one-minute tour: where trips live, how Bento Man works, and what each page is for. It changes nothing, and you can replay it any time from Settings.",
    },
    {
      target: "new-trip",
      title: "Start a trip here",
      body: "Give it a name, dates and who is going. All of it is optional and can change later — or just tell Bento Man.",
    },
    {
      title: "Then open it",
      body: "Every trip has a plan, a chat with Bento Man, and a vault for your bookings.",
    },
  ],
  trip: [
    {
      target: "chat",
      title: "Bento Man",
      body: "Tell it the dates, what you like and what you would never do. It proposes a route and days — and nothing changes until you press Accept.",
    },
    {
      target: "edit-trip",
      title: "Dates and party",
      body: "Add or change dates here. Planned days move with them, and a change that would break a plan is refused, with the reason.",
    },
    {
      target: "day-box",
      title: "Each day is a box",
      body: "Stops are sized to the time they take. Drag to reorder, pin a stop to keep it, remove one, or re-plan the day around your pins.",
    },
    {
      target: "vault",
      title: "The vault",
      body: "Add flights, hotels and tickets. Bento tells you what is missing — a night with no bed, a ticket you still need. Booking references are encrypted.",
    },
    {
      title: "That’s the tour",
      body: "Replay it any time from Settings, at the top of the page.",
    },
  ],
  vault: [
    {
      title: "What’s missing, in plain words",
      body: "The cards at the top say what your trip still needs: a bed for a night, a ticket for a place that requires one. Each has a button to fix it.",
    },
    {
      target: "add-booking",
      title: "Add a booking",
      body: "Type it in, or paste a confirmation and Bento fills the form for you. You check every field before it is saved.",
    },
  ],
};

export const TOUR_IDS = Object.keys(TOURS) as TourId[];
