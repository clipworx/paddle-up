import { NextResponse } from "next/server";
import { getAdminSupabase } from "@/lib/supabase-admin";

type Params = { params: Promise<{ id: string }> };

export async function DELETE(_req: Request, { params }: Params) {
  const { id } = await params;
  const supabase = getAdminSupabase();

  const { error } = await supabase
    .from("bookings")
    .update({ status: "cancelled" })
    .eq("id", id)
    .in("status", ["confirmed", "pending_payment"]);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
