import { NextResponse } from "next/server";
import { getAdminSupabase } from "@/lib/supabase-admin";
import nodemailer from "nodemailer";

const BRAND = "ReZerve";

export async function POST(req: Request) {
  let body: { name?: unknown; email?: unknown; phone?: unknown; message?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const name    = typeof body.name    === "string" ? body.name.trim()    : "";
  const email   = typeof body.email   === "string" ? body.email.trim().toLowerCase() : "";
  const phone   = typeof body.phone   === "string" ? body.phone.trim()   : "";
  const message = typeof body.message === "string" ? body.message.trim() : "";

  if (!name)    return NextResponse.json({ error: "name_required" },    { status: 400 });
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
                return NextResponse.json({ error: "email_invalid" },    { status: 400 });
  if (!message) return NextResponse.json({ error: "message_required" }, { status: 400 });
  if (message.length > 2000) return NextResponse.json({ error: "message_too_long" }, { status: 400 });

  if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) {
    return NextResponse.json({ error: "email_not_configured" }, { status: 500 });
  }

  // Fetch the super admin's contact email from site_settings
  const supabase = getAdminSupabase();
  const { data: settings } = await supabase
    .from("site_settings")
    .select("contact_email")
    .single();

  const toEmail = settings?.contact_email ?? process.env.GMAIL_USER;

  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_APP_PASSWORD },
  });

  await transporter.sendMail({
    from: `"${BRAND} Contact Form" <${process.env.GMAIL_USER}>`,
    to: toEmail,
    replyTo: `"${name}" <${email}>`,
    subject: `New inquiry from ${name} — ${BRAND}`,
    html: `
      <div style="font-family:sans-serif;max-width:560px;margin:0 auto;color:#111">
        <h2 style="margin-bottom:4px">New inquiry via rezerve.today</h2>
        <p style="color:#666;margin-top:0;font-size:14px">Someone filled out the contact form and wants to learn more.</p>
        <hr style="border:none;border-top:1px solid #e5e7eb;margin:20px 0" />
        <table style="width:100%;font-size:14px;border-collapse:collapse">
          <tr><td style="padding:8px 0;color:#6b7280;width:80px">Name</td><td style="padding:8px 0;font-weight:600">${name}</td></tr>
          <tr><td style="padding:8px 0;color:#6b7280">Email</td><td style="padding:8px 0"><a href="mailto:${email}" style="color:#2563eb">${email}</a></td></tr>
          ${phone ? `<tr><td style="padding:8px 0;color:#6b7280">Phone</td><td style="padding:8px 0">${phone}</td></tr>` : ""}
        </table>
        <hr style="border:none;border-top:1px solid #e5e7eb;margin:20px 0" />
        <p style="font-size:14px;color:#6b7280;margin-bottom:6px">Message</p>
        <p style="font-size:15px;line-height:1.6;white-space:pre-wrap">${message}</p>
      </div>
    `,
  });

  return NextResponse.json({ ok: true });
}
