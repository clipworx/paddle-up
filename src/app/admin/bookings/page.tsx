"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AdminNav } from "@/components/AdminNav";
import { TIME_SLOTS } from "@/lib/types";
import type { Booking, BookingStatus } from "@/lib/types";

type BookingWithCourt = Booking & { court_name?: string | null; location_name?: string | null };
type LocationOption = { id: string; name: string };

const TODAY = new Date().toISOString().split("T")[0];

function displayDate(iso: string): string {
  const [y, m, day] = iso.split("-").map(Number);
  return new Date(y, m - 1, day).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function fmtTime(t: string): string {
  const [h, m] = t.split(":").map(Number);
  const period = h < 12 ? "AM" : "PM";
  const hour = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${hour}:${String(m).padStart(2, "0")} ${period}`;
}

function fmtDatetime(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

const STATUS_STYLES: Record<BookingStatus, string> = {
  confirmed: "bg-green-100 text-green-700",
  pending_payment: "bg-yellow-100 text-yellow-700",
  pending_confirmation: "bg-violet-100 text-violet-700",
  cancelled: "bg-gray-100 text-gray-500",
  refunded: "bg-blue-100 text-blue-600",
};

const STATUS_LABELS: Record<BookingStatus, string> = {
  confirmed: "Confirmed",
  pending_payment: "Pending",
  pending_confirmation: "Awaiting Review",
  cancelled: "Cancelled",
  refunded: "Refunded",
};

function StatusBadge({ status }: { status: BookingStatus }) {
  return (
    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-widest ${STATUS_STYLES[status]}`}>
      {STATUS_LABELS[status]}
    </span>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex gap-3">
      <span className="w-24 shrink-0 text-xs text-muted font-semibold uppercase tracking-wide pt-0.5">{label}</span>
      <span className={`text-sm text-foreground break-all ${mono ? "font-mono text-xs" : ""}`}>{value}</span>
    </div>
  );
}

function RefundDialog({ onConfirm, onClose }: {
  onConfirm: (reason: string) => void;
  onClose: () => void;
}) {
  const [reason, setReason] = useState("");
  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm px-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-xl border border-border bg-background shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="border-b border-border px-5 py-4">
          <h3 className="text-base font-bold text-foreground">Mark as Refunded</h3>
          <p className="text-xs text-muted mt-1">Provide a reason for the refund (optional).</p>
        </div>
        <div className="px-5 py-4">
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. Court was unavailable, player requested cancellation…"
            rows={3}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted/50 focus:outline-none focus:border-accent resize-none"
          />
        </div>
        <div className="flex gap-2 border-t border-border px-5 py-4">
          <button
            onClick={onClose}
            className="flex-1 rounded-lg border border-border px-3 py-2 text-sm font-semibold text-muted hover:bg-accent/5 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => onConfirm(reason)}
            className="flex-1 rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700 transition-colors"
          >
            Mark Refunded
          </button>
        </div>
      </div>
    </div>
  );
}

