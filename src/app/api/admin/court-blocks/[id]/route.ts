import { NextResponse } from "next/server";
import { getAdminSupabase } from "@/lib/supabase-admin";
import { getAdminClaims } from "@/lib/server-auth";

type Params = { params: Promise<{ id: string }> };

export async function DELETE(_req: Request, { params }: Params) {
  const claims = await getAdminClaims();
  if (!claims || claims.role !== "location_admin" || !claims.location_id) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const supabase = getAdminSupabase();

  const { data: block } = await supabase
    .from("court_blocks")
    .select("id, courts(location_id)")
    .eq("id", id)
    .single();

  if (!block) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const locationId = (block.courts as unknown as { location_id: string } | null)?.location_id;
  if (locationId !== claims.location_id) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const { error } = await supabase.from("court_blocks").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
