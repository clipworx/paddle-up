import { NextResponse } from "next/server";
import { getAdminSupabase } from "@/lib/supabase-admin";
import { getAdminClaims } from "@/lib/server-auth";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, { params }: Params) {
  const claims = await getAdminClaims();
  if (!claims) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const { date, start_time, end_time } = body;

  if (!date || !start_time || !end_time)
    return NextResponse.json({ error: "missing_fields" }, { status: 400 });

  const supabase = getAdminSupabase();

  const { data: booking } = await supabase
    .from("bookings")
    .select("id, court_id, status, courts(location_id)")
    .eq("id", id)
    .single();

  if (!booking) return NextResponse.json({ error: "not_found" }, { status: 404 });

  if (claims.role === "location_admin" && claims.location_id) {
    const locationId = (booking.courts as unknown as { location_id: string } | null)?.location_id;
    if (locationId !== claims.location_id)
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  if (booking.status !== "confirmed" && booking.status !== "pending_payment")
    return NextResponse.json({ error: "cannot_reschedule" }, { status: 409 });

  const { data: conflicts } = await supabase
    .from("bookings")
    .select("id")
    .eq("court_id", booking.court_id)
    .eq("date", date)
    .neq("id", id)
    .in("status", ["confirmed", "pending_payment"])
    .lt("start_time", end_time)
    .gt("end_time", start_time);

  if (conflicts && conflicts.length > 0)
    return NextResponse.json({ error: "slot_taken" }, { status: 409 });

  const { error } = await supabase
    .from("bookings")
    .update({ date, start_time, end_time })
    .eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
