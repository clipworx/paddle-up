import { NextResponse } from "next/server";
import { getAdminSupabase } from "@/lib/supabase-admin";
import { sendTelegramMessage } from "@/lib/telegram";
import { sendReceiptUploadedNotification } from "@/lib/email";

type Params = { params: Promise<{ id: string }> };

export async function POST(req: Request, { params }: Params) {
  const { id } = await params;

  const supabase = getAdminSupabase();

  const { data: booking } = await supabase
    .from("bookings")
    .select("id, status, court_id, date, start_time, end_time, booker_name, courts(name, location_id, locations(name))")
    .eq("id", id)
    .single();

  if (!booking) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  if (booking.status !== "pending_payment" && booking.status !== "pending_confirmation") {
    return NextResponse.json({ error: "not_pending" }, { status: 409 });
  }

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: "invalid_form_data" }, { status: 400 });
  }

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: "file_required" }, { status: 400 });
  }

  const allowed = ["image/jpeg", "image/png", "image/webp", "image/gif"];
  if (!allowed.includes(file.type)) {
    return NextResponse.json({ error: "invalid_file_type" }, { status: 400 });
  }
  if (file.size > 5 * 1024 * 1024) {
    return NextResponse.json({ error: "file_too_large" }, { status: 400 });
  }

  const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
  const path = `${id}/receipt.${ext}`;
  const bytes = await file.arrayBuffer();

  const { error: uploadError } = await supabase.storage
    .from("payment-receipts")
    .upload(path, bytes, { upsert: true, contentType: file.type });

  if (uploadError) {
    return NextResponse.json({ error: uploadError.message }, { status: 500 });
  }

  const { data: { publicUrl } } = supabase.storage.from("payment-receipts").getPublicUrl(path);
  const versionedUrl = `${publicUrl}?v=${Date.now()}`;

  const { error: updateError } = await supabase
    .from("bookings")
    .update({ receipt_url: versionedUrl, receipt_uploaded_at: new Date().toISOString(), status: "pending_confirmation" })
    .eq("id", id);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  const court = booking.courts as unknown as { name: string; location_id: string; locations: { name: string } | null } | null;

  if (court?.location_id) {
    const { data: adminRow } = await supabase
      .from("admins")
      .select("email, telegram_chat_id")
      .eq("location_id", court.location_id)
      .eq("role", "location_admin")
      .limit(1)
      .single();

    if (adminRow?.telegram_chat_id) {
      Promise.resolve(sendTelegramMessage(
        adminRow.telegram_chat_id,
        [
          "🧾 <b>Payment receipt uploaded</b>",
          "",
          `📍 ${court.name} — ${court.locations?.name ?? ""}`,
          `👤 ${booking.booker_name}`,
          "",
          "Review the receipt in the admin panel before confirming.",
        ].join("\n")
      )).catch(() => {});
    }
    if (adminRow?.email) {
      Promise.resolve(sendReceiptUploadedNotification(adminRow.email, {
        locationName: court.locations?.name ?? "",
        courtName: court.name,
        date: booking.date,
        startTime: booking.start_time,
        endTime: booking.end_time,
        bookerName: booking.booker_name,
        receiptUrl: publicUrl,
      })).catch(() => {});
    }
  }

  return NextResponse.json({ ok: true, receipt_url: publicUrl });
}
