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

const HEADER_BG = "#14171a";
const BRAND     = "ReZerve";

function bookingTable(data: BookingEmailData, statusBadge: string): string {
  return `
  <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e4e4e7;border-radius:8px;overflow:hidden;font-size:14px;">
    <tr style="background:#f4f4f5;">
      <td colspan="2" style="padding:10px 16px;font-size:11px;font-weight:700;letter-spacing:.05em;text-transform:uppercase;color:#71717a;">Booking Details</td>
    </tr>
    <tr style="border-top:1px solid #e4e4e7;">
      <td style="padding:10px 16px;color:#71717a;font-weight:600;width:36%;">Reference</td>
      <td style="padding:10px 16px;color:#18181b;font-weight:700;">#${data.bookingId.slice(0, 8).toUpperCase()}</td>
    </tr>
    <tr style="border-top:1px solid #e4e4e7;background:#fafafa;">
      <td style="padding:10px 16px;color:#71717a;font-weight:600;">Status</td>
      <td style="padding:10px 16px;">${statusBadge}</td>
    </tr>
    <tr style="border-top:1px solid #e4e4e7;">
      <td style="padding:10px 16px;color:#71717a;font-weight:600;">Location</td>
      <td style="padding:10px 16px;color:#18181b;">${data.locationName}</td>
    </tr>
    <tr style="border-top:1px solid #e4e4e7;background:#fafafa;">
      <td style="padding:10px 16px;color:#71717a;font-weight:600;">Space</td>
      <td style="padding:10px 16px;color:#18181b;">${data.courtName}</td>
    </tr>
    <tr style="border-top:1px solid #e4e4e7;">
      <td style="padding:10px 16px;color:#71717a;font-weight:600;">Date</td>
      <td style="padding:10px 16px;color:#18181b;">${formatDate(data.date)}</td>
    </tr>
    <tr style="border-top:1px solid #e4e4e7;background:#fafafa;">
      <td style="padding:10px 16px;color:#71717a;font-weight:600;">Time</td>
      <td style="padding:10px 16px;color:#18181b;">${formatTime(data.startTime)} – ${formatTime(data.endTime)}</td>
    </tr>
    <tr style="border-top:1px solid #e4e4e7;">
      <td style="padding:10px 16px;color:#71717a;font-weight:600;">Name</td>
      <td style="padding:10px 16px;color:#18181b;">${data.bookerName}</td>
    </tr>
    <tr style="border-top:1px solid #e4e4e7;background:#fafafa;">
      <td style="padding:10px 16px;color:#71717a;font-weight:600;">Email</td>
      <td style="padding:10px 16px;"><a href="mailto:${data.bookerEmail}" style="color:#18181b;">${data.bookerEmail}</a></td>
    </tr>
    ${data.notes ? `
    <tr style="border-top:1px solid #e4e4e7;background:#fafafa;">
      <td style="padding:10px 16px;color:#71717a;font-weight:600;">Notes</td>
      <td style="padding:10px 16px;color:#18181b;">${data.notes}</td>
    </tr>` : ""}
  </table>`;
}

