import { NextResponse } from "next/server";
import { getAdminSupabase } from "@/lib/supabase-admin";
import { signAdminToken, ADMIN_COOKIE_NAME } from "@/lib/auth";

export async function POST(req: Request) {
  let body: { username?: unknown; password?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const username =
    typeof body.username === "string" ? body.username.trim() : "";
  const password = typeof body.password === "string" ? body.password : "";
  if (!username || !password) {
    return NextResponse.json(
      { error: "credentials_required" },
      { status: 400 }
    );
  }

  const supabase = getAdminSupabase();
  const { data, error } = await supabase.rpc("verify_admin_password", {
    p_username: username,
    p_password: password,
  });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (typeof data !== "string" || !data) {
    return NextResponse.json(
      { error: "invalid_credentials" },
      { status: 401 }
    );
  }

  const token = await signAdminToken(data, username);
  const res = NextResponse.json({ ok: true });
  res.cookies.set(ADMIN_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24,
  });
  return res;
}
