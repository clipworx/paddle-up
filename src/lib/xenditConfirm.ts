import { getAdminSupabase } from "@/lib/supabase-admin";
import { sendBookingConfirmation } from "@/lib/email";
import { sendTelegramMessage, buildConfirmedMessage } from "@/lib/telegram";

// Shared by the webhook (primary path) and the reconciliation check on the
// status page (fallback — webhooks can be delayed, dropped, or in local dev
// simply unreachable since Xendit can't call out to localhost). Idempotent:
// safe to call even if the booking was already confirmed by the other path.
export async function confirmXenditInvoicePaid(
  bookingId: string,
  paidAmount: number | null
): Promise<"confirmed" | "already_confirmed" | "not_found"> {
  const supabase = getAdminSupabase();

  const { data: booking } = await supabase
    .from("bookings")
    .select("status, booker_name, booker_email, date, start_time, end_time, notes, courts(name, location_id, locations(name))")
    .eq("id", bookingId)
    .single();

  if (!booking) return "not_found";
  if (booking.status !== "pending_payment") return "already_confirmed";

  const court = booking.courts as unknown as { name: string; location_id: string; locations: { name: string } | null } | null;

  const { error } = await supabase
    .from("bookings")
    .update({ status: "confirmed", xendit_paid_amount: paidAmount, payout_status: "pending" })
    .eq("id", bookingId)
    .eq("status", "pending_payment");

  if (error) return "already_confirmed";

  if (booking.booker_email) {
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
        bookingId,
      })
    ).catch(() => {});
  }

  if (court?.location_id) {
    supabase
      .from("admins")
      .select("telegram_chat_id")
      .eq("location_id", court.location_id)
      .eq("role", "location_admin")
      .limit(1)
      .single()
      .then(({ data: adminRow }) => {
        if (adminRow?.telegram_chat_id) {
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

  return "confirmed";
}
