import { NextResponse } from "next/server";
import { getAdminSupabase } from "@/lib/supabase-admin";
import { getAdminClaims } from "@/lib/server-auth";
import { TIME_RE, DATE_RE, normEndTime } from "@/lib/bookingValidation";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, { params }: Params) {
  const claims = await getAdminClaims();
  if (!claims) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const { date, start_time, end_time } = body;

  if (!date || !start_time || !end_time)
    return NextResponse.json({ error: "missing_fields" }, { status: 400 });
  if (!DATE_RE.test(date))
    return NextResponse.json({ error: "date_invalid" }, { status: 400 });
  if (!TIME_RE.test(start_time) || !TIME_RE.test(end_time))
    return NextResponse.json({ error: "time_invalid" }, { status: 400 });
  if (normEndTime(end_time) <= start_time)
    return NextResponse.json({ error: "time_range_invalid" }, { status: 400 });

  const supabase = getAdminSupabase();

  const { data: booking } = await supabase
    .from("bookings")
    .select("id, court_id, status, courts(location_id, parent_court_id)")
    .eq("id", id)
    .single();

  if (!booking) return NextResponse.json({ error: "not_found" }, { status: 404 });

  if (claims.role === "location_admin" && claims.location_id) {
    const locationId = (booking.courts as unknown as { location_id: string } | null)?.location_id;
    if (locationId !== claims.location_id)
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  if (booking.status !== "confirmed" && booking.status !== "pending_payment" && booking.status !== "pending_confirmation")
    return NextResponse.json({ error: "cannot_reschedule" }, { status: 409 });

  const { data: blockHits } = await supabase
    .from("court_blocks")
    .select("id")
    .eq("court_id", booking.court_id)
    .eq("date", date)
    .lt("start_time", end_time)
    .gt("end_time", start_time)
    .limit(1);

  if (blockHits && blockHits.length > 0)
    return NextResponse.json({ error: "slot_blocked" }, { status: 409 });

  const { data: conflicts } = await supabase
    .from("bookings")
    .select("id")
    .eq("court_id", booking.court_id)
    .eq("date", date)
    .neq("id", id)
    .in("status", ["confirmed", "pending_payment", "pending_confirmation"])
    .lt("start_time", end_time)
    .gt("end_time", start_time);

  if (conflicts && conflicts.length > 0)
    return NextResponse.json({ error: "slot_taken" }, { status: 409 });

  // Parent/child conflict check — rescheduling into a slot already held by a
  // related shared-space booking (parent ↔ child) must be blocked too.
  const parentId = (booking.courts as unknown as { parent_court_id: string | null } | null)?.parent_court_id ?? null;
  const conflictingCourtIds: string[] = [];
  if (parentId) {
    conflictingCourtIds.push(parentId);
  } else {
    const { data: children } = await supabase
      .from("courts")
      .select("id")
      .eq("parent_court_id", booking.court_id);
    if (children?.length) conflictingCourtIds.push(...children.map((c) => c.id));
  }
  if (conflictingCourtIds.length > 0) {
    const { data: relatedConflicts } = await supabase
      .from("bookings")
      .select("id")
      .in("court_id", conflictingCourtIds)
      .eq("date", date)
      .in("status", ["confirmed", "pending_payment", "pending_confirmation"])
      .lt("start_time", end_time)
      .gt("end_time", start_time)
      .limit(1);
    if (relatedConflicts && relatedConflicts.length > 0)
      return NextResponse.json({ error: "slot_taken" }, { status: 409 });
  }

  const { error } = await supabase
    .from("bookings")
    .update({ date, start_time, end_time })
    .eq("id", id);

  if (error) {
    if (error.code === "23505")
      return NextResponse.json({ error: "slot_taken" }, { status: 409 });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
