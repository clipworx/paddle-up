import { NextResponse } from "next/server";
import { getAdminSupabase } from "@/lib/supabase-admin";
import { getAdminClaims } from "@/lib/server-auth";
import { payoutEligibleFrom } from "@/lib/bookingValidation";

type Params = { params: Promise<{ id: string }> };

// Disbursement is a manual record-keeping action, not an automated transfer:
// the admin sends the payout themselves (bank/e-wallet transfer) outside this
// app, then records it here with the transfer's reference number as proof.
export async function POST(req: Request, { params }: Params) {
  const claims = await getAdminClaims();
  // Platform-only: venue admins don't control when money leaves the platform account.
  if (!claims || claims.role !== "admin") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const referenceNumber = typeof body.reference_number === "string" ? body.reference_number.trim() : "";
  if (!referenceNumber) {
    return NextResponse.json({ error: "reference_number_required" }, { status: 400 });
  }

  const { id } = await params;
  const supabase = getAdminSupabase();

  const { data: booking } = await supabase
    .from("bookings")
    .select("date, status, payment_gateway, payout_status, xendit_paid_amount, courts(locations(xendit_payout_channel_code, xendit_payout_account_number, xendit_payout_account_holder_name))")
    .eq("id", id)
    .single();

  if (!booking) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (booking.payment_gateway !== "xendit" || booking.status !== "confirmed" || booking.payout_status !== "pending") {
    return NextResponse.json({ error: "not_eligible" }, { status: 409 });
  }

  // Hard block: a booking's payout isn't disbursable until its whole week has
  // elapsed — keeps payouts on a clean weekly cadence and gives cancellations/
  // refunds within that week a chance to surface before money leaves the platform.
  const eligibleFrom = payoutEligibleFrom(booking.date);
  const today = new Date().toISOString().slice(0, 10);
  if (today < eligibleFrom) {
    return NextResponse.json({ error: "week_not_complete", eligible_from: eligibleFrom }, { status: 409 });
  }

  const loc = (booking.courts as unknown as { locations: { xendit_payout_channel_code: string | null; xendit_payout_account_number: string | null; xendit_payout_account_holder_name: string | null } | null } | null)?.locations;
  if (!loc?.xendit_payout_channel_code || !loc?.xendit_payout_account_number || !loc?.xendit_payout_account_holder_name) {
    return NextResponse.json({ error: "payout_destination_not_set" }, { status: 409 });
  }
  if (!booking.xendit_paid_amount) {
    return NextResponse.json({ error: "no_paid_amount" }, { status: 409 });
  }

  const { error } = await supabase
    .from("bookings")
    .update({
      payout_status: "disbursed",
      payout_disbursement_id: referenceNumber,
      payout_disbursed_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("payout_status", "pending");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
