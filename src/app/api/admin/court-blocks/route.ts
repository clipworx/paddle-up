import { NextResponse } from "next/server";
import { getAdminSupabase } from "@/lib/supabase-admin";
import { getAdminClaims } from "@/lib/server-auth";

const MAX_RANGE_DAYS = 90;

function* datesBetween(startIso: string, endIso: string): Generator<string> {
  const [sy, sm, sd] = startIso.split("-").map(Number);
  const [ey, em, ed] = endIso.split("-").map(Number);
  const cur = new Date(sy, sm - 1, sd);
  const end = new Date(ey, em - 1, ed);
  while (cur <= end) {
    const y = cur.getFullYear();
    const m = String(cur.getMonth() + 1).padStart(2, "0");
    const d = String(cur.getDate()).padStart(2, "0");
    yield `${y}-${m}-${d}`;
    cur.setDate(cur.getDate() + 1);
  }
}

export async function POST(req: Request) {
  const claims = await getAdminClaims();
  if (!claims || claims.role !== "location_admin" || !claims.location_id) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const { court_ids, all_courts, start_date, end_date, start_time, end_time, reason } = body;

  if (!start_date || !end_date || !start_time || !end_time) {
    return NextResponse.json({ error: "missing_fields" }, { status: 400 });
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(start_date) || !/^\d{4}-\d{2}-\d{2}$/.test(end_date)) {
    return NextResponse.json({ error: "invalid_date" }, { status: 400 });
  }
  if (end_date < start_date) {
    return NextResponse.json({ error: "invalid_range" }, { status: 400 });
  }
  if (!all_courts && (!Array.isArray(court_ids) || court_ids.length === 0)) {
    return NextResponse.json({ error: "court_required" }, { status: 400 });
  }

  const supabase = getAdminSupabase();

  let courtIds: string[];
  if (all_courts) {
    const { data: courts } = await supabase
      .from("courts")
      .select("id")
      .eq("location_id", claims.location_id);
    courtIds = (courts ?? []).map((c) => c.id);
  } else {
    const { data: courts } = await supabase
      .from("courts")
      .select("id")
      .eq("location_id", claims.location_id)
      .in("id", court_ids as string[]);
    courtIds = (courts ?? []).map((c) => c.id);
  }

  if (courtIds.length === 0) {
    return NextResponse.json({ error: "court_required" }, { status: 400 });
  }

  const dates: string[] = [];
  for (const d of datesBetween(start_date, end_date)) {
    dates.push(d);
    if (dates.length > MAX_RANGE_DAYS) {
      return NextResponse.json({ error: "range_too_long" }, { status: 400 });
    }
  }

  const rows = courtIds.flatMap((court_id) =>
    dates.map((date) => ({
      court_id,
      date,
      start_time,
      end_time,
      reason: typeof reason === "string" ? reason.trim() || null : null,
    }))
  );

  const { data: inserted, error } = await supabase
    .from("court_blocks")
    .insert(rows)
    .select("id");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Surface any existing bookings that now fall inside a blocked window —
  // the block is created regardless; the admin handles these manually.
  const { data: conflicts } = await supabase
    .from("bookings")
    .select("id, court_id, date, start_time, end_time, booker_name, status, courts(name)")
    .in("court_id", courtIds)
    .in("date", dates)
    .in("status", ["confirmed", "pending_payment"])
    .lt("start_time", end_time)
    .gt("end_time", start_time);

  const conflictList = (conflicts ?? []).map((c) => ({
    id: c.id,
    court_name: (c.courts as unknown as { name: string } | null)?.name ?? "",
    date: c.date,
    start_time: c.start_time,
    end_time: c.end_time,
    booker_name: c.booker_name,
    status: c.status,
  }));

  return NextResponse.json({ ok: true, created: inserted?.length ?? 0, conflicts: conflictList });
}
