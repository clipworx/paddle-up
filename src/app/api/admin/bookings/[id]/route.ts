import { NextResponse } from "next/server";
import { getAdminSupabase } from "@/lib/supabase-admin";
import { getAdminClaims } from "@/lib/server-auth";

type Params = { params: Promise<{ id: string }> };

export async function DELETE(_req: Request, { params }: Params) {
  const claims = await getAdminClaims();
  if (!claims) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const { id } = await params;
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
    .update({ status: "cancelled" })
    .eq("id", id)
    .in("status", ["confirmed", "pending_payment", "pending_confirmation"]);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
