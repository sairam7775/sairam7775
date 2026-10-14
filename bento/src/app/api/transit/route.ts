import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { loadGraph } from "@/lib/transit/load";
import { route } from "@/lib/transit/graph";
import { describeRoute } from "@/lib/transit/describe";

/** GET /api/transit?from=kyoto&to=inari
 *  Door-to-door between two stations, as the engine sees it. Signed-in
 *  only — reference data, but no reason to serve it to the open web. */
export async function GET(req: NextRequest) {
  const db = await createClient();
  const { data: { user } } = await db.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in first." }, { status: 401 });

  const from = req.nextUrl.searchParams.get("from");
  const to = req.nextUrl.searchParams.get("to");
  if (!from || !to) return NextResponse.json({ error: "from and to are required." }, { status: 400 });

  const graph = await loadGraph();
  const r = route(graph, from, to);
  if (!r) return NextResponse.json({ error: `No route from ${from} to ${to}.` }, { status: 404 });

  return NextResponse.json({ ...describeRoute(r), route: r });
}
