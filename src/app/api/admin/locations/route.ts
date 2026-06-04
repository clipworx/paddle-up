import { NextResponse } from "next/server";
import { getAdminSupabase } from "@/lib/supabase-admin";
import { getAdminClaims } from "@/lib/server-auth";

function toSlug(name: string): string {
  return name.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

async function uniqueSlug(supabase: ReturnType<typeof getAdminSupabase>, base: string, excludeId?: string): Promise<string> {
  let slug = base;
  let n = 2;
  for (;;) {
    const q = supabase.from("locations").select("id").eq("slug", slug).limit(1);
    if (excludeId) q.neq("id", excludeId);
    const { data } = await q;
    if (!data?.length) return slug;
    slug = `${base}-${n++}`;
  }
}

export async function GET() {
  const supabase = getAdminSupabase();
  const { data, error } = await supabase
    .from("locations")
    .select("id, name, slug, address, description, is_active, day_rate, night_rate, night_start_time, open_hour, close_hour, weekend_night_start_time, weekend_open_hour, weekend_close_hour, payment_qr_url, payment_account_name, payment_account_number, latitude, longitude, logo_url, accent_color, subscription_due_date, subscription_grace_days, courts(id, name, description, is_active, parent_court_id)")
    .order("name");
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  const locations = (data ?? []).map((loc) => ({
    ...loc,
    court_count: Array.isArray(loc.courts) ? loc.courts.length : 0,
  }));
  return NextResponse.json({ locations });
}

export async function POST(req: Request) {
  const claims = await getAdminClaims();
  if (!claims || claims.role !== "admin") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  let body: {
    name?: unknown;
    address?: unknown;
    description?: unknown;
    court_count?: unknown;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const name = typeof body.name === "string" ? body.name.trim() : "";
  const address = typeof body.address === "string" ? body.address.trim() : "";
  const description = typeof body.description === "string" ? body.description.trim() : "";
  const court_count = typeof body.court_count === "number" ? body.court_count : 0;

  if (!name) {
    return NextResponse.json({ error: "name_required" }, { status: 400 });
  }
  if (court_count < 1 || court_count > 16) {
    return NextResponse.json({ error: "court_count_out_of_range" }, { status: 400 });
  }

  const supabase = getAdminSupabase();
  const { data: locId, error } = await supabase.rpc("admin_create_location", {
    p_name: name,
    p_address: address,
    p_description: description,
    p_court_count: court_count,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Set the slug after creation (RPC doesn't handle it).
  const slug = await uniqueSlug(supabase, toSlug(name));
  await supabase.from("locations").update({ slug }).eq("id", locId);

  return NextResponse.json({ id: locId }, { status: 201 });
}
