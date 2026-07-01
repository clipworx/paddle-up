import { NextResponse } from "next/server";
import { getAdminSupabase } from "@/lib/supabase-admin";
import { verifyWebhookToken } from "@/lib/xendit";
import { confirmXenditInvoicePaid } from "@/lib/xenditConfirm";

export async function POST(req: Request) {
  if (!verifyWebhookToken(req.headers.get("x-callback-token"))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: { external_id?: string; status?: string; paid_amount?: number };
  try {
    body = JSON.parse(await req.text());
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const bookingId = body.external_id;
  if (!bookingId) return NextResponse.json({ ok: true });

  if (body.status === "PAID" || body.status === "SETTLED") {
    await confirmXenditInvoicePaid(bookingId, body.paid_amount ?? null);
  } else if (body.status === "EXPIRED") {
    const supabase = getAdminSupabase();
    await supabase
      .from("bookings")
      .update({ status: "cancelled" })
      .eq("id", bookingId)
      .eq("status", "pending_payment");
  }

  return NextResponse.json({ ok: true });
}
