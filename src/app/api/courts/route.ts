import { NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/supabase-server";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const locationId = searchParams.get("location_id");

  const supabase = getServerSupabase();
  let query = supabase
    .from("courts")
    .select("id, name, description, is_active, location_id")
    .eq("is_active", true)
    .order("name");

  if (locationId) {
    query = query.eq("location_id", locationId);
  }

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ courts: data ?? [] });
}
