import { NextResponse } from "next/server";
import { getAdminSupabase } from "@/lib/supabase-admin";
import { getAdminClaims } from "@/lib/server-auth";

type Params = { params: Promise<{ id: string }> };

export async function DELETE(_req: Request, { params }: Params) {
  const claims = await getAdminClaims();
  if (!claims) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const supabase = getAdminSupabase();

  // location_admin: verify the court belongs to their location before deactivating
  if (claims.role === "location_admin") {
    const { data: court } = await supabase
      .from("courts")
      .select("location_id")
      .eq("id", id)
      .single();
    if (!court || court.location_id !== claims.location_id) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }
  }

  const { error } = await supabase
    .from("courts")
    .update({ is_active: false })
    .eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