function emailWrapper(headerTitle: string, body: string, footerNote: string): string {
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:system-ui,-apple-system,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:32px 16px;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;border:1px solid #e4e4e7;overflow:hidden;max-width:560px;width:100%;">
        <tr>
          <td style="background:${HEADER_BG};padding:20px 28px;">
            <p style="margin:0;color:#a1a1aa;font-size:11px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;">${BRAND}</p>
            <h1 style="margin:4px 0 0;color:#fff;font-size:18px;font-weight:700;">${headerTitle}</h1>
          </td>
        </tr>
        <tr>
          <td style="padding:24px 28px;">${body}</td>
        </tr>
        <tr>
          <td style="padding:16px 28px;border-top:1px solid #e4e4e7;background:#fafafa;">
            <p style="margin:0;font-size:12px;color:#a1a1aa;">${footerNote}</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

// ── Admin notification ────────────────────────────────────────────────────────

export async function sendBookingNotification(
  toEmail: string,
  data: BookingEmailData
): Promise<void> {
  if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) return;

  const isPending = data.status === "pending_payment";

  const statusBadge = isPending
    ? `<span style="background:#fef08a;color:#854d0e;padding:2px 8px;border-radius:9999px;font-size:11px;font-weight:700;letter-spacing:.05em;text-transform:uppercase;">Pending Payment</span>`
    : `<span style="background:#bbf7d0;color:#166534;padding:2px 8px;border-radius:9999px;font-size:11px;font-weight:700;letter-spacing:.05em;text-transform:uppercase;">Confirmed</span>`;

  const body = `
    <p style="margin:0 0 20px;font-size:14px;color:#52525b;">
      A new booking has been placed at <strong>${data.locationName}</strong>.
      ${isPending ? "The customer has been shown your payment QR. Please confirm once you have received payment." : "No payment is required for this booking."}
    </p>
    ${bookingTable(data, statusBadge)}
    ${isPending ? `
    <div style="margin-top:20px;padding:14px 16px;background:#fefce8;border:1px solid #fde047;border-radius:8px;">
      <p style="margin:0;font-size:13px;color:#713f12;font-weight:600;">Action required</p>
      <p style="margin:6px 0 0;font-size:13px;color:#854d0e;">Log in to the admin panel and confirm this booking once you have received payment.</p>
    </div>` : ""}`;

  const subject = isPending
    ? `New booking pending payment — ${data.courtName} on ${formatDate(data.date)}`
    : `New confirmed booking — ${data.courtName} on ${formatDate(data.date)}`;

  const html = emailWrapper(
    isPending ? "New booking — payment pending" : "New booking confirmed",
    body,
    `This is an automated notification from ${BRAND}. Do not reply to this email.`
  );

  const transporter = getTransporter();
  await transporter.sendMail({
    from: `"${BRAND}" <${process.env.GMAIL_USER}>`,
    to: toEmail,
    subject,
    html,
  });
}

// ── Booker confirmation ───────────────────────────────────────────────────────

export async function sendBookingConfirmation(
  data: BookingEmailData
): Promise<void> {
  if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) return;

  const isPending = data.status === "pending_payment";

  const statusBadge = isPending
    ? `<span style="background:#fef08a;color:#854d0e;padding:2px 8px;border-radius:9999px;font-size:11px;font-weight:700;letter-spacing:.05em;text-transform:uppercase;">Pending Payment</span>`
    : `<span style="background:#bbf7d0;color:#166534;padding:2px 8px;border-radius:9999px;font-size:11px;font-weight:700;letter-spacing:.05em;text-transform:uppercase;">Confirmed</span>`;

  const body = `
    <p style="margin:0 0 20px;font-size:14px;color:#52525b;">
      Hi <strong>${data.bookerName}</strong>,<br><br>
      ${isPending
        ? `Your booking request at <strong>${data.locationName}</strong> has been received. Please complete your payment to confirm your slot — the venue will mark your booking as confirmed once payment is received.`
        : `Your booking at <strong>${data.locationName}</strong> is confirmed. See you there!`}
    </p>
    ${bookingTable(data, statusBadge)}
    ${isPending ? `
    <div style="margin-top:20px;padding:14px 16px;background:#fefce8;border:1px solid #fde047;border-radius:8px;">
      <p style="margin:0;font-size:13px;color:#713f12;font-weight:600;">Payment required</p>
      <p style="margin:6px 0 0;font-size:13px;color:#854d0e;">Please follow the payment instructions provided at checkout. Your slot is reserved while payment is pending.</p>
    </div>` : ""}`;

  const subject = isPending
    ? `Booking request received — ${data.courtName} on ${formatDate(data.date)}`
    : `Booking confirmed — ${data.courtName} on ${formatDate(data.date)}`;

  const html = emailWrapper(
    isPending ? "Booking request received" : "You're all set!",
    body,
    `This is an automated confirmation from ${BRAND}. Please do not reply to this email.`
  );

  const transporter = getTransporter();
  await transporter.sendMail({
    from: `"${BRAND}" <${process.env.GMAIL_USER}>`,
    to: data.bookerEmail,
    subject,
    html,
  });
}
