import { NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/supabase-server";

export async function GET() {
  const supabase = getServerSupabase();

  // Fetch active locations with their active court count
  const { data, error } = await supabase
    .from("locations")
    .select("id, name, slug, address, description, is_active, day_rate, night_rate, night_start_time, open_hour, close_hour, weekend_night_start_time, weekend_open_hour, weekend_close_hour, payment_qr_url, payment_account_name, payment_account_number, latitude, longitude, logo_url, accent_color, photo_url, subscription_due_date, subscription_grace_days, require_downpayment, downpayment_min_hours, no_split_rate_booking, allow_half_hour_bookings, courts(id)")
    .eq("is_active", true)
    .order("name");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const locations = (data ?? []).filter((loc) => {
    if (!loc.subscription_due_date) return true;
    const graceEnd = new Date(loc.subscription_due_date);
    graceEnd.setDate(graceEnd.getDate() + (loc.subscription_grace_days ?? 7));
    return today <= graceEnd;
  }).map((loc) => ({
    id: loc.id,
    name: loc.name,
    slug: loc.slug ?? loc.id,
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
    latitude: loc.latitude ?? null,
    longitude: loc.longitude ?? null,
    logo_url: loc.logo_url ?? null,
    accent_color: loc.accent_color ?? null,
    photo_url: loc.photo_url ?? null,
    subscription_due_date: loc.subscription_due_date ?? null,
    subscription_grace_days: loc.subscription_grace_days ?? 7,
    require_downpayment: loc.require_downpayment ?? false,
    downpayment_min_hours: loc.downpayment_min_hours ?? 3,
    no_split_rate_booking: loc.no_split_rate_booking ?? false,
    allow_half_hour_bookings: loc.allow_half_hour_bookings ?? false,
    court_count: Array.isArray(loc.courts) ? loc.courts.length : 0,
  }));

  return NextResponse.json({ locations });
}
