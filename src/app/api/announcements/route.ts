import { NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/supabase-server";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const locationId = searchParams.get("location_id");
  if (!locationId)
    return NextResponse.json({ error: "location_id required" }, { status: 400 });

  const supabase = getServerSupabase();
  const { data, error } = await supabase
    .from("announcements")
    .select("id, title, body, image_url, created_at")
    .eq("location_id", locationId)
    .eq("is_active", true)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ announcements: data ?? [] });
}
