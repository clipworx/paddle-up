import { NextResponse } from "next/server";
import { getAdminSupabase } from "@/lib/supabase-admin";
import { getAdminClaims } from "@/lib/server-auth";

type Params = { params: Promise<{ id: string }> };

export async function DELETE(_req: Request, { params }: Params) {
  const claims = await getAdminClaims();
  if (!claims || claims.role !== "admin") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const { id } = await params;

  // Prevent self-deletion
  if (id === claims.sub) {
    return NextResponse.json({ error: "cannot_delete_self" }, { status: 400 });
  }

  const supabase = getAdminSupabase();
  const { error } = await supabase.rpc("admin_delete_admin", {
    p_admin_id: id,
  });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
