import { NextResponse } from "next/server";
import { getAdminSupabase } from "@/lib/supabase-admin";
import { getAdminClaims } from "@/lib/server-auth";

type Params = { params: Promise<{ id: string }> };

export async function POST(req: Request, { params }: Params) {
  const claims = await getAdminClaims();
  if (!claims) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const { id } = await params;

  if (claims.role === "location_admin" && claims.location_id !== id) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: "invalid_form_data" }, { status: 400 });
  }

  const file = formData.get("file");
  const accountName = formData.get("payment_account_name");
  const accountNumber = formData.get("payment_account_number");

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
  const path = `${id}/qr.${ext}`;
  const bytes = await file.arrayBuffer();

  const supabase = getAdminSupabase();
  const { error: uploadError } = await supabase.storage
    .from("qr-images")
    .upload(path, bytes, { upsert: true, contentType: file.type });

  if (uploadError) {
    return NextResponse.json({ error: uploadError.message }, { status: 500 });
  }

  const { data: { publicUrl } } = supabase.storage.from("qr-images").getPublicUrl(path);

  const { error: updateError } = await supabase
    .from("locations")
    .update({
      payment_qr_url: publicUrl,
      payment_account_name: typeof accountName === "string" ? accountName.trim() || null : null,
      payment_account_number: typeof accountNumber === "string" ? accountNumber.trim() || null : null,
    })
    .eq("id", id);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, payment_qr_url: publicUrl });
}

export async function DELETE(_req: Request, { params }: Params) {
  const claims = await getAdminClaims();
  if (!claims) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const { id } = await params;

  if (claims.role === "location_admin" && claims.location_id !== id) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const supabase = getAdminSupabase();
  await supabase.from("locations").update({
    payment_qr_url: null,
    payment_account_name: null,
    payment_account_number: null,
  }).eq("id", id);

  return NextResponse.json({ ok: true });
}
