/** POST /api/csp-report — where browsers send Content Security Policy
 *  violations (lib/security/csp.ts). Open to anyone, as browsers send them
 *  without a session; a report is at most 64 KB and only its directive and
 *  the blocked origin are logged, never a full address. */
const MAX_REPORT_BYTES = 64 * 1024;

type Report = Record<string, unknown>;

function isRecord(value: unknown): value is Report {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

async function readBody(request: Request): Promise<string | null> {
  const contentLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(contentLength) && contentLength > MAX_REPORT_BYTES) return null;

  const reader = request.body?.getReader();
  if (!reader) return "";

  const chunks: Uint8Array[] = [];
  let size = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > MAX_REPORT_BYTES) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }

  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(bytes);
}

function reportsIn(payload: unknown): Report[] {
  if (Array.isArray(payload)) {
    return payload.flatMap((entry) =>
      isRecord(entry) && entry.type === "csp-violation" && isRecord(entry.body) ? [entry.body] : [],
    );
  }

  if (!isRecord(payload)) return [];
  if (isRecord(payload["csp-report"])) return [payload["csp-report"]];
  if (payload.type === "csp-violation" && isRecord(payload.body)) return [payload.body];
  return [];
}

function directiveOf(report: Report): string {
  const value = report.effectiveDirective ?? report["effective-directive"] ?? report["violated-directive"];
  if (typeof value !== "string") return "unknown";
  const directive = value.toLowerCase();
  return /^[a-z][a-z0-9-]{0,63}$/.test(directive) ? directive : "unknown";
}

function originOfBlockedUri(report: Report): string | null {
  const value = report.blockedURL ?? report["blocked-uri"];
  if (typeof value !== "string") return null;

  try {
    const url = new URL(value);
    if (["http:", "https:", "ws:", "wss:"].includes(url.protocol)) return url.origin;
  } catch {
    return null;
  }

  return null;
}

export async function POST(request: Request): Promise<Response> {
  // Route Handlers bypass the root layout, so this endpoint never starts the
  // analytics client while receiving reports.
  let body: string | null;
  try {
    body = await readBody(request);
  } catch {
    return new Response(null, { status: 400 });
  }

  if (body === null) return new Response(null, { status: 413 });

  try {
    const payload: unknown = JSON.parse(body);
    for (const report of reportsIn(payload)) {
      // Report URLs can contain share keys and booking ids, so keep only the
      // directive and origin that help identify a policy gap.
      console.warn("CSP violation", {
        directive: directiveOf(report),
        blockedOrigin: originOfBlockedUri(report),
      });
    }
  } catch {
    // Browsers and extensions can send malformed reports; they need no retry.
  }

  return new Response(null, { status: 204 });
}
