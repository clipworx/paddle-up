import { NextResponse } from "next/server";
import { getAdminSupabase } from "@/lib/supabase-admin";
import { getAdminClaims } from "@/lib/server-auth";

export async function GET(req: Request) {
  const claims = await getAdminClaims();
  if (!claims) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const locationId =
    claims.role === "location_admin"
      ? claims.location_id
      : searchParams.get("location_id");

  if (!locationId)
    return NextResponse.json({ error: "location_id required" }, { status: 400 });

  const supabase = getAdminSupabase();
  const { data, error } = await supabase
    .from("announcements")
    .select("id, title, body, image_url, is_active, created_at, updated_at")
    .eq("location_id", locationId)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ announcements: data ?? [] });
}

export async function POST(req: Request) {
  const claims = await getAdminClaims();
  if (!claims) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const { title, body: content, location_id: bodyLocationId } = body;

  if (!title?.trim())
    return NextResponse.json({ error: "title required" }, { status: 400 });

  const locationId =
    claims.role === "location_admin" ? claims.location_id : bodyLocationId;
  if (!locationId)
    return NextResponse.json({ error: "location_id required" }, { status: 400 });

  const supabase = getAdminSupabase();
  const { data, error } = await supabase
    .from("announcements")
    .insert({
      location_id: locationId,
      title: title.trim(),
      body: content?.trim() ?? "",
    })
    .select("id, title, body, image_url, is_active, created_at, updated_at")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ announcement: data }, { status: 201 });
}
