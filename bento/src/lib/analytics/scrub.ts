import { pathOnly } from "./url";

/** What an error's message becomes before it leaves the browser. */
export const MESSAGE_REMOVED = "(message removed)";

/** The parts of a PostHog event `before_send` hands over. */
export type OutgoingEvent = {
  event: string;
  properties?: Record<string, unknown>;
  $set?: Record<string, unknown>;
  $set_once?: Record<string, unknown>;
};

// An error's message can hold anything the code had in hand when it failed
// (a trip name, a booking title, an email), so it never leaves: only the
// error's type and stack (file, function, line: code, not the traveller's
// words) and Bento's own properties (the digest that finds it in the server
// logs, the boundary). posthog-js 1.435 puts the message in each
// $exception_list entry's `value` and in $exception_message, copies the
// values into $exception_values, and may attach $exception_steps (what
// happened just before). Every other string, at any depth, keeps only the
// path of an address (`pathOnly`).
const DROPPED = ["$exception_values", "$exception_steps", "$sentry_exception", "$sentry_exception_message"];

// A recording ($snapshot) is the page's structure, already masked by the
// recorder, and large: walking it would cost the browser time and could
// change what it replays. Only its own top-level strings are cut, as before.
const top = (bag: Record<string, unknown>) =>
  Object.fromEntries(Object.entries(bag).map(([k, v]) => [k, typeof v === "string" ? pathOnly(v) : v]));

function deep(value: unknown): unknown {
  if (typeof value === "string") return pathOnly(value);
  if (Array.isArray(value)) return value.map(deep);
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, deep(v)]));
  return value;
}

function exceptionProps(props: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = { ...props };
  for (const k of DROPPED) delete out[k];
  if ("$exception_message" in out) out.$exception_message = MESSAGE_REMOVED;
  if (Array.isArray(out.$exception_list))
    out.$exception_list = out.$exception_list.map((x) => (x && typeof x === "object" ? { ...x, value: MESSAGE_REMOVED } : x));
  return out;
}

/** The event as it may leave: error messages removed, addresses cut to
 *  their path. Returns a new object; the input is untouched. */
export function scrubEvent<E extends OutgoingEvent>(event: E): E {
  const props = event.properties && event.event === "$exception" ? exceptionProps(event.properties) : event.properties;
  const walk = event.event === "$snapshot" ? (bag: Record<string, unknown>) => top(bag) : (bag: Record<string, unknown>) => deep(bag);
  return {
    ...event,
    ...(props && { properties: walk(props) }),
    ...(event.$set && { $set: deep(event.$set) }),
    ...(event.$set_once && { $set_once: deep(event.$set_once) }),
  };
}
