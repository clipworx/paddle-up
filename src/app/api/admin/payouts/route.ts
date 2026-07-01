import { NextResponse } from "next/server";
import { getAdminSupabase } from "@/lib/supabase-admin";
import { getAdminClaims } from "@/lib/server-auth";

export async function GET(req: Request) {
  const claims = await getAdminClaims();
  // Platform-only: this reports on money the platform is holding/has paid out.
  if (!claims || claims.role !== "admin") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const locationId = searchParams.get("location_id")?.trim();
  const status = searchParams.get("status")?.trim();

  const supabase = getAdminSupabase();

  let courtIds: string[] | null = null;
  if (locationId) {
    const { data: locCourts } = await supabase.from("courts").select("id").eq("location_id", locationId);
    courtIds = locCourts?.map((c) => c.id) ?? [];
    if (courtIds.length === 0) {
      return NextResponse.json({ payouts: [], totals: { disbursed: 0, pending: 0, failedCount: 0, pendingCount: 0 } });
    }
  }

  let query = supabase
    .from("bookings")
    .select("id, date, start_time, end_time, booker_name, xendit_paid_amount, payout_status, payout_disbursement_id, payout_disbursed_at, court_id, courts(name, location_id, locations(name, xendit_platform_fee_percent))")
    .eq("payment_gateway", "xendit")
    .not("xendit_paid_amount", "is", null)
    .order("date", { ascending: false })
    .order("start_time", { ascending: false });

  if (courtIds) query = query.in("court_id", courtIds);
  if (status) query = query.eq("payout_status", status);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const payouts = (data ?? []).map((b) => {
    const court = b.courts as unknown as { name: string; location_id: string; locations: { name: string; xendit_platform_fee_percent: number } | null } | null;
    const feePercent = court?.locations?.xendit_platform_fee_percent ?? 0;
    const paidAmount = b.xendit_paid_amount ?? 0;
    const payoutAmount = Math.round(paidAmount * (1 - feePercent / 100) * 100) / 100;
    return {
      id: b.id,
      date: b.date,
      start_time: b.start_time,
      end_time: b.end_time,
      booker_name: b.booker_name,
      court_name: court?.name ?? null,
      location_id: court?.location_id ?? null,
      location_name: court?.locations?.name ?? null,
      paid_amount: paidAmount,
      fee_percent: feePercent,
      payout_amount: payoutAmount,
      payout_status: b.payout_status,
      payout_disbursement_id: b.payout_disbursement_id,
      payout_disbursed_at: b.payout_disbursed_at,
    };
  });

  const totals = payouts.reduce(
    (acc, p) => {
      if (p.payout_status === "disbursed") acc.disbursed += p.payout_amount;
      if (p.payout_status === "pending") { acc.pending += p.payout_amount; acc.pendingCount++; }
      if (p.payout_status === "failed") acc.failedCount++;
      return acc;
    },
    { disbursed: 0, pending: 0, failedCount: 0, pendingCount: 0 }
  );

  return NextResponse.json({ payouts, totals });
}
