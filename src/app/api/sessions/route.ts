import { NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/supabase-server";

export async function POST(req: Request) {
  let body: { password?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const password =
    typeof body.password === "string" ? body.password.trim() : "";
  if (password.length < 4) {
    return NextResponse.json(
      { error: "password_too_short" },
      { status: 400 }
    );
  }

  const supabase = getServerSupabase();
  const { data, error } = await supabase.rpc("create_session", {
    p_password: password,
  });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (typeof data !== "string") {
    return NextResponse.json(
      { error: "unexpected_response" },
      { status: 500 }
    );
  }
  return NextResponse.json({ code: data });
}
