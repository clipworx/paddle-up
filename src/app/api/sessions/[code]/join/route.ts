import { NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/supabase-server";
import { casUpdate } from "@/lib/sessionCas";
import { applyJoin } from "@/lib/sessionTransitions";

type Params = { params: Promise<{ code: string }> };

export async function POST(req: Request, { params }: Params) {
  const { code } = await params;
  const normalized = code.trim().toUpperCase();

  let body: { playerId?: unknown; name?: unknown; password?: unknown };
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

  // If a valid host password came along, this is the host's own join —
  // skip the waiting room. Anyone without it (i.e. everyone else) goes
  // through applyJoin's normal pending/declined-retry logic.
  let admitImmediately = false;
  const password = typeof body.password === "string" ? body.password : "";
  if (password) {
    const supabase = getServerSupabase();
    const { data } = await supabase.rpc("verify_session_password_by_code", {
      p_code: normalized,
      p_password: password,
    });
    admitImmediately = data === true;
  }

  const result = await casUpdate(normalized, (state) => applyJoin(state, playerId, name, admitImmediately));
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json({ playerId, state: result.state, version: result.version });
}
