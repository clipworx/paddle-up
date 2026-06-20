"use client";

import { use, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Logo } from "@/components/Logo";

type ReceiptBooking = {
  id: string;
  date: string;
  start_time: string;
  end_time: string;
  booker_name: string;
  status: "confirmed" | "cancelled" | "pending_payment" | "refunded";
  receipt_url: string | null;
  receipt_uploaded_at: string | null;
  court_name: string | null;
  location_name: string | null;
  payment_qr_url: string | null;
  payment_account_name: string | null;
  payment_account_number: string | null;
};

function fmtTime(t: string): string {
  const [h, m] = t.split(":").map(Number);
  const period = h < 12 ? "AM" : "PM";
  const hour = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${hour}:${String(m).padStart(2, "0")} ${period}`;
}

function displayDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", {
    weekday: "long", month: "long", day: "numeric", year: "numeric",
  });
}

export default function ReceiptUploadPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);

  const [booking, setBooking] = useState<ReceiptBooking | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  function load() {
    setLoading(true);
    fetch(`/api/bookings/${encodeURIComponent(id)}`)
      .then((r) => r.json())
      .then((json) => {
        if (json.error) { setNotFound(true); return; }
        setBooking(json.booking);
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  function onFileChange(f: File | null) {
    setFile(f);
    setUploadError(null);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(f ? URL.createObjectURL(f) : null);
  }

  async function onUpload() {
    if (!file) return;
    setUploading(true);
    setUploadError(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch(`/api/bookings/${encodeURIComponent(id)}/receipt`, {
        method: "POST",
        body: fd,
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msgs: Record<string, string> = {
          not_pending: "This booking is no longer awaiting payment.",
          file_required: "Please choose an image to upload.",
          invalid_file_type: "Please upload a JPG, PNG, WEBP, or GIF image.",
          file_too_large: "Image is too large (max 5MB).",
          not_found: "Booking not found.",
        };
        throw new Error(msgs[json.error] ?? json.error ?? "Upload failed.");
      }
      onFileChange(null);
      if (fileRef.current) fileRef.current.value = "";
      load();
    } catch (err) {
      setUploadError((err as Error).message);
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="min-h-screen bg-surface">
      <nav className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur">
        <div className="mx-auto max-w-lg w-full px-4 h-14 flex items-center gap-2">
          <Link href="/book" className="flex items-center gap-2 shrink-0">
            <Logo size={28} />
            <span className="text-[15px] font-extrabold text-foreground tracking-tight">
              Re<span className="text-accent">Z</span>erve
            </span>
          </Link>
        </div>
      </nav>

      <main className="mx-auto max-w-lg w-full px-4 py-8">
        {loading ? (
          <p className="text-sm text-muted text-center py-12">Loading…</p>
        ) : notFound || !booking ? (
          <div className="rounded-2xl border border-border bg-background p-8 text-center shadow-sm">
            <p className="text-sm font-semibold text-foreground">Booking not found</p>
            <p className="text-sm text-muted mt-1">Check the link and try again.</p>
          </div>
        ) : (
          <div className="space-y-5">
            <div>
              <h1 className="text-xl font-bold text-foreground">Upload payment receipt</h1>
              <p className="text-sm text-muted mt-1">
                {booking.court_name} · {booking.location_name}
              </p>
            </div>

            <div className="rounded-2xl border border-border bg-background p-5 shadow-sm space-y-1">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted">Booking details</p>
              <p className="font-semibold text-foreground text-sm">{displayDate(booking.date)}</p>
              <p className="text-sm text-muted">{fmtTime(booking.start_time)} – {fmtTime(booking.end_time)}</p>
              <p className="text-sm text-muted">Booked by {booking.booker_name}</p>
              <p className="text-xs text-muted font-mono pt-1">Ref: {booking.id.slice(0, 8).toUpperCase()}</p>
            </div>

            {booking.status === "confirmed" && (
              <div className="rounded-2xl border border-green-200 bg-green-50 p-5 text-center shadow-sm">
                <p className="font-bold text-green-800 text-sm">Payment confirmed!</p>
                <p className="text-sm text-green-700 mt-1">Your booking is all set. See you there!</p>
              </div>
            )}

            {(booking.status === "cancelled" || booking.status === "refunded") && (
              <div className="rounded-2xl border border-border bg-background p-5 text-center shadow-sm">
                <p className="font-semibold text-foreground text-sm">
                  This booking was {booking.status === "cancelled" ? "cancelled" : "refunded"}.
                </p>
                <p className="text-sm text-muted mt-1">No receipt upload is needed.</p>
              </div>
            )}

            {booking.status === "pending_payment" && (
              <>
                {(booking.payment_qr_url) && (
                  <div className="rounded-2xl border border-border bg-background p-5 shadow-sm flex flex-col items-center gap-3">
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-muted self-start">Pay via QR</p>
                    <img
                      src={booking.payment_qr_url}
                      alt="Payment QR code"
                      className="w-40 h-40 object-contain rounded-xl border border-border"
                    />
                    {(booking.payment_account_name || booking.payment_account_number) && (
                      <div className="text-center">
                        {booking.payment_account_name && (
                          <p className="font-semibold text-foreground text-sm">{booking.payment_account_name}</p>
                        )}
                        {booking.payment_account_number && (
                          <p className="text-sm text-muted">{booking.payment_account_number}</p>
                        )}
                      </div>
                    )}
                  </div>
                )}

                <div className="rounded-2xl border border-border bg-background p-5 shadow-sm space-y-3">
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-muted">
                    {booking.receipt_url ? "Replace receipt" : "Upload your payment receipt"}
                  </p>

                  {booking.receipt_url && !previewUrl && (
                    <div className="flex items-center gap-3 rounded-xl bg-surface p-3">
                      <img src={booking.receipt_url} alt="Uploaded receipt" className="w-16 h-16 object-cover rounded-lg border border-border" />
                      <div>
                        <p className="text-sm font-semibold text-foreground">Receipt uploaded</p>
                        <p className="text-xs text-muted">Waiting for the venue to confirm your payment.</p>
                      </div>
                    </div>
                  )}

                  {previewUrl && (
                    <img src={previewUrl} alt="Receipt preview" className="w-full max-h-64 object-contain rounded-xl border border-border" />
                  )}

                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/gif"
                    onChange={(e) => onFileChange(e.target.files?.[0] ?? null)}
                    className="w-full text-sm text-foreground file:mr-3 file:rounded-lg file:border-0 file:bg-accent/10 file:text-accent file:px-3 file:py-2 file:text-sm file:font-semibold"
                  />

                  {uploadError && <p className="text-sm text-red-600">{uploadError}</p>}

                  <button
                    onClick={onUpload}
                    disabled={!file || uploading}
                    className="w-full rounded-xl bg-accent text-background py-3 text-sm font-semibold hover:bg-muted transition-colors shadow-sm disabled:opacity-40"
                  >
                    {uploading ? "Uploading…" : booking.receipt_url ? "Upload new receipt" : "Upload receipt"}
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
