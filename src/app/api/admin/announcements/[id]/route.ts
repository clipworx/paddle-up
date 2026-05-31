import { NextResponse } from "next/server";
import { getAdminSupabase } from "@/lib/supabase-admin";
import { getAdminClaims } from "@/lib/server-auth";

type Params = { params: Promise<{ id: string }> };

async function resolveAnnouncement(id: string, locationId: string | null) {
  const supabase = getAdminSupabase();
  const q = supabase.from("announcements").select("id, location_id").eq("id", id).single();
  const { data } = await q;
  if (!data) return null;
  if (locationId && data.location_id !== locationId) return null;
  return data;
}

export async function PATCH(req: Request, { params }: Params) {
  const claims = await getAdminClaims();
  if (!claims) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const { id } = await params;
  const locationId = claims.role === "location_admin" ? claims.location_id : null;

  const row = await resolveAnnouncement(id, locationId);
  if (!row) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (body.title !== undefined) updates.title = body.title.trim();
  if (body.body !== undefined) updates.body = body.body.trim();
  if (body.is_active !== undefined) updates.is_active = body.is_active;

  const supabase = getAdminSupabase();
  const { data, error } = await supabase
    .from("announcements")
    .update(updates)
    .eq("id", id)
    .select("id, title, body, is_active, created_at, updated_at")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ announcement: data });
}

export async function DELETE(_req: Request, { params }: Params) {
  const claims = await getAdminClaims();
  if (!claims) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const { id } = await params;
  const locationId = claims.role === "location_admin" ? claims.location_id : null;

  const row = await resolveAnnouncement(id, locationId);
  if (!row) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const supabase = getAdminSupabase();
  const { error } = await supabase.from("announcements").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
