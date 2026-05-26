import { NextResponse } from "next/server";
import { getAdminClaims } from "@/lib/server-auth";

export async function GET() {
  const claims = await getAdminClaims();
  if (!claims) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  return NextResponse.json({
    id: claims.sub,
    username: claims.username,
    role: claims.role,
    location_id: claims.location_id,
  });
}
