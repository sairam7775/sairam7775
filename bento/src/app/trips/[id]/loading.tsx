import { TripSkeleton } from "@/components/loading";

/** Shown while a trip loads: its route, days, bookings and chat are several
 *  queries, so the page's shape arrives first. */
export default function Loading() {
  return <TripSkeleton />;
}
