import { NextResponse } from "next/server";
import { getAdminSupabase } from "@/lib/supabase-admin";
import { getAdminClaims } from "@/lib/server-auth";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, { params }: Params) {
  const claims = await getAdminClaims();
  if (!claims) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await params;
  const supabase = getAdminSupabase();

  // Fetch the court to check ownership and get its location
  const { data: court } = await supabase
    .from("courts")
    .select("location_id, parent_court_id")
    .eq("id", id)
    .single();

  if (claims.role === "location_admin") {
    if (!court || court.location_id !== claims.location_id) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }
  }

  let body: { name?: unknown; description?: unknown; is_active?: unknown; parent_court_id?: unknown; custom_day_rate?: unknown; custom_night_rate?: unknown; custom_rate_unit?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const name = typeof body.name === "string" ? body.name.trim() : null;
  const description = typeof body.description === "string" ? body.description.trim() || null : undefined;
  const is_active = typeof body.is_active === "boolean" ? body.is_active : undefined;
  // null = unlink parent; string = set parent; undefined = not provided
  const parent_court_id =
    body.parent_court_id === null ? null :
    typeof body.parent_court_id === "string" ? body.parent_court_id.trim() :
    undefined;

  if (name !== null && !name) {
    return NextResponse.json({ error: "name_required" }, { status: 400 });
  }

  // Validate the new parent if one is being set
  if (parent_court_id) {
    const { data: parent } = await supabase
      .from("courts")
      .select("location_id, parent_court_id")
      .eq("id", parent_court_id)
      .single();

    if (!parent) {
      return NextResponse.json({ error: "parent_not_found" }, { status: 400 });
    }
    if (court && parent.location_id !== court.location_id) {
      return NextResponse.json({ error: "parent_different_location" }, { status: 400 });
    }
    if (parent.parent_court_id) {
      return NextResponse.json({ error: "parent_cannot_be_child" }, { status: 400 });
    }
    // Prevent setting a parent on a court that already has children
    const { count } = await supabase
      .from("courts")
      .select("id", { count: "exact", head: true })
      .eq("parent_court_id", id);
    if (count && count > 0) {
      return NextResponse.json({ error: "court_has_children" }, { status: 400 });
    }
  }

  // custom_day_rate / custom_night_rate: null clears override, number sets it, missing = no change
  const custom_day_rate =
    body.custom_day_rate === null ? null :
    typeof body.custom_day_rate === "number" && body.custom_day_rate >= 0 ? body.custom_day_rate :
    undefined;
  const custom_night_rate =
    body.custom_night_rate === null ? null :
    typeof body.custom_night_rate === "number" && body.custom_night_rate >= 0 ? body.custom_night_rate :
    undefined;

  const updates: Record<string, unknown> = {};
  if (name !== null) updates.name = name;
  if (description !== undefined) updates.description = description;
  if (is_active !== undefined) updates.is_active = is_active;
  if (parent_court_id !== undefined) updates.parent_court_id = parent_court_id;
  const custom_rate_unit =
    body.custom_rate_unit === "pax" ? "pax" :
    body.custom_rate_unit === "flat" ? "flat" :
    body.custom_rate_unit === "hr" ? "hr" :
    undefined;

  if (custom_day_rate !== undefined) updates.custom_day_rate = custom_day_rate;
  if (custom_night_rate !== undefined) updates.custom_night_rate = custom_night_rate;
  if (custom_rate_unit !== undefined) updates.custom_rate_unit = custom_rate_unit;

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "no_fields" }, { status: 400 });
  }

  const { error } = await supabase.from("courts").update(updates).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: Request, { params }: Params) {
  const claims = await getAdminClaims();
  if (!claims) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const supabase = getAdminSupabase();

  if (claims.role === "location_admin") {
    const { data: court } = await supabase
      .from("courts")
      .select("location_id")
      .eq("id", id)
      .single();
    if (!court || court.location_id !== claims.location_id) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }
  }

  const { error } = await supabase
    .from("courts")
    .update({ is_active: false })
    .eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
