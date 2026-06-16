import { NextResponse } from "next/server";
import { getAdminSupabase } from "@/lib/supabase-admin";
import { getAdminClaims } from "@/lib/server-auth";
import { sendBookingNotification } from "@/lib/email";

export async function POST(req: Request) {
  const claims = await getAdminClaims();
  if (!claims) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const { court_id, date, start_time, end_time, booker_name, booker_phone, booker_email, notes } = body;

  const emailStr = typeof booker_email === "string" ? booker_email.trim().toLowerCase() : "";
  if (!court_id || !date || !start_time || !end_time || !booker_name?.trim() || !booker_phone?.trim() || !emailStr)
    return NextResponse.json({ error: "missing_fields" }, { status: 400 });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailStr))
    return NextResponse.json({ error: "invalid_email" }, { status: 400 });

  const supabase = getAdminSupabase();

  // Fetch court + location for auth check and email
  const { data: courtRow } = await supabase
    .from("courts")
    .select("name, location_id, locations(name)")
    .eq("id", court_id)
    .single();

  if (claims.role === "location_admin" && claims.location_id) {
    if (!courtRow || courtRow.location_id !== claims.location_id)
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
      booker_email: emailStr,
      notes: notes?.trim() || null,
      player_count: 4,
      status: "confirmed",
    })
    .select("id")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Fire-and-forget: confirmation to booker + notification to location admin
  const loc = courtRow?.locations as unknown as { name: string } | null;
  const emailData = {
    locationName: loc?.name ?? "",
    courtName: courtRow?.name ?? "",
    date,
    startTime: start_time,
    endTime: end_time,
    bookerName: booker_name.trim(),
    bookerEmail: emailStr,
    playerCount: 0,
    notes: notes?.trim() || null,
    status: "confirmed" as const,
    bookingId: data.id,
  };

  if (courtRow?.location_id) {
    supabase
      .from("admins")
      .select("email")
      .eq("location_id", courtRow.location_id)
      .eq("role", "location_admin")
      .not("email", "is", null)
      .limit(1)
      .single()
      .then(({ data: adminRow }) => {
        if (adminRow?.email) {
          Promise.resolve(sendBookingNotification(adminRow.email, emailData)).catch(() => {});
        }
      });
  }

  return NextResponse.json({ booking: data }, { status: 201 });
}

export async function GET(req: Request) {
  const claims = await getAdminClaims();
  if (!claims) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const page       = Math.max(1, parseInt(searchParams.get("page")  ?? "1",  10));
  const limit      = Math.min(200, Math.max(1, parseInt(searchParams.get("limit") ?? "20", 10)));
  const status     = searchParams.get("status");
  const search     = searchParams.get("search")?.trim() ?? "";
  const date       = searchParams.get("date")?.trim();
  const locationId = searchParams.get("location_id")?.trim();
  const offset     = (page - 1) * limit;

  const supabase = getAdminSupabase();

  let courtIds: string[] | null = null;
  if (claims.role === "location_admin" && claims.location_id) {
    const { data: locationCourts } = await supabase
      .from("courts").select("id").eq("location_id", claims.location_id);
    courtIds = locationCourts?.map((c) => c.id) ?? [];
    if (courtIds.length === 0) return NextResponse.json({ bookings: [], total: 0, page, limit });
  } else if (claims.role === "admin" && locationId) {
    const { data: locCourts } = await supabase
      .from("courts").select("id").eq("location_id", locationId);
    courtIds = locCourts?.map((c) => c.id) ?? [];
    if (courtIds.length === 0) return NextResponse.json({ bookings: [], total: 0, page, limit });
  }

  let query = supabase
    .from("bookings")
    .select("id, court_id, date, start_time, end_time, booker_name, booker_phone, booker_email, player_count, notes, status, refund_reason, created_at, courts(name, locations(name))", { count: "exact" })
    .order("date", { ascending: false })
    .order("start_time", { ascending: false })
    .range(offset, offset + limit - 1);

  if (courtIds) query = query.in("court_id", courtIds);
  if (status)   query = query.eq("status", status);
  if (date)     query = query.eq("date", date);
  if (search)   query = query.or(`booker_name.ilike.%${search}%,booker_phone.ilike.%${search}%,booker_email.ilike.%${search}%`);

  const { data, error, count } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const bookings = (data ?? []).map((b) => {
    const court = b.courts as unknown as { name: string; locations: { name: string } | null } | null;
    return {
      ...b,
      court_name: court?.name ?? null,
      location_name: court?.locations?.name ?? null,
      courts: undefined,
    };
  });

  return NextResponse.json({ bookings, total: count ?? 0, page, limit });
}
