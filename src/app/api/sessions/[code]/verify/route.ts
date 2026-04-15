import { NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/supabase-server";

type Params = { params: Promise<{ code: string }> };

export async function POST(req: Request, { params }: Params) {
  const { code } = await params;
  const normalized = code.trim().toUpperCase();
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
  const { data, error } = await supabase.rpc(
    "verify_session_password_by_code",
    { p_code: normalized, p_password: password }
  );
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ valid: data === true });
}
