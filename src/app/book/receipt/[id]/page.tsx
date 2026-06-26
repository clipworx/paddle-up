"use client";

import { use, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { BadgeCheck, Ban, Check, Clock, FileSearch, Upload } from "lucide-react";
import { Logo } from "@/components/Logo";

type ReceiptBooking = {
  id: string;
  date: string;
  start_time: string;
  end_time: string;
  booker_name: string;
  status: "confirmed" | "cancelled" | "pending_payment" | "pending_confirmation" | "refunded";
  receipt_url: string | null;
  receipt_uploaded_at: string | null;
  created_at: string;
  court_name: string | null;
  location_name: string | null;
  payment_qr_url: string | null;
  payment_account_name: string | null;
  payment_account_number: string | null;
  pending_payment_expiry_hours: number | null;
};

const COURT_LINE_OVERLAY = {
  backgroundImage:
    "linear-gradient(transparent 48.5%, rgba(255,255,255,.28) 48.5%, rgba(255,255,255,.28) 51.5%, transparent 51.5%)," +
    "linear-gradient(90deg, transparent 48.5%, rgba(255,255,255,.15) 48.5%, rgba(255,255,255,.15) 51.5%, transparent 51.5%)," +
    "linear-gradient(transparent 23%, rgba(255,255,255,.18) 23%, rgba(255,255,255,.18) 24.5%, transparent 24.5%, transparent 75.5%, rgba(255,255,255,.18) 75.5%, rgba(255,255,255,.18) 77%, transparent 77%)",
};

function CourtSurface({ className }: { className?: string }) {
  return <div className={`court-surface ${className ?? ""}`} style={COURT_LINE_OVERLAY} />;
}

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

function displayDateShort(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", {
    weekday: "short", month: "short", day: "numeric",
  });
}

function fmtDateTime(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    month: "short", day: "numeric", hour: "numeric", minute: "2-digit", hour12: true,
  });
}

function expiryDeadline(createdAt: string, hours: number): string {
  const deadline = new Date(new Date(createdAt).getTime() + hours * 60 * 60 * 1000);
  return deadline.toLocaleString("en-US", {
    month: "short", day: "numeric", hour: "numeric", minute: "2-digit", hour12: true,
  });
}

