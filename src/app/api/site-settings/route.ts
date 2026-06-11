import { NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/supabase-server";

export async function GET() {
  const supabase = getServerSupabase();
  const { data } = await supabase
    .from("site_settings")
    .select("contact_email, contact_facebook, contact_instagram, contact_whatsapp")
    .single();
  return NextResponse.json(data ?? {});
}
