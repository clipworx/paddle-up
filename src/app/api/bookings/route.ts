import { NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/supabase-server";
import { getAdminSupabase } from "@/lib/supabase-admin";
import { sendBookingNotification } from "@/lib/email";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const date = searchParams.get("date");
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: "date_required" }, { status: 400 });
  }

  const supabase = getServerSupabase();
  const { data, error } = await supabase
    .from("bookings")
    .select("id, court_id, date, start_time, end_time, booker_name, booker_email, player_count, notes, status, created_at")
    .eq("date", date)
    .in("status", ["confirmed", "pending_payment"])
    .order("start_time");
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ bookings: data ?? [] });
}

export async function POST(req: Request) {
  let body: {
    court_id?: unknown;
    date?: unknown;
    start_time?: unknown;
    end_time?: unknown;
    booker_name?: unknown;
    booker_email?: unknown;
    player_count?: unknown;
    notes?: unknown;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const court_id = typeof body.court_id === "string" ? body.court_id.trim() : "";
  const date = typeof body.date === "string" ? body.date.trim() : "";
  const start_time = typeof body.start_time === "string" ? body.start_time.trim() : "";
  const end_time = typeof body.end_time === "string" ? body.end_time.trim() : "";
  const booker_name = typeof body.booker_name === "string" ? body.booker_name.trim() : "";
  const booker_email = typeof body.booker_email === "string" ? body.booker_email.trim().toLowerCase() : "";
  const player_count = typeof body.player_count === "number" ? body.player_count : 4;
  const notes = typeof body.notes === "string" ? body.notes.trim() || null : null;

  if (!court_id || !date || !start_time || !end_time) {
    return NextResponse.json({ error: "missing_fields" }, { status: 400 });
  }
  if (!booker_name) {
    return NextResponse.json({ error: "name_required" }, { status: 400 });
  }
  if (!booker_email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(booker_email)) {
    return NextResponse.json({ error: "valid_email_required" }, { status: 400 });
  }
  if (player_count < 2 || player_count > 4) {
    return NextResponse.json({ error: "player_count_invalid" }, { status: 400 });
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: "date_invalid" }, { status: 400 });
  }

  const supabase = getServerSupabase();

  // Fetch location info + court name via the court's location
  const { data: courtRow } = await supabase
    .from("courts")
    .select("name, location_id, locations(name, payment_qr_url, payment_account_name, payment_account_number)")
    .eq("id", court_id)
    .single();

  const loc = (courtRow?.locations as unknown) as {
    name: string;
    payment_qr_url: string | null;
    payment_account_name: string | null;
    payment_account_number: string | null;
  } | null;

  const requiresPayment = !!loc?.payment_qr_url;
  const status = requiresPayment ? "pending_payment" : "confirmed";

  const { data, error } = await supabase
    .from("bookings")
    .insert({ court_id, date, start_time, end_time, booker_name, booker_email, player_count, notes, status })
    .select("id")
    .single();

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json({ error: "slot_taken" }, { status: 409 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Fire-and-forget: notify the location admin by email
  if (courtRow?.location_id) {
    const adminSupabase = getAdminSupabase();
    adminSupabase
      .from("admins")
      .select("email")
      .eq("location_id", courtRow.location_id)
      .eq("role", "location_admin")
      .not("email", "is", null)
      .limit(1)
      .single()
      .then(({ data: adminRow }) => {
        if (adminRow?.email) {
          sendBookingNotification(adminRow.email, {
            locationName: loc?.name ?? "",
            courtName: courtRow.name ?? "",
            date,
            startTime: start_time,
            endTime: end_time,
            bookerName: booker_name,
            bookerEmail: booker_email,
            playerCount: player_count,
            notes,
            status: status as "confirmed" | "pending_payment",
            bookingId: data.id,
          }).catch(() => {});
        }
      })
      .catch(() => {});
  }

  return NextResponse.json({
    booking: data,
    requires_payment: requiresPayment,
    payment_qr_url: loc?.payment_qr_url ?? null,
    payment_account_name: loc?.payment_account_name ?? null,
    payment_account_number: loc?.payment_account_number ?? null,
  }, { status: 201 });
}
