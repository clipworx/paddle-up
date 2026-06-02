import { NextResponse } from "next/server";
import { getAdminSupabase } from "@/lib/supabase-admin";
import { getAdminClaims } from "@/lib/server-auth";

export async function POST(req: Request) {
  const claims = await getAdminClaims();
  if (!claims) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const { court_id, date, start_time, end_time, booker_name, booker_phone, booker_email, notes } = body;

  if (!court_id || !date || !start_time || !end_time || !booker_name?.trim() || !booker_phone?.trim())
    return NextResponse.json({ error: "missing_fields" }, { status: 400 });

  const supabase = getAdminSupabase();

  // Verify court belongs to admin's location
  if (claims.role === "location_admin" && claims.location_id) {
    const { data: court } = await supabase
      .from("courts")
      .select("location_id")
      .eq("id", court_id)
      .single();
    if (!court || court.location_id !== claims.location_id)
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  // Conflict check
  const { data: conflicts } = await supabase
    .from("bookings")
    .select("id")
    .eq("court_id", court_id)
    .eq("date", date)
    .in("status", ["confirmed", "pending_payment"])
    .lt("start_time", end_time)
    .gt("end_time", start_time);

  if (conflicts && conflicts.length > 0)
    return NextResponse.json({ error: "slot_taken" }, { status: 409 });

  const { data, error } = await supabase
    .from("bookings")
    .insert({
      court_id,
      date,
      start_time,
      end_time,
      booker_name: booker_name.trim(),
      booker_phone: booker_phone.trim(),
      booker_email: booker_email?.trim() || null,
      notes: notes?.trim() || null,
      player_count: 4,
      status: "confirmed",
    })
    .select("id")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ booking: data }, { status: 201 });
}

export async function GET(req: Request) {
  const claims = await getAdminClaims();
  if (!claims) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const page   = Math.max(1, parseInt(searchParams.get("page")  ?? "1",  10));
  const limit  = Math.min(50, Math.max(1, parseInt(searchParams.get("limit") ?? "20", 10)));
  const status = searchParams.get("status");
  const search = searchParams.get("search")?.trim() ?? "";
  const offset = (page - 1) * limit;

  const supabase = getAdminSupabase();

  let courtIds: string[] | null = null;
  if (claims.role === "location_admin" && claims.location_id) {
    const { data: locationCourts } = await supabase
      .from("courts").select("id").eq("location_id", claims.location_id);
    courtIds = locationCourts?.map((c) => c.id) ?? [];
    if (courtIds.length === 0) return NextResponse.json({ bookings: [], total: 0, page, limit });
  }

  let query = supabase
    .from("bookings")
    .select("id, court_id, date, start_time, end_time, booker_name, booker_phone, booker_email, player_count, notes, status, refund_reason, created_at, courts(name)", { count: "exact" })
    .order("date", { ascending: false })
    .order("start_time", { ascending: false })
    .range(offset, offset + limit - 1);

  if (courtIds) query = query.in("court_id", courtIds);
  if (status)   query = query.eq("status", status);
  if (search)   query = query.or(`booker_name.ilike.%${search}%,booker_phone.ilike.%${search}%,booker_email.ilike.%${search}%`);

  const { data, error, count } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const bookings = (data ?? []).map((b) => ({
    ...b,
    court_name: (b.courts as unknown as { name: string } | null)?.name ?? null,
    courts: undefined,
  }));

  return NextResponse.json({ bookings, total: count ?? 0, page, limit });
}
