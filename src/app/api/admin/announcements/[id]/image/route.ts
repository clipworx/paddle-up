import { NextResponse } from "next/server";
import { getAdminSupabase } from "@/lib/supabase-admin";
import { getAdminClaims } from "@/lib/server-auth";

type Params = { params: Promise<{ id: string }> };

const BUCKET = "announcement-images";
const ALLOWED = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const MAX_SIZE = 8 * 1024 * 1024; // 8 MB

async function resolveAnnouncement(id: string, locationId: string | null) {
  const supabase = getAdminSupabase();
  const { data } = await supabase
    .from("announcements")
    .select("id, location_id")
    .eq("id", id)
    .single();
  if (!data) return null;
  if (locationId && data.location_id !== locationId) return null;
  return data;
}

export async function POST(req: Request, { params }: Params) {
  const claims = await getAdminClaims();
  if (!claims) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const { id } = await params;
  const locationId = claims.role === "location_admin" ? claims.location_id : null;

  const row = await resolveAnnouncement(id, locationId);
  if (!row) return NextResponse.json({ error: "not_found" }, { status: 404 });

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: "invalid_form_data" }, { status: 400 });
  }

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0)
    return NextResponse.json({ error: "file_required" }, { status: 400 });
  if (!ALLOWED.includes(file.type))
    return NextResponse.json({ error: "invalid_file_type" }, { status: 400 });
  if (file.size > MAX_SIZE)
    return NextResponse.json({ error: "file_too_large" }, { status: 400 });

  const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
  const path = `${row.location_id}/${id}.${ext}`;
  const bytes = await file.arrayBuffer();

  const supabase = getAdminSupabase();
  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(path, bytes, { upsert: true, contentType: file.type });

  if (uploadError)
    return NextResponse.json({ error: uploadError.message }, { status: 500 });

  const { data: { publicUrl } } = supabase.storage.from(BUCKET).getPublicUrl(path);

  // Append cache-buster so the browser picks up re-uploaded images
  const imageUrl = `${publicUrl}?t=${Date.now()}`;

  const { error: updateError } = await supabase
    .from("announcements")
    .update({ image_url: imageUrl, updated_at: new Date().toISOString() })
    .eq("id", id);

  if (updateError)
    return NextResponse.json({ error: updateError.message }, { status: 500 });

  return NextResponse.json({ ok: true, image_url: imageUrl });
}

export async function DELETE(_req: Request, { params }: Params) {
  const claims = await getAdminClaims();
  if (!claims) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const { id } = await params;
  const locationId = claims.role === "location_admin" ? claims.location_id : null;

  const row = await resolveAnnouncement(id, locationId);
  if (!row) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const supabase = getAdminSupabase();

  // Remove all files for this announcement (any extension)
  const { data: files } = await supabase.storage
    .from(BUCKET)
    .list(`${row.location_id}`, { search: id });

  if (files?.length) {
    await supabase.storage
      .from(BUCKET)
      .remove(files.map((f) => `${row.location_id}/${f.name}`));
  }

  await supabase
    .from("announcements")
    .update({ image_url: null, updated_at: new Date().toISOString() })
    .eq("id", id);

  return NextResponse.json({ ok: true });
}
