import { NextResponse } from "next/server";
import { getAdminSupabase } from "@/lib/supabase-admin";
import { getAdminClaims } from "@/lib/server-auth";

function isWeekend(dateIso: string): boolean {
  const [y, m, d] = dateIso.split("-").map(Number);
  return [0, 6].includes(new Date(y, m - 1, d).getDay());
}

type RawBooking = {
  id: string;
  court_id: string;
  date: string;
  start_time: string;
  end_time: string;
  status: string;
  booker_name: string;
  created_at: string;
};

type LocRates = {
  day_rate: number;
  night_rate: number;
  night_start_time: string;
  weekend_night_start_time: string;
  open_hour: number;
  close_hour: number;
  weekend_open_hour: number;
  weekend_close_hour: number;
};

function bookingHours(b: RawBooking): number {
  const startH = parseInt(b.start_time.slice(0, 2), 10);
  const endHRaw = parseInt(b.end_time.slice(0, 2), 10);
  return Math.max(0, (endHRaw === 0 ? 24 : endHRaw) - startH);
}

function computeRevenue(bookings: RawBooking[], loc: LocRates): number {
  return bookings.reduce((total, b) => {
    const weekend = isWeekend(b.date);
    const nightHour = parseInt(
      (weekend ? loc.weekend_night_start_time : loc.night_start_time).slice(0, 2), 10
    );
    const startH = parseInt(b.start_time.slice(0, 2), 10);
    const endHRaw = parseInt(b.end_time.slice(0, 2), 10);
    const endH = endHRaw === 0 ? 24 : endHRaw;
    let rev = 0;
    for (let h = startH; h < endH; h++) {
      rev += h >= nightHour ? loc.night_rate : loc.day_rate;
    }
    return total + rev;
  }, 0);
}

function toISO(d: Date): string {
  return d.toISOString().split("T")[0];
}

export async function GET() {
  const claims = await getAdminClaims();
  if (!claims || claims.role !== "location_admin" || !claims.location_id) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const supabase = getAdminSupabase();
  const locationId = claims.location_id;
  // Opportunistically expire any unpaid bookings past their location's
  // threshold before reading stats — no cron in this app.
  await supabase.rpc("expire_pending_bookings");

  const { data: loc } = await supabase
    .from("locations")
    .select("day_rate, night_rate, night_start_time, weekend_night_start_time, open_hour, close_hour, weekend_open_hour, weekend_close_hour")
    .eq("id", locationId)
    .single();

  if (!loc) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const { data: courts } = await supabase
    .from("courts")
    .select("id, name, is_active")
    .eq("location_id", locationId)
    .order("name");

  const courtIds = (courts ?? []).map((c) => c.id);

  const now = new Date();
  const todayStr = toISO(now);

  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = toISO(yesterday);

  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - 6);
  const weekStartStr = toISO(weekStart);

  const prevWeekEnd = new Date(weekStart);
  prevWeekEnd.setDate(prevWeekEnd.getDate() - 1);
  const prevWeekStart = new Date(prevWeekEnd);
  prevWeekStart.setDate(prevWeekStart.getDate() - 6);
  const prevWeekStartStr = toISO(prevWeekStart);
  const prevWeekEndStr = toISO(prevWeekEnd);

  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthStartStr = toISO(monthStart);

  const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const prevMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);
  const prevMonthStartStr = toISO(prevMonthStart);
  const prevMonthEndStr = toISO(prevMonthEnd);

  const { data: allBookings } = await supabase
    .from("bookings")
    .select("id, court_id, date, start_time, end_time, status, booker_name, created_at")
    .in("court_id", courtIds.length > 0 ? courtIds : ["00000000-0000-0000-0000-000000000000"])
    .gte("date", prevMonthStartStr)
    .lte("date", todayStr)
    .order("created_at", { ascending: false });

  const bookings: RawBooking[] = allBookings ?? [];
  const active = (b: RawBooking) => b.status === "confirmed" || b.status === "pending_payment" || b.status === "pending_confirmation";

  const todayBk = bookings.filter((b) => b.date === todayStr);
  const yesterdayBk = bookings.filter((b) => b.date === yesterdayStr);
  const weekBk = bookings.filter((b) => b.date >= weekStartStr && b.date <= todayStr && active(b));
  const prevWeekBk = bookings.filter((b) => b.date >= prevWeekStartStr && b.date <= prevWeekEndStr && active(b));
  const monthBk = bookings.filter((b) => b.date >= monthStartStr && b.date <= todayStr && active(b));
  const prevMonthBk = bookings.filter((b) => b.date >= prevMonthStartStr && b.date <= prevMonthEndStr && active(b));

  const todayIsWeekend = isWeekend(todayStr);
  const openH = todayIsWeekend ? (loc.weekend_open_hour ?? loc.open_hour ?? 0) : (loc.open_hour ?? 0);
  const closeH = todayIsWeekend ? (loc.weekend_close_hour ?? loc.close_hour ?? 24) : (loc.close_hour ?? 24);
  const totalHours = Math.max(0, closeH - openH);

  const courtMap = Object.fromEntries((courts ?? []).map((c) => [c.id, c.name]));

  const court_utilization = (courts ?? [])
    .map((court) => {
      const cb = todayBk.filter((b) => b.court_id === court.id && active(b));
      const bookedHours = cb.reduce((s, b) => s + bookingHours(b), 0);
      const pct = totalHours > 0 ? Math.min(100, Math.round((bookedHours / totalHours) * 100)) : 0;
      return { id: court.id, name: court.name, is_active: court.is_active, booked_hours: bookedHours, total_hours: totalHours, pct };
    })
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: "base" }));

  const recent_activity = bookings
    .filter((b) => b.status !== "cancelled")
    .slice(0, 8)
    .map((b) => ({
      id: b.id,
      court_name: courtMap[b.court_id] ?? "Unknown court",
      booker_name: b.booker_name,
      date: b.date,
      start_time: b.start_time,
      end_time: b.end_time,
      status: b.status,
      created_at: b.created_at,
    }));

  return NextResponse.json({
    stats: {
      today_bookings: todayBk.filter(active).length,
      yesterday_bookings: yesterdayBk.filter(active).length,
      today_revenue: computeRevenue(todayBk.filter(active), loc),
      yesterday_revenue: computeRevenue(yesterdayBk.filter(active), loc),
      week_revenue: computeRevenue(weekBk, loc),
      prev_week_revenue: computeRevenue(prevWeekBk, loc),
      month_revenue: computeRevenue(monthBk, loc),
      prev_month_revenue: computeRevenue(prevMonthBk, loc),
    },
    court_utilization,
    recent_activity,
  });
}
