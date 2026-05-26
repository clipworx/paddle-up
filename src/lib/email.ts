import nodemailer from "nodemailer";

function getTransporter() {
  return nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_APP_PASSWORD,
    },
  });
}

export type BookingEmailData = {
  locationName: string;
  courtName: string;
  date: string;
  startTime: string;
  endTime: string;
  bookerName: string;
  bookerEmail: string;
  playerCount: number;
  notes: string | null;
  status: "confirmed" | "pending_payment";
  bookingId: string;
};

function formatTime(t: string): string {
  const [h, m] = t.split(":").map(Number);
  const period = h < 12 ? "AM" : "PM";
  const hour = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${hour}:${String(m).padStart(2, "0")} ${period}`;
}

function formatDate(iso: string): string {
  const [y, mo, d] = iso.split("-").map(Number);
  return new Date(y, mo - 1, d).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

export async function sendBookingNotification(
  toEmail: string,
  data: BookingEmailData
): Promise<void> {
  if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) return;

  const isPending = data.status === "pending_payment";
  const ref = data.bookingId.slice(0, 8).toUpperCase();
  const subject = isPending
    ? `New booking pending payment — ${data.courtName} on ${formatDate(data.date)}`
    : `New confirmed booking — ${data.courtName} on ${formatDate(data.date)}`;

  const statusBadge = isPending
    ? `<span style="background:#fef08a;color:#854d0e;padding:2px 8px;border-radius:9999px;font-size:11px;font-weight:700;letter-spacing:.05em;text-transform:uppercase;">Pending Payment</span>`
    : `<span style="background:#bbf7d0;color:#166534;padding:2px 8px;border-radius:9999px;font-size:11px;font-weight:700;letter-spacing:.05em;text-transform:uppercase;">Confirmed</span>`;

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:system-ui,-apple-system,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:32px 16px;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;border:1px solid #e4e4e7;overflow:hidden;max-width:560px;width:100%;">
        <!-- Header -->
        <tr>
          <td style="background:#18181b;padding:20px 28px;">
            <p style="margin:0;color:#a1a1aa;font-size:11px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;">PaddleUp</p>
            <h1 style="margin:4px 0 0;color:#fff;font-size:18px;font-weight:700;">${isPending ? "New booking — payment pending" : "New booking confirmed"}</h1>
          </td>
        </tr>
        <!-- Body -->
        <tr>
          <td style="padding:24px 28px;">
            <p style="margin:0 0 20px;font-size:14px;color:#52525b;">
              A new booking has been placed at <strong>${data.locationName}</strong>. ${isPending ? "The customer has been shown your payment QR. Please confirm once you have received payment." : "No payment is required for this booking."}
            </p>

            <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e4e4e7;border-radius:8px;overflow:hidden;font-size:14px;">
              <tr style="background:#f4f4f5;">
                <td colspan="2" style="padding:10px 16px;font-size:11px;font-weight:700;letter-spacing:.05em;text-transform:uppercase;color:#71717a;">Booking Details</td>
              </tr>
              <tr style="border-top:1px solid #e4e4e7;">
                <td style="padding:10px 16px;color:#71717a;font-weight:600;width:36%;">Reference</td>
                <td style="padding:10px 16px;color:#18181b;font-weight:700;">#${ref}</td>
              </tr>
              <tr style="border-top:1px solid #e4e4e7;background:#fafafa;">
                <td style="padding:10px 16px;color:#71717a;font-weight:600;">Status</td>
                <td style="padding:10px 16px;">${statusBadge}</td>
              </tr>
              <tr style="border-top:1px solid #e4e4e7;">
                <td style="padding:10px 16px;color:#71717a;font-weight:600;">Court</td>
                <td style="padding:10px 16px;color:#18181b;">${data.courtName}</td>
              </tr>
              <tr style="border-top:1px solid #e4e4e7;background:#fafafa;">
                <td style="padding:10px 16px;color:#71717a;font-weight:600;">Date</td>
                <td style="padding:10px 16px;color:#18181b;">${formatDate(data.date)}</td>
              </tr>
              <tr style="border-top:1px solid #e4e4e7;">
                <td style="padding:10px 16px;color:#71717a;font-weight:600;">Time</td>
                <td style="padding:10px 16px;color:#18181b;">${formatTime(data.startTime)} – ${formatTime(data.endTime)}</td>
              </tr>
              <tr style="border-top:1px solid #e4e4e7;background:#fafafa;">
                <td style="padding:10px 16px;color:#71717a;font-weight:600;">Booker</td>
                <td style="padding:10px 16px;color:#18181b;">${data.bookerName}</td>
              </tr>
              <tr style="border-top:1px solid #e4e4e7;">
                <td style="padding:10px 16px;color:#71717a;font-weight:600;">Email</td>
                <td style="padding:10px 16px;"><a href="mailto:${data.bookerEmail}" style="color:#18181b;">${data.bookerEmail}</a></td>
              </tr>
              <tr style="border-top:1px solid #e4e4e7;background:#fafafa;">
                <td style="padding:10px 16px;color:#71717a;font-weight:600;">Players</td>
                <td style="padding:10px 16px;color:#18181b;">${data.playerCount}</td>
              </tr>
              ${data.notes ? `
              <tr style="border-top:1px solid #e4e4e7;">
                <td style="padding:10px 16px;color:#71717a;font-weight:600;">Notes</td>
                <td style="padding:10px 16px;color:#18181b;">${data.notes}</td>
              </tr>` : ""}
            </table>

            ${isPending ? `
            <div style="margin-top:20px;padding:14px 16px;background:#fefce8;border:1px solid #fde047;border-radius:8px;">
              <p style="margin:0;font-size:13px;color:#713f12;font-weight:600;">Action required</p>
              <p style="margin:6px 0 0;font-size:13px;color:#854d0e;">Log in to the admin panel and confirm this booking once you have received the payment.</p>
            </div>` : ""}
          </td>
        </tr>
        <!-- Footer -->
        <tr>
          <td style="padding:16px 28px;border-top:1px solid #e4e4e7;background:#fafafa;">
            <p style="margin:0;font-size:12px;color:#a1a1aa;">This is an automated notification from PaddleUp. Do not reply to this email.</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

  const transporter = getTransporter();
  await transporter.sendMail({
    from: `"PaddleUp" <${process.env.GMAIL_USER}>`,
    to: toEmail,
    subject,
    html,
  });
}
