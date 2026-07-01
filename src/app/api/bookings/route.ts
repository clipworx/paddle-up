import { NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/supabase-server";
import { getAdminSupabase } from "@/lib/supabase-admin";
import { sendBookingNotification, sendBookingConfirmation } from "@/lib/email";
import { sendTelegramMessage, buildNewBookingMessage } from "@/lib/telegram";
import { TIME_RE, DATE_RE, normEndTime, calcBookingPrice } from "@/lib/bookingValidation";
import { createInvoice } from "@/lib/xendit";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const date = searchParams.get("date");
  if (!date || !DATE_RE.test(date)) {
    return NextResponse.json({ error: "date_required" }, { status: 400 });
  }

  const supabase = getServerSupabase();
  // Opportunistically expire any unpaid bookings past their location's
  // threshold before reading — no cron in this app, so this is what keeps
  // stale pending_payment rows from holding their slot indefinitely.
  await supabase.rpc("expire_pending_bookings");

  const { data, error } = await supabase
    .from("bookings")
    .select("id, court_id, date, start_time, end_time, booker_name, booker_phone, booker_email, player_count, notes, status, created_at")
    .eq("date", date)
    .in("status", ["confirmed", "pending_payment", "pending_confirmation"])
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
    booker_phone?: unknown;
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
  const booker_phone = typeof body.booker_phone === "string" ? body.booker_phone.trim() : "";
  const booker_email = typeof body.booker_email === "string" ? body.booker_email.trim().toLowerCase() : "";
  const player_count = typeof body.player_count === "number" ? body.player_count : 4;
  const rawNotes = typeof body.notes === "string" ? body.notes.trim() : "";
  const notes = rawNotes || null;

  if (!court_id || !date || !start_time || !end_time) {
    return NextResponse.json({ error: "missing_fields" }, { status: 400 });
  }
  if (!booker_name) {
    return NextResponse.json({ error: "name_required" }, { status: 400 });
  }
  if (booker_name.length > 100) {
    return NextResponse.json({ error: "name_too_long" }, { status: 400 });
  }
  if (!booker_phone) {
    return NextResponse.json({ error: "phone_required" }, { status: 400 });
  }
  const normalizedPhone = booker_phone.replace(/[\s\-().]/g, "");
  if (!/^(\+?63|0)9\d{9}$/.test(normalizedPhone)) {
    return NextResponse.json({ error: "phone_invalid" }, { status: 400 });
  }
  if (!booker_email) {
    return NextResponse.json({ error: "email_required" }, { status: 400 });
  }
  if (booker_email.length > 200 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(booker_email)) {
    return NextResponse.json({ error: "valid_email_required" }, { status: 400 });
  }
  if (rawNotes.length > 500) {
    return NextResponse.json({ error: "notes_too_long" }, { status: 400 });
  }
  if (!DATE_RE.test(date)) {
    return NextResponse.json({ error: "date_invalid" }, { status: 400 });
  }
  if (!TIME_RE.test(start_time) || !TIME_RE.test(end_time)) {
    return NextResponse.json({ error: "time_invalid" }, { status: 400 });
  }
  if (normEndTime(end_time) <= start_time) {
    return NextResponse.json({ error: "time_range_invalid" }, { status: 400 });
  }
  const [slotY, slotM, slotD] = date.split("-").map(Number);
  const [slotH, slotMin] = start_time.split(":").map(Number);
  if (new Date(slotY, slotM - 1, slotD, slotH, slotMin) < new Date()) {
    return NextResponse.json({ error: "slot_in_past" }, { status: 400 });
  }

  const supabase = getServerSupabase();

  // Fetch court + location info; verify location is active and subscription is valid
  const { data: courtRow } = await supabase
    .from("courts")
    .select("name, location_id, is_active, parent_court_id, custom_rate_unit, custom_day_rate, custom_night_rate, locations(name, is_active, day_rate, night_rate, allow_half_hour_bookings, payment_qr_url, payment_account_name, payment_account_number, subscription_due_date, subscription_grace_days, night_start_time, weekend_night_start_time, require_downpayment, downpayment_min_hours, no_split_rate_booking, auto_expire_pending_payment, pending_payment_expiry_hours, xendit_enabled)")
    .eq("id", court_id)
    .single();

  const isPaxCourt = courtRow?.custom_rate_unit === "pax" && courtRow?.custom_day_rate != null;
  const minPlayers = isPaxCourt ? 1 : 2;
  const maxPlayers = isPaxCourt ? 50 : 4;
  if (player_count < minPlayers || player_count > maxPlayers) {
    return NextResponse.json({ error: "player_count_invalid" }, { status: 400 });
  }

  const loc = (courtRow?.locations as unknown) as {
    name: string;
    is_active: boolean;
    day_rate: number;
    night_rate: number;
    allow_half_hour_bookings: boolean;
    payment_qr_url: string | null;
    payment_account_name: string | null;
    payment_account_number: string | null;
    subscription_due_date: string | null;
    subscription_grace_days: number;
    night_start_time: string;
    weekend_night_start_time: string;
    require_downpayment: boolean;
    downpayment_min_hours: number;
    no_split_rate_booking: boolean;
    auto_expire_pending_payment: boolean;
    pending_payment_expiry_hours: number;
    xendit_enabled: boolean;
  } | null;

  if (!courtRow?.is_active || !loc?.is_active) {
    return NextResponse.json({ error: "location_inactive" }, { status: 409 });
  }

  if (loc.subscription_due_date) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const graceEnd = new Date(loc.subscription_due_date);
    graceEnd.setDate(graceEnd.getDate() + (loc.subscription_grace_days ?? 7));
    if (today > graceEnd) {
      return NextResponse.json({ error: "location_subscription_expired" }, { status: 409 });
    }
  }

  // ── Booking policy checks ─────────────────────────────────────────────────
  // Determine if date is a weekend for correct night_start
  const [bY, bM, bD] = (date as string).split("-").map(Number);
  const dow = new Date(bY, bM - 1, bD).getDay();
  const isWeekend = dow === 0 || dow === 6;
  const nightStartStr = isWeekend
    ? (loc.weekend_night_start_time ?? "18:00:00")
    : (loc.night_start_time ?? "18:00:00");
  const nightStartH = parseInt(nightStartStr.slice(0, 2), 10);

  const bookingStartH = parseInt((start_time as string).slice(0, 2), 10);
  const bookingEndH   = (end_time as string) === "00:00" ? 24 : parseInt((end_time as string).slice(0, 2), 10);
  const durationH     = bookingEndH - bookingStartH;

  // No-split-rate: booking must not cross the day→night boundary
  if (loc.no_split_rate_booking) {
    const startsInDay  = bookingStartH < nightStartH;
    const endsInNight  = bookingEndH   > nightStartH;
    if (startsInDay && endsInNight) {
      return NextResponse.json({ error: "split_rate_not_allowed" }, { status: 409 });
    }
  }

  // Down-payment flag — passed back to client, no server enforcement needed
  const requiresDownpayment =
    (loc.require_downpayment ?? false) && durationH > (loc.downpayment_min_hours ?? 3);

  // ── Blocked-slot check ────────────────────────────────────────────────────
  const { data: blockHits } = await supabase
    .from("court_blocks")
    .select("id")
    .eq("court_id", court_id)
    .eq("date", date)
    .lt("start_time", end_time)
    .gt("end_time", start_time)
    .limit(1);

  if (blockHits && blockHits.length > 0) {
    return NextResponse.json({ error: "slot_blocked" }, { status: 409 });
  }

  // ── Parent/child conflict check ───────────────────────────────────────────
  // Booking a parent blocks all its children; booking a child blocks the parent.
  const parentId = (courtRow as { parent_court_id?: string | null }).parent_court_id ?? null;
  const conflictingCourtIds: string[] = [];

  if (parentId) {
    // This court is a child → the parent must not be booked in this window
    conflictingCourtIds.push(parentId);
  } else {
    // This court might be a parent → none of its children can be booked in this window
    const { data: children } = await supabase
      .from("courts")
      .select("id")
      .eq("parent_court_id", court_id);
    if (children?.length) {
      conflictingCourtIds.push(...children.map((c) => c.id));
    }
  }

  if (conflictingCourtIds.length > 0) {
    const { data: conflictHits } = await supabase
      .from("bookings")
      .select("id")
      .in("court_id", conflictingCourtIds)
      .eq("date", date)
      .in("status", ["confirmed", "pending_payment", "pending_confirmation"])
      .lt("start_time", end_time)
      .gt("end_time", start_time)
      .limit(1);

    if (conflictHits && conflictHits.length > 0) {
      return NextResponse.json({ error: "slot_taken" }, { status: 409 });
    }
  }
  // ─────────────────────────────────────────────────────────────────────────

  const useXendit = !!loc?.xendit_enabled;
  const requiresPayment = useXendit || !!loc?.payment_qr_url;
  const status = requiresPayment ? "pending_payment" : "confirmed";
  const payment_gateway = useXendit ? "xendit" : null;

  const { data, error } = await supabase
    .from("bookings")
    .insert({ court_id, date, start_time, end_time, booker_name, booker_phone, booker_email, player_count, notes, status, payment_gateway })
    .select("id")
    .single();

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json({ error: "slot_taken" }, { status: 409 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const origin = new URL(req.url).origin;
  let xenditInvoiceUrl: string | null = null;

  if (useXendit && loc) {
    const totalPrice = calcBookingPrice({
      startTime: start_time,
      endTime: end_time,
      dayRate: loc.day_rate,
      nightRate: loc.night_rate,
      nightStartHour: nightStartH,
      customDayRate: courtRow?.custom_day_rate ?? null,
      customNightRate: (courtRow as { custom_night_rate?: number | null })?.custom_night_rate ?? null,
      customRateUnit: (courtRow?.custom_rate_unit as "hr" | "pax" | "flat" | null) ?? null,
      allowHalfHour: loc.allow_half_hour_bookings,
      playerCount: player_count,
    });

    const invoice = totalPrice > 0 ? await createInvoice({
      externalId: data.id,
      amount: totalPrice,
      payerEmail: booker_email,
      payerName: booker_name,
      description: `${courtRow?.name ?? "Court"} booking — ${date} ${start_time}-${end_time}`,
      successRedirectUrl: `${origin}/book/receipt/${data.id}`,
      failureRedirectUrl: `${origin}/book/receipt/${data.id}`,
    }) : null;

    if (!invoice) {
      // Payment setup failed — release the slot rather than leave an unpayable booking.
      await supabase.from("bookings").delete().eq("id", data.id);
      return NextResponse.json({ error: "payment_setup_failed" }, { status: 502 });
    }

    await supabase
      .from("bookings")
      .update({ xendit_invoice_id: invoice.id, xendit_invoice_url: invoice.invoice_url })
      .eq("id", data.id);
    xenditInvoiceUrl = invoice.invoice_url;
  }

  // Fire-and-forget: send confirmation to booker + notify location admin
  const emailData = {
    locationName: loc?.name ?? "",
    courtName: courtRow?.name ?? "",
    date: date as string,
    startTime: start_time as string,
    endTime: end_time as string,
    bookerName: booker_name,
    bookerEmail: booker_email,
    playerCount: player_count,
    notes,
    status: status as "confirmed" | "pending_payment",
    bookingId: data.id,
    receiptUrl: requiresPayment ? `${origin}/book/receipt/${data.id}` : undefined,
  };

  Promise.resolve(sendBookingConfirmation(emailData)).catch(() => {});

  if (courtRow?.location_id) {
    const adminSupabase = getAdminSupabase();
    adminSupabase
      .from("admins")
      .select("email, telegram_chat_id")
      .eq("location_id", courtRow.location_id)
      .eq("role", "location_admin")
      .limit(1)
      .single()
      .then(({ data: adminRow }) => {
        if (adminRow?.email) {
          Promise.resolve(sendBookingNotification(adminRow.email, emailData)).catch(() => {});
        }
        if (adminRow?.telegram_chat_id) {
          Promise.resolve(sendTelegramMessage(
            adminRow.telegram_chat_id,
            buildNewBookingMessage({
              locationName: emailData.locationName,
              courtName: emailData.courtName,
              date: emailData.date,
              startTime: emailData.startTime,
              endTime: emailData.endTime,
              bookerName: emailData.bookerName,
              bookerPhone: booker_phone,
              bookerEmail: emailData.bookerEmail,
              status: status as "confirmed" | "pending_payment",
            })
          )).catch(() => {});
        }
      });
  }

  return NextResponse.json({
    booking: data,
    requires_payment: requiresPayment,
    payment_gateway,
    xendit_invoice_url: xenditInvoiceUrl,
    payment_qr_url: useXendit ? null : loc?.payment_qr_url ?? null,
    payment_account_name: useXendit ? null : loc?.payment_account_name ?? null,
    payment_account_number: useXendit ? null : loc?.payment_account_number ?? null,
    requires_downpayment: useXendit ? false : requiresDownpayment,
    downpayment_min_hours: loc?.downpayment_min_hours ?? 3,
    pending_payment_expiry_hours: requiresPayment && loc?.auto_expire_pending_payment ? loc.pending_payment_expiry_hours : null,
  }, { status: 201 });
}