const STATUS_BANNER: Record<ReceiptBooking["status"], { wrap: string; icon: React.ReactNode; label: string; labelClass: string; body: string }> = {
  pending_payment: {
    wrap: "bg-amber-50 border-b-2 border-warning",
    icon: <Clock size={18} className="text-warning shrink-0" />,
    label: "Pending payment",
    labelClass: "text-warning",
    body: "Upload your receipt to confirm your booking.",
  },
  pending_confirmation: {
    wrap: "bg-violet-50 border-b-2 border-violet-400",
    icon: <FileSearch size={18} className="text-violet-600 shrink-0" />,
    label: "Awaiting confirmation",
    labelClass: "text-violet-600",
    body: "We've received your receipt — the venue will confirm shortly.",
  },
  confirmed: {
    wrap: "bg-accent/10 border-b-2 border-accent",
    icon: <BadgeCheck size={18} className="text-accent shrink-0" />,
    label: "Confirmed",
    labelClass: "text-accent",
    body: "Your booking is all set. See you there!",
  },
  cancelled: {
    wrap: "bg-surface border-b-2 border-border",
    icon: <Ban size={18} className="text-muted shrink-0" />,
    label: "Cancelled",
    labelClass: "text-muted",
    body: "No receipt upload is needed for this booking.",
  },
  refunded: {
    wrap: "bg-blue-50 border-b-2 border-info",
    icon: <BadgeCheck size={18} className="text-info shrink-0" />,
    label: "Refunded",
    labelClass: "text-info",
    body: "This booking has been refunded.",
  },
};

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

  const banner = booking ? STATUS_BANNER[booking.status] : null;
  const showStepper = booking && (booking.status === "pending_payment" || booking.status === "pending_confirmation" || booking.status === "confirmed");
  const receiptUnderReview = booking?.status === "pending_confirmation";
  const confirmed = booking?.status === "confirmed";

  return (
    <div className="min-h-screen bg-surface">
      <nav className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur">
        <div className="mx-auto max-w-lg w-full px-4 h-14 flex items-center justify-center gap-2">
          <Link href="/book" className="flex items-center gap-2 shrink-0">
            <Logo size={28} />
            <span className="font-display text-[17px] font-bold uppercase tracking-widest text-foreground">
              Re<span className="text-accent">Z</span>erve
            </span>
          </Link>
        </div>
      </nav>

      {loading ? (
        <p className="text-sm text-muted text-center py-12">Loading…</p>
      ) : notFound || !booking || !banner ? (
        <main className="mx-auto max-w-lg w-full px-4 py-8">
          <div className="rounded-2xl bg-background p-8 text-center shadow-sm">
            <p className="text-sm font-semibold text-foreground">Booking not found</p>
            <p className="text-sm text-muted mt-1">Check the link and try again.</p>
          </div>
        </main>
      ) : (
        <>
          {/* Status banner */}
          <div className={`${banner.wrap} px-4 py-3`}>
            <div className="mx-auto max-w-lg flex items-center gap-2.5">
              {banner.icon}
              <div>
                <div className={`font-op-mono text-[11px] font-bold tracking-widest ${banner.labelClass}`}>
                  {banner.label.toUpperCase()}
                </div>
                <p className="text-xs text-muted mt-0.5">{banner.body}</p>
              </div>
            </div>
          </div>

          <main className="mx-auto max-w-lg w-full px-4 py-6 space-y-4">
            {/* Booking summary */}
            <div className="rounded-2xl bg-background p-4 shadow-sm">
              <p className="font-op-mono text-[10px] font-bold text-muted uppercase tracking-widest mb-2.5">Booking summary</p>
              <div className="flex items-center gap-3 mb-3">
                <CourtSurface className="w-12 h-12 rounded-lg shrink-0" />
                <div className="min-w-0">
                  <p className="text-[15px] font-bold text-foreground truncate">{booking.court_name ?? "Court"}</p>
                  <p className="text-sm text-muted truncate">{booking.location_name}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-lg bg-surface px-2.5 py-2">
                  <p className="font-op-mono text-[9px] text-muted uppercase tracking-widest">Date</p>
                  <p className="text-[13px] font-semibold text-foreground mt-0.5">{displayDateShort(booking.date)}</p>
                </div>
                <div className="rounded-lg bg-surface px-2.5 py-2">
                  <p className="font-op-mono text-[9px] text-muted uppercase tracking-widest">Time</p>
                  <p className="text-[13px] font-semibold text-foreground mt-0.5">{fmtTime(booking.start_time)} – {fmtTime(booking.end_time)}</p>
                </div>
                <div className="rounded-lg bg-surface px-2.5 py-2">
                  <p className="font-op-mono text-[9px] text-muted uppercase tracking-widest">Ref no.</p>
                  <p className="font-op-mono text-[12px] font-bold text-foreground mt-0.5">{booking.id.slice(0, 8).toUpperCase()}</p>
                </div>
                <div className="rounded-lg bg-surface px-2.5 py-2">
                  <p className="font-op-mono text-[9px] text-muted uppercase tracking-widest">Booked by</p>
                  <p className="text-[13px] font-semibold text-foreground mt-0.5 truncate">{booking.booker_name}</p>
                </div>
              </div>
            </div>

            {booking.status === "cancelled" || booking.status === "refunded" ? (
              <div className="rounded-2xl bg-background p-5 text-center shadow-sm">
                <p className="font-semibold text-foreground text-sm">{displayDate(booking.date)}</p>
                <p className="text-sm text-muted mt-1">
                  This booking was {booking.status === "cancelled" ? "cancelled" : "refunded"}.
                </p>
              </div>
            ) : (
              <>
                {booking.status === "pending_payment" && booking.payment_qr_url && (
                  <div className="rounded-2xl bg-background p-5 shadow-sm flex flex-col items-center gap-3">
                    <p className="font-op-mono text-[10px] font-bold text-muted uppercase tracking-widest self-start">Pay via QR</p>
                    <img
                      src={booking.payment_qr_url}
                      alt="Payment QR code"
                      className="w-40 h-40 object-contain rounded-xl"
                    />
                    {(booking.payment_account_name || booking.payment_account_number) && (
                      <div className="text-center">
                        {booking.payment_account_number && (
                          <p className="font-semibold text-foreground text-sm">{booking.payment_account_number}</p>
                        )}
                        {booking.payment_account_name && (
                          <p className="text-sm text-muted">{booking.payment_account_name}</p>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {(booking.status === "pending_payment" || booking.status === "pending_confirmation") && (
                  <div className="rounded-2xl bg-background p-5 shadow-sm space-y-3">
                    <p className="font-op-mono text-[10px] font-bold text-muted uppercase tracking-widest">
                      {booking.receipt_url ? "Replace receipt" : "Upload your payment receipt"}
                    </p>

                    {booking.status === "pending_payment" && booking.pending_payment_expiry_hours != null && (
                      <div className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-3">
                        <p className="text-[13px] font-semibold text-amber-800">
                          ⏱ Upload by {expiryDeadline(booking.created_at, booking.pending_payment_expiry_hours)}
                        </p>
                        <p className="text-[12px] text-amber-700 mt-0.5">
                          This booking will be automatically cancelled if no receipt is uploaded by then.
                        </p>
                      </div>
                    )}

                    {previewUrl ? (
                      <img src={previewUrl} alt="Receipt preview" className="w-full max-h-64 object-contain rounded-xl" />
                    ) : booking.receipt_url ? (
                      <div className="flex items-center gap-3 rounded-xl bg-surface p-3">
                        <img src={booking.receipt_url} alt="Uploaded receipt" className="w-16 h-16 object-cover rounded-lg" />
                        <div>
                          <p className="text-sm font-semibold text-foreground">Receipt uploaded</p>
                          <p className="text-xs text-muted">Waiting for the venue to confirm your payment.</p>
                        </div>
                      </div>
                    ) : (
                      <label className="block border-2 border-dashed border-ink-300 rounded-2xl px-5 py-7 text-center cursor-pointer hover:border-accent/50 transition-colors">
                        <input
                          ref={fileRef}
                          type="file"
                          accept="image/png,image/jpeg,image/webp,image/gif"
                          onChange={(e) => onFileChange(e.target.files?.[0] ?? null)}
                          className="sr-only"
                        />
                        <div className="w-12 h-12 rounded-full bg-surface mx-auto mb-3 flex items-center justify-center">
                          <Upload size={20} className="text-muted" />
                        </div>
                        <p className="text-sm font-bold text-foreground mb-1">Upload payment receipt</p>
                        <p className="text-xs text-muted">Screenshot or photo of your payment confirmation</p>
                        <span className="mt-3 inline-block rounded-full bg-surface px-4 py-2 text-xs font-bold text-foreground">Choose file</span>
                      </label>
                    )}

                    {(previewUrl || booking.receipt_url) && !previewUrl ? (
                      <label className="block text-center text-xs font-bold text-accent cursor-pointer hover:underline">
                        Choose a different file
                        <input
                          ref={fileRef}
                          type="file"
                          accept="image/png,image/jpeg,image/webp,image/gif"
                          onChange={(e) => onFileChange(e.target.files?.[0] ?? null)}
                          className="sr-only"
                        />
                      </label>
                    ) : null}

                    {uploadError && <p className="text-sm text-negative">{uploadError}</p>}

                    {previewUrl && (
                      <button
                        onClick={onUpload}
                        disabled={!file || uploading}
                        className="w-full rounded-full bg-accent text-white py-3 text-sm font-bold hover:opacity-90 transition-opacity shadow-sm disabled:opacity-40"
                      >
                        {uploading ? "Uploading…" : booking.receipt_url ? "Upload new receipt" : "Upload receipt"}
                      </button>
                    )}
                  </div>
                )}

                {/* Confirmation status stepper */}
                {showStepper && (
                  <div className="rounded-2xl bg-background p-5 shadow-sm">
                    <p className="font-op-mono text-[10px] font-bold text-muted uppercase tracking-widest mb-3.5">Confirmation status</p>
                    <div className="space-y-2.5">
                      <StepRow done label="Booking submitted" sub={fmtDateTime(booking.created_at)} />
                      <StepRow
                        done={confirmed}
                        active={receiptUnderReview}
                        label="Receipt under review"
                        sub={booking.receipt_uploaded_at ? fmtDateTime(booking.receipt_uploaded_at) : "Usually within 1 hour"}
                      />
                      <StepRow done={confirmed} label="Booking confirmed" sub="You'll get an email confirmation" />
                    </div>
                  </div>
                )}
              </>
            )}
          </main>
        </>
      )}
    </div>
  );
}

function StepRow({ done, active, label, sub }: { done?: boolean; active?: boolean; label: string; sub: string }) {
  return (
    <div className={`flex items-center gap-2.5 ${!done && !active ? "opacity-40" : ""}`}>
      <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${
        done ? "bg-accent" : active ? "bg-warning" : "bg-border"
      }`}>
        {done ? (
          <Check size={14} className="text-white" />
        ) : active ? (
          <Clock size={14} className="text-white" />
        ) : (
          <BadgeCheck size={14} className="text-muted" />
        )}
      </div>
      <div>
        <p className="text-sm font-semibold text-foreground">{label}</p>
        <p className="font-op-mono text-[10px] text-muted mt-0.5">{sub}</p>
      </div>
    </div>
  );
}
