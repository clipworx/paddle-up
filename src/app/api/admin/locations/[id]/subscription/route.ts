import { NextResponse } from "next/server";
import { getAdminSupabase } from "@/lib/supabase-admin";
import { getAdminClaims } from "@/lib/server-auth";

type Params = { params: Promise<{ id: string }> };

// Mark as paid — sets subscription_due_date to today + 30 days
export async function POST(_req: Request, { params }: Params) {
  const claims = await getAdminClaims();
  if (!claims || claims.role !== "admin") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const { id } = await params;

  const due = new Date();
  due.setDate(due.getDate() + 30);
  const subscription_due_date = due.toISOString().split("T")[0];

  const supabase = getAdminSupabase();
  const { error } = await supabase
    .from("locations")
    .update({ subscription_due_date })
    .eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, subscription_due_date });
}

// Clear subscription — removes due date (location becomes always available)
export async function DELETE(_req: Request, { params }: Params) {
  const claims = await getAdminClaims();
  if (!claims || claims.role !== "admin") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const supabase = getAdminSupabase();
  const { error } = await supabase
    .from("locations")
    .update({ subscription_due_date: null })
    .eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
