import { NextResponse } from "next/server";
import { getAdminSupabase } from "@/lib/supabase-admin";
import { getAdminClaims } from "@/lib/server-auth";

export async function POST(req: Request) {
  const claims = await getAdminClaims();
  if (!claims) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: { name?: unknown; location_id?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const name = typeof body.name === "string" ? body.name.trim() : "";
  const location_id = typeof body.location_id === "string" ? body.location_id.trim() : "";

  if (!name) return NextResponse.json({ error: "name_required" }, { status: 400 });
  if (!location_id) return NextResponse.json({ error: "location_required" }, { status: 400 });

  // location_admin can only add courts to their own location
  if (claims.role === "location_admin" && claims.location_id !== location_id) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const supabase = getAdminSupabase();
  const { data, error } = await supabase
    .from("courts")
    .insert({ name, location_id })
    .select("id, name, location_id, is_active")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ court: data }, { status: 201 });
}
