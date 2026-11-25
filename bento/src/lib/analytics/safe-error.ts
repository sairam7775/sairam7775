import { KNOWN_ERROR_NAMES, MESSAGE_REMOVED } from "./scrub";

// A frame keeps only its place in Bento's own built code: the path of a file
// under /_next/static/ (route chunks have [id] and (group) in theirs), its
// line and column. Never a host (a frame can't point at another site), a
// function name (a computed method name can be anything) or any other file.
// Frames only come from a stack whose header matched the error exactly, so
// none of them is a line of the message.
const BUILT_PATH = /^\/_next\/static\/[\w./\-[\]()@~]+\.js$/;
// "file:line:col", the file possibly a full address.
const LOCATION = /^(.+):(\d+):(\d+)$/;
// Firefox and Safari: "fn@location" (fn may be empty or have spaces).
const GECKO_FRAME = /^[^@\n]*@(.+:\d+:\d+)$/;

const place = (location: string) => {
  const m = LOCATION.exec(location);
  if (!m) return null;
  const path = m[1].split(/[?#]/)[0].replace(/^https?:\/\/[^/]+/, "");
  return BUILT_PATH.test(path) && !path.includes("..") ? `${path}:${m[2]}:${m[3]}` : null;
};

// V8: "    at fn (location)" or "    at location". The location is after
// the last " (": a route path's own "(group)" has no space before it.
function v8Place(line: string): string | null {
  const t = line.trim();
  if (!t.startsWith("at ")) return null;
  const open = t.lastIndexOf(" (");
  return place(open >= 0 && t.endsWith(")") ? t.slice(open + 2, -1) : t.slice(3));
}

/** Frame lines of a stack, or none when the stack's shape is in doubt. V8
 *  starts with "Name: message" (several lines if the message has them): the
 *  stack must start with exactly that header, as the error stands now, or
 *  nothing is kept, since a message line can look like a frame; after it,
 *  the lines are the engine's, and each that is a place in Bento's built
 *  files is kept ("at async Promise.all (index 0)" isn't, and is skipped).
 *  Firefox and Safari leave the message out, so every line must be a frame. */
function framesOf(stack: string, name: string, message: string): string[] {
  const header = message ? `${name}: ${message}` : name;
  if (stack.startsWith(`${header}\n`))
    return stack
      .slice(header.length + 1)
      .split("\n")
      .flatMap((l) => {
        const at = v8Place(l);
        return at ? [`    at ${at}`] : [];
      });
  const lines = stack.split("\n").filter((l) => l !== "");
  if (lines.length === 0 || !lines.every((l) => GECKO_FRAME.test(l))) return [];
  return lines.flatMap((l) => {
    const at = place(GECKO_FRAME.exec(l)![1]);
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
