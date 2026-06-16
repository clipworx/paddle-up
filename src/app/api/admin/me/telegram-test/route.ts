import { NextResponse } from "next/server";
import { getAdminClaims } from "@/lib/server-auth";
import { getAdminSupabase } from "@/lib/supabase-admin";
import { sendTelegramMessage } from "@/lib/telegram";

export async function POST() {
  const claims = await getAdminClaims();
  if (!claims) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const supabase = getAdminSupabase();
  const { data } = await supabase
    .from("admins")
    .select("telegram_chat_id")
    .eq("id", claims.sub)
    .single();

  const chatId = data?.telegram_chat_id;
  if (!chatId) return NextResponse.json({ error: "no_chat_id" }, { status: 400 });
  if (!process.env.TELEGRAM_BOT_TOKEN) return NextResponse.json({ error: "no_token" }, { status: 500 });

  await sendTelegramMessage(chatId, "✅ <b>ReZerve test message</b>\n\nYour Telegram notifications are working correctly.");

  return NextResponse.json({ ok: true });
}
