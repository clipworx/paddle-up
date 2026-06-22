import { NextResponse } from "next/server";
import { casUpdate } from "@/lib/sessionCas";
import { applyJoin } from "@/lib/sessionTransitions";

type Params = { params: Promise<{ code: string }> };

export async function POST(req: Request, { params }: Params) {
  const { code } = await params;
  const normalized = code.trim().toUpperCase();

  let body: { playerId?: unknown; name?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const name = typeof body.name === "string" ? body.name : "";
  if (!name.trim()) {
    return NextResponse.json({ error: "name_required" }, { status: 400 });
  }
  const playerId = typeof body.playerId === "string" && body.playerId ? body.playerId : crypto.randomUUID();

  const result = await casUpdate(normalized, (state) => applyJoin(state, playerId, name));
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json({ playerId, state: result.state, version: result.version });
}
