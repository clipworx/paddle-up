import { NextResponse } from "next/server";
import { getAdminSupabase } from "@/lib/supabase-admin";
import { signAdminToken, ADMIN_COOKIE_NAME, type AdminRole } from "@/lib/auth";

type VerifyResult = {
  id: string;
  role: AdminRole;
  location_id: string | null;
};

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
  if (!data || typeof (data as VerifyResult).id !== "string") {
    return NextResponse.json(
      { error: "invalid_credentials" },
      { status: 401 }
    );
  }

  const result = data as VerifyResult;
  const token = await signAdminToken(
    result.id,
    username,
    result.role,
    result.location_id
  );
  const res = NextResponse.json({ ok: true, role: result.role });
  res.cookies.set(ADMIN_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24,
  });
  return res;
}
