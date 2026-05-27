import { NextResponse } from "next/server";
import { getAdminSupabase } from "@/lib/supabase-admin";
import { getAdminClaims } from "@/lib/server-auth";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, { params }: Params) {
  const claims = await getAdminClaims();
  if (!claims) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const { id } = await params;

  if (claims.role === "location_admin" && claims.location_id !== id) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  let body: { latitude?: unknown; longitude?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const latitude = typeof body.latitude === "number" ? body.latitude : null;
  const longitude = typeof body.longitude === "number" ? body.longitude : null;

  if (
    latitude !== null && (latitude < -90 || latitude > 90) ||
    longitude !== null && (longitude < -180 || longitude > 180)
  ) {
    return NextResponse.json({ error: "invalid_coordinates" }, { status: 400 });
  }

  const supabase = getAdminSupabase();
  const { error } = await supabase
    .from("locations")
    .update({ latitude, longitude })
    .eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
