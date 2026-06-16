export async function sendTelegramMessage(chatId: string, text: string): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token || !chatId) return;

  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML" }),
  }).catch(() => {});
}

function fmtTime(t: string): string {
  const [h, m] = t.slice(0, 5).split(":").map(Number);
  const period = h < 12 ? "AM" : "PM";
  const hour = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${hour}:${String(m).padStart(2, "0")} ${period}`;
}

function fmtDate(iso: string): string {
  const [y, mo, d] = iso.split("-").map(Number);
  return new Date(y, mo - 1, d).toLocaleDateString("en-US", {
    weekday: "short", month: "short", day: "numeric", year: "numeric",
  });
}

export function buildNewBookingMessage(data: {
  locationName: string;
  courtName: string;
  date: string;
  startTime: string;
  endTime: string;
  bookerName: string;
  bookerPhone: string;
  bookerEmail: string;
  status: "confirmed" | "pending_payment";
}): string {
  const statusLine = data.status === "pending_payment"
    ? "⏳ <b>Pending payment</b>"
    : "✅ <b>Confirmed</b>";

  return [
    `🔔 <b>New booking</b> — ${data.locationName}`,
    "",
    `📍 ${data.courtName}`,
    `📅 ${fmtDate(data.date)}`,
    `⏰ ${fmtTime(data.startTime)} – ${fmtTime(data.endTime)}`,
    `👤 ${data.bookerName}`,
    `📞 ${data.bookerPhone}`,
    `✉️ ${data.bookerEmail}`,
    "",
    statusLine,
    data.status === "pending_payment"
      ? "Log in to the admin panel to confirm once payment is received." : "",
  ].filter((l) => l !== undefined).join("\n").trim();
}

export function buildConfirmedMessage(data: {
  locationName: string;
  courtName: string;
  date: string;
  startTime: string;
  endTime: string;
  bookerName: string;
}): string {
  return [
    `✅ <b>Booking confirmed</b> — ${data.locationName}`,
    "",
    `📍 ${data.courtName}`,
    `📅 ${fmtDate(data.date)}`,
    `⏰ ${fmtTime(data.startTime)} – ${fmtTime(data.endTime)}`,
    `👤 ${data.bookerName}`,
  ].join("\n");
}
