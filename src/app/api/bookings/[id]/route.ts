import { NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/supabase-server";
import { getInvoiceStatus } from "@/lib/xendit";
import { confirmXenditInvoicePaid } from "@/lib/xenditConfirm";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Params) {
  const { id } = await params;

  const supabase = getServerSupabase();
  const { data, error } = await supabase
    .from("bookings")
    .select("id, date, start_time, end_time, booker_name, status, receipt_url, receipt_uploaded_at, created_at, payment_gateway, xendit_invoice_id, xendit_invoice_url, courts(name, locations(name, payment_qr_url, payment_account_name, payment_account_number, auto_expire_pending_payment, pending_payment_expiry_hours))")
    .eq("id", id)
    .single();

  if (error || !data) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  // Fallback reconciliation: don't rely solely on the webhook having arrived
  // (it can be delayed, dropped, or — in local dev — simply unreachable since
  // Xendit can't call out to localhost). Whenever this booking's status is
  // checked, also ask Xendit directly so a paid invoice never gets stuck.
  let status = data.status;
  if (status === "pending_payment" && data.payment_gateway === "xendit" && data.xendit_invoice_id) {
    const invoice = await getInvoiceStatus(data.xendit_invoice_id);
    if (invoice?.status === "PAID" || invoice?.status === "SETTLED") {
      const result = await confirmXenditInvoicePaid(id, invoice.paid_amount);
      if (result === "confirmed") status = "confirmed";
    }
  }

  const court = data.courts as unknown as { name: string; locations: { name: string; payment_qr_url: string | null; payment_account_name: string | null; payment_account_number: string | null; auto_expire_pending_payment: boolean; pending_payment_expiry_hours: number } | null } | null;

  return NextResponse.json({
    booking: {
      id: data.id,
      date: data.date,
      start_time: data.start_time,
      end_time: data.end_time,
      booker_name: data.booker_name,
      status,
      receipt_url: data.receipt_url,
      receipt_uploaded_at: data.receipt_uploaded_at,
      created_at: data.created_at,
      payment_gateway: data.payment_gateway,
      xendit_invoice_url: data.xendit_invoice_url,
      court_name: court?.name ?? null,
      location_name: court?.locations?.name ?? null,
      payment_qr_url: court?.locations?.payment_qr_url ?? null,
      payment_account_name: court?.locations?.payment_account_name ?? null,
      payment_account_number: court?.locations?.payment_account_number ?? null,
      pending_payment_expiry_hours: court?.locations?.auto_expire_pending_payment ? court.locations.pending_payment_expiry_hours : null,
    },
  });
}
