import { NextResponse } from "next/server";
import { jwtVerify } from "jose";
import { getAdminSupabase } from "@/lib/supabase-admin";

function getSecret() {
  return new TextEncoder().encode(process.env.JWT_SECRET!);
}

async function reply(token: string, chatId: number, text: string) {
  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML" }),
  }).catch(() => {});
}

export async function POST(req: Request) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return NextResponse.json({ ok: false }, { status: 500 });

  let body: { message?: { chat?: { id?: number }; text?: string } };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const chatId = body?.message?.chat?.id;
  const text = body?.message?.text ?? "";
  if (!chatId) return NextResponse.json({ ok: true });

  // Auto-connect flow: /start <link_token>
  if (text.startsWith("/start ")) {
    const linkToken = text.slice(7).trim();
    try {
      const { payload } = await jwtVerify(linkToken, getSecret(), {
        issuer: "tg-link",
        algorithms: ["HS256"],
      });
      const adminId = payload.sub;
      if (typeof adminId === "string" && payload.purpose === "tg_link") {
        const supabase = getAdminSupabase();
        await supabase
          .from("admins")
          .update({ telegram_chat_id: String(chatId) })
          .eq("id", adminId);
        await reply(token, chatId, "✅ <b>Telegram connected!</b>\n\nYou'll now receive booking notifications here.");
        return NextResponse.json({ ok: true });
      }
    } catch {
      // invalid or expired token — fall through to echo
    }
  }

  // Fallback: echo the chat ID so admins can copy it manually
  await reply(token, chatId, `Your Chat ID is <code>${chatId}</code>\n\nPaste this into your account settings under <b>Telegram notifications</b>.`);
  return NextResponse.json({ ok: true });
}
