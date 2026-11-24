import { pathOnly } from "./url";

/** What an error's message becomes before it leaves the browser. */
export const MESSAGE_REMOVED = "(message removed)";

/** Error names that are code, not words: the JavaScript built-ins, the
 *  browser's DOMException names Bento may meet, and Next.js's chunk error.
 *  Any other name (a custom one, or a thrown object's `name`) goes out as
 *  "Error", because a name can be set to anything. */
export const KNOWN_ERROR_NAMES = new Set([
  "Error",
  "TypeError",
  "RangeError",
  "SyntaxError",
  "ReferenceError",
  "EvalError",
  "URIError",
  "AggregateError",
  "AbortError",
  "TimeoutError",
  "NetworkError",
  "NotAllowedError",
  "NotFoundError",
  "NotSupportedError",
  "InvalidStateError",
  "QuotaExceededError",
  "SecurityError",
  "DataCloneError",
  "ChunkLoadError",
]);

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

// Past this depth, or on a loop, a value is replaced, never sent as it was.
const MAX_DEPTH = 12;
export const VALUE_OMITTED = "(omitted)";

function deep(value: unknown, depth = 0, seen = new WeakSet<object>()): unknown {
  if (typeof value === "string") return pathOnly(value);
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value.toISOString();
  if (!value || typeof value !== "object") return value;
  if (depth >= MAX_DEPTH || seen.has(value)) return VALUE_OMITTED;
  seen.add(value);
  const out = Array.isArray(value)
    ? value.map((v) => deep(v, depth + 1, seen))
    : Object.fromEntries(Object.entries(value).map(([k, v]) => [k, deep(v, depth + 1, seen)]));
  // Siblings may share an object; only a loop back up is cut.
  seen.delete(value);
  return out;
}

const knownName = (name: unknown) => (typeof name === "string" && KNOWN_ERROR_NAMES.has(name) ? name : "Error");

function exceptionProps(props: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = { ...props };
  for (const k of DROPPED) delete out[k];
  if ("$exception_message" in out) out.$exception_message = MESSAGE_REMOVED;
  if ("$exception_type" in out) out.$exception_type = knownName(out.$exception_type);
  // safeError has already cleaned what Bento sends; this holds if anything
  // reaches PostHog another way.
  if (Array.isArray(out.$exception_list))
    out.$exception_list = out.$exception_list.map((x) =>
      x && typeof x === "object" ? { ...x, type: knownName((x as { type?: unknown }).type), value: MESSAGE_REMOVED } : x,
    );
  return out;
}

/** The event as it may leave: error messages removed, addresses cut to
 *  their path. Returns a new object; the input is untouched. */
// Text PostHog takes from the page rather than from Bento: the page title,
// and values it lifts out of an address (marketing and search parameters,
// also kept as first-seen and session-start copies). An address is cut to
// its path, so what came after it must not survive under another name.
const LIFTED = /^(?:\$initial_|\$session_entry_)?(?:title|utm_\w+|\w*clid|gad_source|gclsrc|gbraid|wbraid|li_fat_id|igshid|mc_cid|_kx|epik|irclid|\$search_engine|ph_keyword)$/;

const unlifted = (bag: Record<string, unknown>) => Object.fromEntries(Object.entries(bag).filter(([k]) => !LIFTED.test(k)));

// Heatmaps are keyed by the page's full address; the keys are cut to their
// path too, merging what lands on the same one.
function heatmapKeys(data: unknown): unknown {
  if (!data || typeof data !== "object" || Array.isArray(data)) return data;
  const out: Record<string, unknown[]> = {};
  for (const [url, points] of Object.entries(data)) {
    const key = pathOnly(url);
    out[key] = [...(out[key] ?? []), ...(Array.isArray(points) ? points : [points])];
  }
  return out;
}

export function scrubEvent<E extends OutgoingEvent>(event: E): E {
  let props = event.properties && event.event === "$exception" ? exceptionProps(event.properties) : event.properties;
  if (props) {
    props = unlifted(props);
    if ("$heatmap_data" in props) props.$heatmap_data = heatmapKeys(props.$heatmap_data);
  }
  const walk = event.event === "$snapshot" ? (bag: Record<string, unknown>) => top(bag) : (bag: Record<string, unknown>) => deep(bag);
  return {
    ...event,
    ...(props && { properties: walk(props) }),
    ...(event.$set && { $set: deep(unlifted(event.$set)) }),
    ...(event.$set_once && { $set_once: deep(unlifted(event.$set_once)) }),
  };
}
