import { NextResponse } from "next/server";
import { getAdminSupabase } from "@/lib/supabase-admin";

export async function GET() {
  const supabase = getAdminSupabase();
  const { data, error } = await supabase
    .from("sessions")
    .select("id, code, state, updated_at")
    .order("updated_at", { ascending: false });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ sessions: data ?? [] });
}
