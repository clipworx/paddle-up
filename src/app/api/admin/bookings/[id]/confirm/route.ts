import { NextResponse } from "next/server";
import { getAdminSupabase } from "@/lib/supabase-admin";
import { getAdminClaims } from "@/lib/server-auth";
import { sendBookingConfirmation } from "@/lib/email";
import { sendTelegramMessage, buildConfirmedMessage } from "@/lib/telegram";

type Params = { params: Promise<{ id: string }> };

export async function POST(_req: Request, { params }: Params) {
  const claims = await getAdminClaims();
  if (!claims) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const { id } = await params;
  const supabase = getAdminSupabase();

  const { data: booking } = await supabase
    .from("bookings")
    .select("court_id, booker_name, booker_email, date, start_time, end_time, notes, courts(name, location_id, locations(name))")
    .eq("id", id)
    .single();

  const court = booking?.courts as unknown as { name: string; location_id: string; locations: { name: string } | null } | null;

  if (claims.role === "location_admin" && claims.location_id) {
    if (court?.location_id !== claims.location_id) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }
  }

  const { error } = await supabase
    .from("bookings")
    .update({ status: "confirmed" })
    .eq("id", id)
    .in("status", ["pending_payment", "pending_confirmation"]);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (booking?.booker_email) {
    Promise.resolve(
      sendBookingConfirmation({
        locationName: court?.locations?.name ?? "",
        courtName: court?.name ?? "",
        date: booking.date,
        startTime: booking.start_time,
        endTime: booking.end_time,
        bookerName: booking.booker_name,
        bookerEmail: booking.booker_email,
        playerCount: 0,
        notes: booking.notes ?? null,
        status: "confirmed",
        bookingId: id,
      })
    ).catch(() => {});
  }

  // Telegram: notify the location admin who confirmed it
  if (court?.location_id) {
    supabase
      .from("admins")
      .select("telegram_chat_id")
      .eq("location_id", court.location_id)
      .eq("role", "location_admin")
      .limit(1)
      .single()
      .then(({ data: adminRow }) => {
        if (adminRow?.telegram_chat_id && booking) {
          Promise.resolve(sendTelegramMessage(
            adminRow.telegram_chat_id,
            buildConfirmedMessage({
              locationName: court?.locations?.name ?? "",
              courtName: court?.name ?? "",
              date: booking.date,
              startTime: booking.start_time,
              endTime: booking.end_time,
              bookerName: booking.booker_name,
            })
          )).catch(() => {});
        }
      });
  }

  return NextResponse.json({ ok: true });
}
