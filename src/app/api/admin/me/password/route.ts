import { NextResponse } from "next/server";
import { getAdminClaims } from "@/lib/server-auth";
import { getAdminSupabase } from "@/lib/supabase-admin";

export async function POST(req: Request) {
  const claims = await getAdminClaims();
  if (!claims) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const { current_password, new_password } = body;

  if (!current_password || !new_password)
    return NextResponse.json({ error: "missing_fields" }, { status: 400 });
  if (typeof new_password !== "string" || new_password.length < 8)
    return NextResponse.json({ error: "password_too_short" }, { status: 400 });

  const supabase = getAdminSupabase();

  // Verify current password via the existing RPC
  const { data: valid } = await supabase.rpc("verify_admin_password", {
    p_username: claims.username,
    p_password: current_password,
  });
  if (!valid || typeof (valid as { id?: string }).id !== "string")
    return NextResponse.json({ error: "invalid_current_password" }, { status: 401 });

  // Update password using pgcrypto crypt
  const { error } = await supabase.rpc("update_admin_password", {
    p_admin_id: claims.sub,
    p_new_password: new_password,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
