import { NextResponse } from "next/server";
import { getAdminSupabase } from "@/lib/supabase-admin";

type Params = { params: Promise<{ code: string }> };

export async function DELETE(_req: Request, { params }: Params) {
  const { code } = await params;
  const normalized = code.trim().toUpperCase();
  const supabase = getAdminSupabase();
  const { error } = await supabase.rpc("admin_delete_session_by_code", {
    p_code: normalized,
  });
  if (error) {
    const status = /session_not_found/i.test(error.message) ? 404 : 500;
    return NextResponse.json({ error: error.message }, { status });
  }
  return NextResponse.json({ ok: true });
}

export async function PATCH(req: Request, { params }: Params) {
  const { code } = await params;
  const normalized = code.trim().toUpperCase();
  let body: { newPassword?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const newPassword =
    typeof body.newPassword === "string" ? body.newPassword.trim() : "";
  if (newPassword.length < 4) {
    return NextResponse.json(
      { error: "password_too_short" },
      { status: 400 }
    );
  }
  const supabase = getAdminSupabase();
  const { error } = await supabase.rpc("admin_set_session_password_by_code", {
    p_code: normalized,
    p_new_password: newPassword,
  });
  if (error) {
    const status = /session_not_found/i.test(error.message) ? 404 : 500;
    return NextResponse.json({ error: error.message }, { status });
  }
  return NextResponse.json({ ok: true });
}
