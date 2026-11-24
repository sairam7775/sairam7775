import { KNOWN_ERROR_NAMES, MESSAGE_REMOVED } from "./scrub";

// A frame keeps only its place in Bento's own built code: a file under
// /_next/static/, its line and column. Never a function name (a computed
// method name can be anything) or any other file (a message can forge one).
const BUILT_FILE = /^(?:https?:\/\/[^/\s()]+)?\/_next\/static\/[\w./-]+\.js$/;
const V8_FRAME = /^\s+at (?:.*\()?(\S+?):(\d+):(\d+)\)?$/;
const GECKO_FRAME = /^[^\s@]*@(\S+?):(\d+):(\d+)$/;

const place = (file: string, line: string, col: string) => {
  const path = file.split(/[?#]/)[0];
  return BUILT_FILE.test(path) ? `${path}:${line}:${col}` : null;
};

/** Frame lines of a stack, or none when the stack's shape is in doubt. V8
 *  starts with "Name: message" (several lines if the message has them): the
 *  stack must start with exactly that header, as the error stands now, or
 *  nothing is kept, since a message line can look like a frame. Firefox and
 *  Safari leave the message out: every line must then be a frame. */
function framesOf(stack: string, name: string, message: string): string[] {
  const header = message ? `${name}: ${message}` : name;
  if (stack.startsWith(`${header}\n`)) {
    const rest = stack.slice(header.length + 1).split("\n");
    if (!rest.every((l) => V8_FRAME.test(l))) return [];
    return rest.flatMap((l) => {
      const m = V8_FRAME.exec(l)!;
      const at = place(m[1], m[2], m[3]);
      return at ? [`    at ${at}`] : [];
    });
  }
  const lines = stack.split("\n").filter((l) => l !== "");
  if (lines.length === 0 || !lines.every((l) => GECKO_FRAME.test(l))) return [];
  return lines.flatMap((l) => {
    const m = GECKO_FRAME.exec(l)!;
    const at = place(m[1], m[2], m[3]);
    return at ? [`@${at}`] : [];
  });
}

/** A new Error that is safe to send: a known name or "Error", the message
 *  replaced, and only frames in Bento's built files (file, line, column).
 *  No cause, no aggregated errors, nothing copied from a thrown string or
 *  object. Whatever was thrown is left untouched; an error whose
 *  properties can't be read becomes a bare one. */
export function safeError(thrown: unknown): Error {
  let name = "Error";
  let frames: string[] = [];
  try {
    if (thrown instanceof Error) {
      if (KNOWN_ERROR_NAMES.has(thrown.name)) name = thrown.name;
      if (typeof thrown.stack === "string") frames = framesOf(thrown.stack, String(thrown.name), String(thrown.message ?? ""));
    }
  } catch {
    name = "Error";
    frames = [];
  }
  const out = new Error(MESSAGE_REMOVED);
  out.name = name;
  out.stack = [`${name}: ${MESSAGE_REMOVED}`, ...frames].join("\n");
  return out;
}
