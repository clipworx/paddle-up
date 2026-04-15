import { NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/supabase-server";

type Params = { params: Promise<{ code: string }> };

function normalizeCode(raw: string): string {
  return raw.trim().toUpperCase();
}

export async function GET(_req: Request, { params }: Params) {
  const { code } = await params;
  const normalized = normalizeCode(code);
  const supabase = getServerSupabase();
  const { data, error } = await supabase
    .from("sessions")
    .select("state")
    .eq("code", normalized)
    .maybeSingle();
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  return NextResponse.json({ state: data.state });
}

export async function PATCH(req: Request, { params }: Params) {
  const { code } = await params;
  const normalized = normalizeCode(code);
  let body: { password?: unknown; state?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const password = typeof body.password === "string" ? body.password : "";
  if (!password) {
    return NextResponse.json({ error: "password_required" }, { status: 400 });
  }
  if (body.state === undefined || body.state === null) {
    return NextResponse.json({ error: "state_required" }, { status: 400 });
  }

  const supabase = getServerSupabase();
  const { error } = await supabase.rpc("update_session_by_code", {
    p_code: normalized,
    p_password: password,
    p_new_state: body.state,
  });
  if (error) {
    const status = /invalid_password/i.test(error.message)
      ? 403
      : /session_not_found/i.test(error.message)
      ? 404
      : 500;
    return NextResponse.json({ error: error.message }, { status });
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request, { params }: Params) {
  const { code } = await params;
  const normalized = normalizeCode(code);
  let body: { password?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const password = typeof body.password === "string" ? body.password : "";
  if (!password) {
    return NextResponse.json({ error: "password_required" }, { status: 400 });
  }

  const supabase = getServerSupabase();
  const { error } = await supabase.rpc("delete_session_by_code", {
    p_code: normalized,
    p_password: password,
  });
  if (error) {
    const status = /invalid_password/i.test(error.message)
      ? 403
      : /session_not_found/i.test(error.message)
      ? 404
      : 500;
    return NextResponse.json({ error: error.message }, { status });
  }
  return NextResponse.json({ ok: true });
}