function DetailModal({ booking, onClose, onConfirm, onCancel, onRefund, onReschedule, confirming, cancelling, refunding }: {
  booking: BookingWithCourt;
  onClose: () => void;
  onConfirm: (id: string) => void;
  onCancel: (id: string) => void;
  onRefund: (id: string) => void;
  onReschedule: (b: BookingWithCourt) => void;
  confirming: boolean;
  cancelling: boolean;
  refunding: boolean;
}) {
  const isPast = booking.date < TODAY;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-xl border border-border bg-background shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-bold text-foreground">Booking Details</h2>
            <StatusBadge status={booking.status} />
          </div>
          <button onClick={onClose} className="text-muted hover:text-foreground text-lg leading-none">×</button>
        </div>

        <div className="px-5 py-4 space-y-3">
          {booking.location_name && <Row label="Location" value={booking.location_name} />}
          <Row label="Court" value={booking.court_name ?? booking.court_id} />
          <Row label="Date" value={displayDate(booking.date)} />
          <Row label="Time" value={`${fmtTime(booking.start_time)} – ${fmtTime(booking.end_time)}`} />
          <div className="border-t border-border pt-3 space-y-3">
            <Row label="Booker" value={booking.booker_name} />
            <Row label="Phone" value={booking.booker_phone || "—"} />
            <Row label="Email" value={booking.booker_email ?? "—"} />
          </div>
          <div className="border-t border-border pt-3 space-y-3">
            <Row label="Players" value={String(booking.player_count)} />
            <Row label="Notes" value={booking.notes ?? "—"} />
          </div>
          {booking.status === "refunded" && (
            <div className="border-t border-border pt-3">
              <Row label="Refund reason" value={booking.refund_reason ?? "No reason provided"} />
            </div>
          )}
          {booking.receipt_url && (
            <div className="border-t border-border pt-3 space-y-2">
              <span className="text-xs text-muted font-semibold uppercase tracking-wide">Payment receipt</span>
              <a href={booking.receipt_url} target="_blank" rel="noopener noreferrer" className="block">
                <img
                  src={booking.receipt_url}
                  alt="Payment receipt"
                  className="w-full max-h-72 object-contain rounded-xl border border-border hover:opacity-90 transition-opacity"
                />
              </a>
            </div>
          )}
          <div className="border-t border-border pt-3 space-y-3">
            <Row label="Booking ID" value={booking.id} mono />
            <Row label="Created" value={fmtDatetime(booking.created_at)} />
          </div>
        </div>

        {booking.status !== "cancelled" && booking.status !== "refunded" && (
          <div className="flex flex-wrap gap-2 border-t border-border px-5 py-4">
            {(booking.status === "pending_payment" || booking.status === "pending_confirmation") && !isPast && (
              <button
                onClick={() => onConfirm(booking.id)}
                disabled={confirming}
                className="flex-1 rounded-lg border border-green-400 bg-green-50 px-3 py-2 text-sm font-semibold text-green-700 hover:bg-green-500 hover:text-white transition-colors disabled:opacity-40"
              >
                {confirming ? "Confirming…" : "Confirm Payment"}
              </button>
            )}
            {!isPast && (
              <button
                onClick={() => onReschedule(booking)}
                className="flex-1 rounded-lg border border-border px-3 py-2 text-sm font-semibold text-foreground hover:bg-accent/10 hover:border-accent transition-colors"
              >
                Reschedule
              </button>
            )}
            {!isPast && (
              <button
                onClick={() => onCancel(booking.id)}
                disabled={cancelling}
                className="flex-1 rounded-lg border border-accent/50 bg-accent/5 px-3 py-2 text-sm font-semibold text-accent hover:bg-accent hover:text-background transition-colors disabled:opacity-40"
              >
                {cancelling ? "Cancelling…" : "Cancel Booking"}
              </button>
            )}
            {isPast && (
              <button
                onClick={() => onRefund(booking.id)}
                disabled={refunding}
                className="flex-1 rounded-lg border border-blue-400 bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-600 hover:text-white transition-colors disabled:opacity-40"
              >
                {refunding ? "Processing…" : "Mark as Refunded"}
              </button>
            )}
          </div>
        )}
        {booking.status === "cancelled" && isPast && (
          <div className="flex gap-2 border-t border-border px-5 py-4">
            <button
              onClick={() => onRefund(booking.id)}
              disabled={refunding}
              className="flex-1 rounded-lg border border-blue-400 bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-600 hover:text-white transition-colors disabled:opacity-40"
            >
              {refunding ? "Processing…" : "Mark as Refunded"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default function AdminBookingsPage() {
  const router = useRouter();
  const [locationId, setLocationId] = useState("");
  const [locations, setLocations] = useState<LocationOption[]>([]);
  const [bookings, setBookings] = useState<BookingWithCourt[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [refundingId, setRefundingId] = useState<string | null>(null);
  const [selected, setSelected] = useState<BookingWithCourt | null>(null);
  const [refundTarget, setRefundTarget] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  const [rescheduleTarget, setRescheduleTarget]         = useState<BookingWithCourt | null>(null);
  const [rescheduleDate, setRescheduleDate]             = useState("");
  const [rescheduleStartHour, setRescheduleStartHour]   = useState(0);
  const [rescheduleEndHour, setRescheduleEndHour]       = useState(1);
  const [rescheduleSubmitting, setRescheduleSubmitting] = useState(false);
  const [rescheduleError, setRescheduleError]           = useState<string | null>(null);

  const loadBookings = useCallback(async (locId: string, pg: number) => {
    setError(null);
    setBookings(null);
    try {
      const params = new URLSearchParams({ page: String(pg), limit: "10" });
      if (locId) params.set("location_id", locId);
      const res = await fetch(`/api/admin/bookings?${params}`);
      if (res.status === 401 || res.status === 403) { router.replace("/admin/login"); return; }
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to load bookings");
      setBookings(json.bookings ?? []);
      setTotal(json.total ?? 0);
    } catch (err) {
      setError((err as Error).message);
    }
  }, [router]);

  useEffect(() => {
    fetch("/api/admin/locations")
      .then((r) => r.json())
      .then((j) => setLocations((j.locations ?? []).map((l: { id: string; name: string }) => ({ id: l.id, name: l.name }))))
      .catch(() => {});
  }, []);

  useEffect(() => { loadBookings(locationId, page); }, [locationId, page, loadBookings]);

  // Keep selected booking in sync after reload
  useEffect(() => {
    if (selected && bookings) {
      const updated = bookings.find((b) => b.id === selected.id);
      setSelected(updated ?? null);
    }
  }, [bookings]); // eslint-disable-line react-hooks/exhaustive-deps

  async function onCancel(id: string) {
    if (!confirm("Cancel this booking? The player will not be notified automatically.")) return;
    setCancellingId(id);
    try {
      const res = await fetch(`/api/admin/bookings/${encodeURIComponent(id)}`, { method: "DELETE" });
      if (res.status === 401 || res.status === 403) { router.replace("/admin/login"); return; }
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || "Cancel failed");
      await loadBookings(locationId, page);
      setSelected(null);
    } catch (err) {
      alert((err as Error).message);
    } finally {
      setCancellingId(null);
    }
  }

  async function onConfirm(id: string) {
    setConfirmingId(id);
    try {
      const res = await fetch(`/api/admin/bookings/${encodeURIComponent(id)}/confirm`, { method: "POST" });
      if (res.status === 401 || res.status === 403) { router.replace("/admin/login"); return; }
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || "Confirm failed");
      await loadBookings(locationId, page);
      setSelected(null);
    } catch (err) {
      alert((err as Error).message);
    } finally {
      setConfirmingId(null);
    }
  }

  async function onRefundConfirm(reason: string) {
    if (!refundTarget) return;
    const id = refundTarget;
    setRefundTarget(null);
    setRefundingId(id);
    try {
      const res = await fetch(`/api/admin/bookings/${encodeURIComponent(id)}/refund`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
      });
      if (res.status === 401 || res.status === 403) { router.replace("/admin/login"); return; }
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || "Refund failed");
      await loadBookings(locationId, page);
      setSelected(null);
    } catch (err) {
      alert((err as Error).message);
    } finally {
      setRefundingId(null);
    }
  }

  function openReschedule(b: BookingWithCourt) {
    const sh = parseInt(b.start_time.split(":")[0], 10);
    const eh = parseInt(b.end_time.split(":")[0], 10);
    setRescheduleTarget(b);
    setRescheduleDate(b.date);
    setRescheduleStartHour(sh);
    setRescheduleEndHour(eh);
    setRescheduleError(null);
    setSelected(null);
  }

  async function onRescheduleSubmit() {
    if (!rescheduleTarget) return;
    setRescheduleSubmitting(true);
    setRescheduleError(null);
    try {
      const pad = (n: number) => String(n).padStart(2, "0");
      const res = await fetch(`/api/admin/bookings/${encodeURIComponent(rescheduleTarget.id)}/reschedule`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          date: rescheduleDate,
          start_time: `${pad(rescheduleStartHour)}:00`,
          end_time: `${pad(rescheduleEndHour)}:00`,
        }),
      });
      if (res.status === 401 || res.status === 403) { router.replace("/admin/login"); return; }
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg: Record<string, string> = {
          slot_taken: "That time slot is already booked.",
          cannot_reschedule: "This booking cannot be rescheduled.",
          missing_fields: "Please fill in all required fields.",
          date_invalid: "Invalid date.",
          time_invalid: "Invalid time.",
          time_range_invalid: "End time must be after start time.",
          slot_blocked: "That slot is blocked off.",
        };
        throw new Error(msg[json.error] ?? json.error ?? "Failed to reschedule");
      }
      setRescheduleTarget(null);
      await loadBookings(locationId, page);
    } catch (err) {
      setRescheduleError((err as Error).message);
    } finally {
      setRescheduleSubmitting(false);
    }
  }

  async function onLogout() {
    await fetch("/api/admin/logout", { method: "POST" });
    router.replace("/admin/login");
  }

  const totalPages = Math.ceil(total / 10);

  return (
    <>
      <AdminNav onLogout={onLogout} />
      <main className="mx-auto max-w-5xl w-full px-4 py-10 space-y-8">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-foreground">Bookings</h1>
          <Link
            href="/book"
            target="_blank"
            className="rounded-lg border border-border px-4 py-2 text-sm font-semibold text-foreground hover:bg-accent/10 hover:border-accent transition-colors"
          >
            Booking page ↗
          </Link>
        </div>

        <div className="flex items-center gap-3">
          {locations.length > 0 && (
            <select
              value={locationId}
              onChange={(e) => { setLocationId(e.target.value); setPage(1); }}
              className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:border-accent"
            >
              <option value="">All locations</option>
              {locations.map((loc) => (
                <option key={loc.id} value={loc.id}>{loc.name}</option>
              ))}
            </select>
          )}
          <button
            onClick={() => loadBookings(locationId, page)}
            className="rounded-lg border border-border px-3 py-2 text-sm font-semibold text-foreground hover:bg-accent/10 hover:border-accent transition-colors ml-auto"
          >
            Refresh
          </button>
        </div>

        {error && (
          <p className="rounded-lg border border-accent/40 bg-accent/5 px-4 py-3 text-sm text-accent font-semibold">
            {error}
          </p>
        )}

        {bookings === null && !error && (
          <p className="text-sm text-muted">Loading…</p>
        )}

        {bookings !== null && bookings.length === 0 && (
          <div className="rounded-xl border border-border bg-background/60 p-8 text-center shadow-sm">
            <p className="text-sm text-muted">No bookings found.</p>
          </div>
        )}

        {bookings !== null && bookings.length > 0 && (
          <div className="overflow-hidden rounded-xl border border-border bg-background/60 shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-surface">
                  <tr className="text-left">
                    <th className="px-4 py-3 text-xs uppercase tracking-wide text-muted font-semibold">Court</th>
                    <th className="px-4 py-3 text-xs uppercase tracking-wide text-muted font-semibold">Date / Time</th>
                    <th className="px-4 py-3 text-xs uppercase tracking-wide text-muted font-semibold">Booker</th>
                    <th className="px-4 py-3 text-xs uppercase tracking-wide text-muted font-semibold">Status</th>
                    <th className="px-4 py-3 text-xs uppercase tracking-wide text-muted font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {bookings.map((b, i) => {
                    const rowIsPast = b.date < TODAY;
                    return (
                      <tr
                        key={b.id}
                        className={[
                          i === 0 ? "" : "border-t border-border",
                          b.status === "cancelled" || b.status === "refunded" ? "opacity-50" : "hover:bg-accent/5",
                          "transition-colors",
                        ].join(" ")}
                      >
                        <td className="px-4 py-3 whitespace-nowrap">
                          <p className="font-semibold text-foreground">{b.court_name ?? b.court_id}</p>
                          {b.location_name && (
                            <p className="text-xs text-muted">{b.location_name}</p>
                          )}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <p className="text-xs text-muted">{displayDate(b.date)}</p>
                          <span className="text-foreground">{fmtTime(b.start_time)} – {fmtTime(b.end_time)}</span>
                        </td>
                        <td className="px-4 py-3">
                          <p className="font-medium text-foreground">{b.booker_name}</p>
                          <p className="text-xs text-muted">{b.booker_phone || "—"}</p>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-col gap-1">
                            <StatusBadge status={b.status} />
                            {b.status === "refunded" && b.refund_reason && (
                              <span className="text-[11px] text-muted leading-snug max-w-40">{b.refund_reason}</span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex gap-2 flex-wrap">
                            <button
                              onClick={() => setSelected(b)}
                              className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-accent/10 hover:border-accent transition-colors"
                            >
                              View
                            </button>
                            {(b.status === "pending_payment" || b.status === "pending_confirmation") && !rowIsPast && (
                              <button
                                onClick={() => onConfirm(b.id)}
                                disabled={confirmingId === b.id}
                                className="rounded-lg border border-green-400 bg-green-50 px-3 py-1.5 text-xs font-semibold text-green-700 hover:bg-green-500 hover:text-white transition-colors disabled:opacity-40"
                              >
                                {confirmingId === b.id ? "…" : "Confirm"}
                              </button>
                            )}
                            {b.status !== "cancelled" && b.status !== "refunded" && !rowIsPast && (
                              <button
                                onClick={() => openReschedule(b)}
                                className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-accent/10 hover:border-accent transition-colors"
                              >
                                Reschedule
                              </button>
                            )}
                            {b.status !== "cancelled" && b.status !== "refunded" && !rowIsPast && (
                              <button
                                onClick={() => onCancel(b.id)}
                                disabled={cancellingId === b.id}
                                className="rounded-lg border border-accent/50 bg-accent/5 px-3 py-1.5 text-xs font-semibold text-accent hover:bg-accent hover:text-background transition-colors disabled:opacity-40"
                              >
                                {cancellingId === b.id ? "…" : "Cancel"}
                              </button>
                            )}
                            {b.status !== "refunded" && rowIsPast && (
                              <button
                                onClick={() => setRefundTarget(b.id)}
                                disabled={refundingId === b.id}
                                className="rounded-lg border border-blue-400 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-600 hover:text-white transition-colors disabled:opacity-40"
                              >
                                {refundingId === b.id ? "…" : "Refund"}
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {total > 10 && (
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted">
              {((page - 1) * 10) + 1}–{Math.min(page * 10, total)} of {total} bookings
            </span>
            <div className="flex items-center gap-2">
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
                className="rounded-lg border border-border px-3 py-2 text-sm font-semibold text-foreground hover:bg-accent/10 hover:border-accent transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                ‹ Prev
              </button>
              <span className="text-sm text-muted tabular-nums">Page {page} of {totalPages}</span>
              <button
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="rounded-lg border border-border px-3 py-2 text-sm font-semibold text-foreground hover:bg-accent/10 hover:border-accent transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Next ›
              </button>
            </div>
          </div>
        )}
      </main>

      {selected && (
        <DetailModal
          booking={selected}
          onClose={() => setSelected(null)}
          onConfirm={onConfirm}
          onCancel={onCancel}
          onRefund={(id) => { setSelected(null); setRefundTarget(id); }}
          onReschedule={openReschedule}
          confirming={confirmingId === selected.id}
          cancelling={cancellingId === selected.id}
          refunding={refundingId === selected.id}
        />
      )}

      {refundTarget && (
        <RefundDialog
          onConfirm={onRefundConfirm}
          onClose={() => setRefundTarget(null)}
        />
      )}

      {/* ── Reschedule modal ── */}
      {rescheduleTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4"
          onClick={() => setRescheduleTarget(null)}
        >
          <div
            className="w-full max-w-md rounded-xl border border-border bg-background shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-border px-5 py-4">
              <div>
                <h3 className="text-base font-bold text-foreground">Reschedule booking</h3>
                <p className="text-xs text-muted mt-0.5">{rescheduleTarget.court_name ?? rescheduleTarget.court_id} · {rescheduleTarget.booker_name}</p>
              </div>
              <button onClick={() => setRescheduleTarget(null)} className="text-muted hover:text-foreground text-lg leading-none">×</button>
            </div>
            <div className="px-5 py-4 space-y-4">
              <div>
                <label className="block text-[12px] font-semibold text-muted uppercase tracking-wide mb-1.5">New date</label>
                <input type="date" value={rescheduleDate} onChange={(e) => setRescheduleDate(e.target.value)}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground focus:outline-none focus:border-accent" />
              </div>
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="block text-[12px] font-semibold text-muted uppercase tracking-wide mb-1.5">Start time</label>
                  <select value={rescheduleStartHour}
                    onChange={(e) => { const h = Number(e.target.value); setRescheduleStartHour(h); if (rescheduleEndHour <= h) setRescheduleEndHour(h + 1); }}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground focus:outline-none focus:border-accent">
                    {TIME_SLOTS.slice(0, 23).map((s, i) => <option key={i} value={i}>{fmtTime(s.start)}</option>)}
                  </select>
                </div>
                <div className="flex-1">
                  <label className="block text-[12px] font-semibold text-muted uppercase tracking-wide mb-1.5">End time</label>
                  <select value={rescheduleEndHour} onChange={(e) => setRescheduleEndHour(Number(e.target.value))}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground focus:outline-none focus:border-accent">
                    {TIME_SLOTS.slice(rescheduleStartHour + 1).map((s, i) => {
                      const hour = rescheduleStartHour + 1 + i;
                      return <option key={hour} value={hour}>{fmtTime(s.start)}</option>;
                    })}
                  </select>
                </div>
              </div>
              {rescheduleError && <p className="text-sm text-red-600">{rescheduleError}</p>}
            </div>
            <div className="flex gap-2 border-t border-border px-5 py-4">
              <button onClick={() => setRescheduleTarget(null)}
                className="flex-1 rounded-lg border border-border px-3 py-2 text-sm font-semibold text-muted hover:bg-accent/5 transition-colors">
                Cancel
              </button>
              <button
                disabled={rescheduleSubmitting || !rescheduleDate}
                onClick={onRescheduleSubmit}
                className="flex-1 rounded-lg bg-accent px-3 py-2 text-sm font-semibold text-white hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed">
                {rescheduleSubmitting ? "Saving…" : "Confirm reschedule"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
