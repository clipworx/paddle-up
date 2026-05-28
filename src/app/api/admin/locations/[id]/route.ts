import { NextResponse } from "next/server";
import { getAdminSupabase } from "@/lib/supabase-admin";
import { getAdminClaims } from "@/lib/server-auth";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, { params }: Params) {
  const claims = await getAdminClaims();
  if (!claims) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const { id } = await params;

  if (claims.role === "location_admin" && claims.location_id !== id) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  let body: {
    day_rate?: unknown; night_rate?: unknown; night_start_time?: unknown;
    open_hour?: unknown; close_hour?: unknown;
    weekend_open_hour?: unknown; weekend_close_hour?: unknown; weekend_night_start_time?: unknown;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const day_rate = typeof body.day_rate === "number" ? body.day_rate : null;
  const night_rate = typeof body.night_rate === "number" ? body.night_rate : null;
  const night_start_time = typeof body.night_start_time === "string" ? body.night_start_time : null;
  const open_hour = typeof body.open_hour === "number" ? body.open_hour : null;
  const close_hour = typeof body.close_hour === "number" ? body.close_hour : null;
  const weekend_open_hour = typeof body.weekend_open_hour === "number" ? body.weekend_open_hour : null;
  const weekend_close_hour = typeof body.weekend_close_hour === "number" ? body.weekend_close_hour : null;
  const weekend_night_start_time = typeof body.weekend_night_start_time === "string" ? body.weekend_night_start_time : null;

  if (day_rate === null || night_rate === null || !night_start_time ||
      open_hour === null || close_hour === null ||
      weekend_open_hour === null || weekend_close_hour === null || !weekend_night_start_time) {
    return NextResponse.json({ error: "invalid_fields" }, { status: 400 });
  }
  if (day_rate < 0 || night_rate < 0) {
    return NextResponse.json({ error: "rates_must_be_positive" }, { status: 400 });
  }
  if (open_hour < 0 || open_hour > 23 || close_hour < 1 || close_hour > 24) {
    return NextResponse.json({ error: "invalid_hours" }, { status: 400 });
  }
  if (open_hour >= close_hour) {
    return NextResponse.json({ error: "open_must_be_before_close" }, { status: 400 });
  }
  if (weekend_open_hour < 0 || weekend_open_hour > 23 || weekend_close_hour < 1 || weekend_close_hour > 24) {
    return NextResponse.json({ error: "invalid_weekend_hours" }, { status: 400 });
  }
  if (weekend_open_hour >= weekend_close_hour) {
    return NextResponse.json({ error: "weekend_open_must_be_before_close" }, { status: 400 });
  }

  const supabase = getAdminSupabase();
  const { error } = await supabase
    .from("locations")
    .update({
      day_rate, night_rate, night_start_time, open_hour, close_hour,
      weekend_open_hour, weekend_close_hour, weekend_night_start_time,
    })
    .eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function PUT(req: Request, { params }: Params) {
  const claims = await getAdminClaims();
  if (!claims) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const { id } = await params;

  if (claims.role === "location_admin" && claims.location_id !== id) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  let body: { name?: unknown; address?: unknown; description?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const name = typeof body.name === "string" ? body.name.trim() : null;
  const address = typeof body.address === "string" ? body.address.trim() || null : undefined;
  const description = typeof body.description === "string" ? body.description.trim() || null : undefined;

  if (name !== null && !name) {
    return NextResponse.json({ error: "name_required" }, { status: 400 });
  }

  const updates: Record<string, unknown> = {};
  if (name !== null) updates.name = name;
  if (address !== undefined) updates.address = address;
  if (description !== undefined) updates.description = description;

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "no_fields" }, { status: 400 });
  }

  const supabase = getAdminSupabase();
  const { error } = await supabase.from("locations").update(updates).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: Request, { params }: Params) {
  const claims = await getAdminClaims();
  if (!claims || claims.role !== "admin") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const supabase = getAdminSupabase();
  const { error } = await supabase.rpc("admin_deactivate_location", {
    p_location_id: id,
  });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
