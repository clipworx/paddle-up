import { NextResponse } from "next/server";
import { getAdminSupabase } from "@/lib/supabase-admin";
import { getAdminClaims } from "@/lib/server-auth";
import { refundInvoicePayment } from "@/lib/xendit";

type Params = { params: Promise<{ id: string }> };

export async function POST(req: Request, { params }: Params) {
  const claims = await getAdminClaims();
  if (!claims) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const { id } = await params;
  let reason = "";
  let referenceNumber = "";
  try {
    const body = await req.json();
    reason = typeof body.reason === "string" ? body.reason.trim() : "";
    referenceNumber = typeof body.reference_number === "string" ? body.reference_number.trim() : "";
  } catch {
    // reason/referenceNumber stay empty
  }

  const supabase = getAdminSupabase();

  const { data: booking } = await supabase
    .from("bookings")
    .select("status, payment_gateway, xendit_invoice_id, xendit_paid_amount, courts(location_id)")
    .eq("id", id)
    .single();

  if (!booking) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (booking.status === "refunded") return NextResponse.json({ error: "already_refunded" }, { status: 409 });

  const isXendit = booking.payment_gateway === "xendit";

  // Platform-only for Xendit bookings: the platform holds the customer's payment
  // centrally, same reasoning as disbursement. Manual/free bookings (no real money
  // flow through the platform) stay open to the venue's own location_admin.
  if (isXendit) {
    if (claims.role !== "admin") return NextResponse.json({ error: "forbidden" }, { status: 403 });
  } else if (claims.role === "location_admin" && claims.location_id) {
    const locationId = (booking.courts as unknown as { location_id: string } | null)?.location_id;
    if (locationId !== claims.location_id) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }
  }

  let xenditRefundId: string | null = null;

  if (isXendit) {
    if (referenceNumber) {
      // Admin already refunded the customer themselves — just recording proof.
      xenditRefundId = referenceNumber;
    } else if (booking.xendit_invoice_id && booking.xendit_paid_amount) {
      const refund = await refundInvoicePayment({
        invoiceId: booking.xendit_invoice_id,
        amount: booking.xendit_paid_amount,
      });
      if (!refund) {
        return NextResponse.json({ error: "xendit_refund_failed" }, { status: 409 });
      }
      xenditRefundId = refund.id;
    } else {
      return NextResponse.json({ error: "reference_number_required" }, { status: 400 });
    }
  }

  const { error } = await supabase
    .from("bookings")
    .update({
      status: "refunded",
      refund_reason: reason || null,
      ...(xenditRefundId ? { xendit_refund_id: xenditRefundId } : {}),
    })
    .eq("id", id)
    .neq("status", "refunded");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, xendit_refund_id: xenditRefundId });
}
