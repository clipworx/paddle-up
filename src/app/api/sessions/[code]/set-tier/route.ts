import { NextResponse } from "next/server";
import { casUpdate } from "@/lib/sessionCas";
import { applySetTier } from "@/lib/sessionTransitions";
import { TIERS, type Tier } from "@/lib/types";

type Params = { params: Promise<{ code: string }> };

export async function POST(req: Request, { params }: Params) {
  const { code } = await params;
  const normalized = code.trim().toUpperCase();

  let body: { playerId?: unknown; tier?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const playerId = typeof body.playerId === "string" ? body.playerId : "";
  const tier = typeof body.tier === "string" ? body.tier : "";
  if (!playerId) return NextResponse.json({ error: "player_id_required" }, { status: 400 });
  if (!TIERS.includes(tier as Tier)) {
    return NextResponse.json({ error: "invalid_tier" }, { status: 400 });
  }

  const result = await casUpdate(normalized, (state) => applySetTier(state, playerId, tier as Tier));
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json({ state: result.state, version: result.version });
}
