import { NextResponse } from "next/server";
import { getAdminSupabase } from "@/lib/supabase-admin";
import { getAdminClaims } from "@/lib/server-auth";

export async function GET() {
  const claims = await getAdminClaims();
  if (!claims || claims.role !== "admin") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const supabase = getAdminSupabase();
  const { data } = await supabase
    .from("site_settings")
    .select("contact_email, contact_facebook, contact_instagram, contact_whatsapp")
    .single();
  return NextResponse.json(data ?? {});
}

export async function PUT(req: Request) {
  const claims = await getAdminClaims();
  if (!claims || claims.role !== "admin") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  let body: {
    contact_email?: unknown;
    contact_facebook?: unknown;
    contact_instagram?: unknown;
    contact_whatsapp?: unknown;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const updates: Record<string, string | null> = {};
  for (const key of ["contact_email", "contact_facebook", "contact_instagram", "contact_whatsapp"] as const) {
    if (key in body) {
      const v = body[key];
      updates[key] = typeof v === "string" ? v.trim() || null : null;
    }
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "no_fields" }, { status: 400 });
  }

  const supabase = getAdminSupabase();
  const { error } = await supabase.from("site_settings").update(updates).eq("id", true);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
