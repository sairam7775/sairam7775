import { KNOWN_ERROR_NAMES, MESSAGE_REMOVED } from "./scrub";

// A stack frame line: V8's "    at fn (file:1:2)" or "    at file:1:2", and
// Firefox and Safari's "fn@file:1:2" (fn may be empty).
const V8_FRAME = /^\s+at .+/;
const GECKO_FRAME = /^[^\s@]*@\S+:\d+:\d+$/;

/** Only the frame lines of a stack, never the message. V8 puts
 *  "Name: message" (which may run over several lines) first, and a message
 *  line can look like a frame, so those lines are cut by count before
 *  anything is kept. Firefox and Safari leave the message out. */
function framesOf(stack: string, name: string, message: string): string[] {
  const lines = stack.split("\n");
  const v8 = lines.some((l) => V8_FRAME.test(l));
  if (v8) {
    const header = message ? `${name}: ${message}` : name;
    const skip = stack.startsWith(header) ? header.split("\n").length : (message.split("\n").length);
    return lines.slice(skip).filter((l) => V8_FRAME.test(l));
  }
  return lines.filter((l) => GECKO_FRAME.test(l));
}

/** A new Error that is safe to send: a known name or "Error", the message
 *  replaced, and only the stack's frame lines (code: file, function, line).
 *  No cause, no aggregated errors, nothing copied from a thrown string or
 *  object. Whatever was thrown is left untouched. */
export function safeError(thrown: unknown): Error {
  const isError = thrown instanceof Error;
  const name = isError && KNOWN_ERROR_NAMES.has(thrown.name) ? thrown.name : "Error";
  const frames = isError && typeof thrown.stack === "string" ? framesOf(thrown.stack, thrown.name, String(thrown.message ?? "")) : [];
  const out = new Error(MESSAGE_REMOVED);
  out.name = name;
  out.stack = [`${name}: ${MESSAGE_REMOVED}`, ...frames].join("\n");
  return out;
}
