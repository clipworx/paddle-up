import { NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/supabase-server";

export async function GET() {
  const supabase = getServerSupabase();

  // Fetch active locations with their active court count
  const { data, error } = await supabase
    .from("locations")
    .select("id, name, address, description, is_active, day_rate, night_rate, night_start_time, open_hour, close_hour, weekend_night_start_time, weekend_open_hour, weekend_close_hour, payment_qr_url, payment_account_name, payment_account_number, courts(id)")
    .eq("is_active", true)
    .order("name");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const locations = (data ?? []).map((loc) => ({
    id: loc.id,
    name: loc.name,
    address: loc.address,
    description: loc.description,
    is_active: loc.is_active,
    day_rate: loc.day_rate ?? 0,
    night_rate: loc.night_rate ?? 0,
    night_start_time: loc.night_start_time ?? "18:00:00",
    open_hour: loc.open_hour ?? 0,
    close_hour: loc.close_hour ?? 24,
    weekend_night_start_time: loc.weekend_night_start_time ?? "18:00:00",
    weekend_open_hour: loc.weekend_open_hour ?? 0,
    weekend_close_hour: loc.weekend_close_hour ?? 24,
    payment_qr_url: loc.payment_qr_url ?? null,
    payment_account_name: loc.payment_account_name ?? null,
    payment_account_number: loc.payment_account_number ?? null,
    court_count: Array.isArray(loc.courts) ? loc.courts.length : 0,
  }));

  return NextResponse.json({ locations });
}
