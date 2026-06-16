import { NextResponse } from "next/server";
import { SignJWT } from "jose";
import { getAdminClaims } from "@/lib/server-auth";

function getSecret() {
  return new TextEncoder().encode(process.env.JWT_SECRET!);
}

export async function POST() {
  const claims = await getAdminClaims();
  if (!claims) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return NextResponse.json({ error: "no_bot_token" }, { status: 500 });

  const linkToken = await new SignJWT({ purpose: "tg_link" })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(claims.sub)
    .setIssuer("tg-link")
    .setExpirationTime("10m")
    .sign(getSecret());

  const meRes = await fetch(`https://api.telegram.org/bot${token}/getMe`);
  const me = await meRes.json();
  if (!me.ok) return NextResponse.json({ error: "bot_unavailable" }, { status: 502 });

  const url = `https://t.me/${me.result.username}?start=${encodeURIComponent(linkToken)}`;
  return NextResponse.json({ url });
}
