import { NextResponse } from "next/server";
import { getAdminSupabase } from "@/lib/supabase-admin";
import { getAdminClaims } from "@/lib/server-auth";

export async function GET() {
  const claims = await getAdminClaims();
  if (!claims || claims.role !== "admin") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const supabase = getAdminSupabase();
  const { data, error } = await supabase.rpc("admin_list_admins");
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ admins: data ?? [] });
}

export async function POST(req: Request) {
  const claims = await getAdminClaims();
  if (!claims || claims.role !== "admin") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  let body: {
    role?: unknown;
    username?: unknown;
    password?: unknown;
    location_id?: unknown;
    email?: unknown;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const role = body.role === "admin" ? "admin" : "location_admin";
  const username = typeof body.username === "string" ? body.username.trim() : "";
  const password = typeof body.password === "string" ? body.password : "";
  const location_id = typeof body.location_id === "string" ? body.location_id : "";
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() || null : null;

  if (!username) return NextResponse.json({ error: "username_required" }, { status: 400 });
  if (password.length < 4) return NextResponse.json({ error: "password_too_short" }, { status: 400 });
  if (role === "location_admin" && !location_id) {
    return NextResponse.json({ error: "location_required" }, { status: 400 });
  }
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "email_invalid" }, { status: 400 });
  }

  const supabase = getAdminSupabase();
  const rpc =
    role === "admin"
      ? supabase.rpc("admin_create_admin", { p_username: username, p_password: password })
      : supabase.rpc("admin_create_location_admin", {
          p_username: username,
          p_password: password,
          p_location_id: location_id,
        });

  const { data, error: rpcError } = await rpc;

  if (rpcError) {
    if (/unique/i.test(rpcError.message)) {
      return NextResponse.json({ error: "username_taken" }, { status: 409 });
    }
    return NextResponse.json({ error: rpcError.message }, { status: 500 });
  }

  if (email && data) {
    await supabase.from("admins").update({ email }).eq("id", data as string);
  }

  return NextResponse.json({ id: data }, { status: 201 });
}
