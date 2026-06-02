import { NextResponse } from "next/server";
import { getAdminClaims } from "@/lib/server-auth";
import { getAdminSupabase } from "@/lib/supabase-admin";
import { signAdminToken, ADMIN_COOKIE_NAME } from "@/lib/auth";

export async function GET() {
  const claims = await getAdminClaims();
  if (!claims) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const supabase = getAdminSupabase();
  const { data } = await supabase
    .from("admins")
    .select("email, notify_new_booking, notify_cancellation")
    .eq("id", claims.sub)
    .single();

  return NextResponse.json({
    id: claims.sub,
    username: claims.username,
    role: claims.role,
    location_id: claims.location_id,
    email: data?.email ?? null,
    notify_new_booking: data?.notify_new_booking ?? true,
    notify_cancellation: data?.notify_cancellation ?? true,
  });
}

export async function PATCH(req: Request) {
  const claims = await getAdminClaims();
  if (!claims) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const { username, email, notify_new_booking, notify_cancellation } = body;

  const updates: Record<string, unknown> = {};
  if (typeof username === "string" && username.trim()) updates.username = username.trim();
  if ("email" in body) updates.email = typeof email === "string" && email.trim() ? email.trim().toLowerCase() : null;
  if (typeof notify_new_booking === "boolean") updates.notify_new_booking = notify_new_booking;
  if (typeof notify_cancellation === "boolean") updates.notify_cancellation = notify_cancellation;

  if (Object.keys(updates).length === 0)
    return NextResponse.json({ error: "nothing_to_update" }, { status: 400 });

  // Username uniqueness check
  if (updates.username) {
    const supabase = getAdminSupabase();
    const { data: existing } = await supabase
      .from("admins")
      .select("id")
      .eq("username", updates.username as string)
      .neq("id", claims.sub)
      .maybeSingle();
    if (existing) return NextResponse.json({ error: "username_taken" }, { status: 409 });
  }

  const supabase = getAdminSupabase();
  const { error } = await supabase.from("admins").update(updates).eq("id", claims.sub);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Re-issue JWT if username changed so the cookie stays current
  const newUsername = (updates.username as string | undefined) ?? claims.username;
  const token = await signAdminToken(claims.sub, newUsername, claims.role, claims.location_id);
  const res = NextResponse.json({ ok: true });
  res.cookies.set(ADMIN_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24,
  });
  return res;
}
