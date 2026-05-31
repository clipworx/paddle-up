import { NextResponse } from "next/server";
import { getAdminSupabase } from "@/lib/supabase-admin";
import { getAdminClaims } from "@/lib/server-auth";

type Params = { params: Promise<{ id: string }> };

export async function POST(req: Request, { params }: Params) {
  const claims = await getAdminClaims();
  if (!claims) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const { id } = await params;
  let reason = "";
  try {
    const body = await req.json();
    reason = typeof body.reason === "string" ? body.reason.trim() : "";
  } catch {
    // reason stays empty
  }

  const supabase = getAdminSupabase();

  if (claims.role === "location_admin" && claims.location_id) {
    const { data: booking } = await supabase
      .from("bookings")
      .select("court_id, courts(location_id)")
      .eq("id", id)
      .single();
    const locationId = (booking?.courts as unknown as { location_id: string } | null)?.location_id;
    if (locationId !== claims.location_id) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }
  }

  const { error } = await supabase
    .from("bookings")
    .update({ status: "refunded", refund_reason: reason || null })
    .eq("id", id)
    .neq("status", "refunded");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
