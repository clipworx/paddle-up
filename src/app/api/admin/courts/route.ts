import { NextResponse } from "next/server";
import { getAdminSupabase } from "@/lib/supabase-admin";
import { getAdminClaims } from "@/lib/server-auth";

export async function POST(req: Request) {
  const claims = await getAdminClaims();
  if (!claims) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: { name?: unknown; location_id?: unknown; parent_court_id?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const name = typeof body.name === "string" ? body.name.trim() : "";
  const location_id = typeof body.location_id === "string" ? body.location_id.trim() : "";
  const parent_court_id = typeof body.parent_court_id === "string" ? body.parent_court_id.trim() : null;

  if (!name) return NextResponse.json({ error: "name_required" }, { status: 400 });
  if (!location_id) return NextResponse.json({ error: "location_required" }, { status: 400 });

  if (claims.role === "location_admin" && claims.location_id !== location_id) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const supabase = getAdminSupabase();

  if (parent_court_id) {
    const { data: parent } = await supabase
      .from("courts")
      .select("location_id, parent_court_id")
      .eq("id", parent_court_id)
      .single();

    if (!parent) {
      return NextResponse.json({ error: "parent_not_found" }, { status: 400 });
    }
    if (parent.location_id !== location_id) {
      return NextResponse.json({ error: "parent_different_location" }, { status: 400 });
    }
    if (parent.parent_court_id) {
      return NextResponse.json({ error: "parent_cannot_be_child" }, { status: 400 });
    }
  }

  const { data, error } = await supabase
    .from("courts")
    .insert({ name, location_id, parent_court_id })
    .select("id, name, location_id, is_active, parent_court_id")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ court: data }, { status: 201 });
}
