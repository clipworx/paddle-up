import { NextResponse } from "next/server";
import { casUpdate } from "@/lib/sessionCas";
import { applyQueueLeave } from "@/lib/sessionTransitions";

type Params = { params: Promise<{ code: string }> };

export async function POST(req: Request, { params }: Params) {
  const { code } = await params;
  const normalized = code.trim().toUpperCase();

  let body: { playerId?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const playerId = typeof body.playerId === "string" ? body.playerId : "";
  if (!playerId) return NextResponse.json({ error: "player_id_required" }, { status: 400 });

  const result = await casUpdate(normalized, (state) => applyQueueLeave(state, playerId));
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json({ state: result.state, version: result.version });
}
