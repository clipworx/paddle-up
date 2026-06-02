"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Plus, Search, X } from "lucide-react";
import { useLocationAdminContext } from "@/contexts/LocationAdminContext";
import { SubscriptionBanner } from "@/components/SubscriptionBanner";
import type { Court, Booking, BookingStatus } from "@/lib/types";
import { TIME_SLOTS } from "@/lib/types";
import { formatDate, fmtTime, displayDate } from "@/lib/admin-utils";

const PAGE_SIZE = 20;

const STATUS_STYLES: Record<BookingStatus, string> = {
  confirmed:       "bg-green-100 text-green-700",
  pending_payment: "bg-yellow-100 text-yellow-700",
  cancelled:       "bg-gray-100 text-gray-500",
  refunded:        "bg-blue-100 text-blue-600",
};
const STATUS_LABELS: Record<BookingStatus, string> = {
  confirmed:       "Confirmed",
  pending_payment: "Pending",
  cancelled:       "Cancelled",
  refunded:        "Refunded",
};
function StatusBadge({ status }: { status: BookingStatus }) {
  return (
    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-widest ${STATUS_STYLES[status]}`}>
      {STATUS_LABELS[status]}
    </span>
  );
}

export default function BookingsPage() {
  const { me, location } = useLocationAdminContext();
  const today = formatDate(new Date(Date.now() - new Date().getTimezoneOffset() * 60000));

  const [courts, setCourts]                 = useState<Court[] | null>(null);
  const [bookings, setBookings]             = useState<Booking[] | null>(null);
  const [total, setTotal]                   = useState(0);
  const [page, setPage]                     = useState(1);
  const [statusFilter, setStatusFilter]     = useState("");
  const [searchInput, setSearchInput]       = useState("");
  const [search, setSearch]                 = useState("");
  const searchTimer                         = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [cancellingId, setCancellingId]     = useState<string | null>(null);
  const [refundingId, setRefundingId]       = useState<string | null>(null);
  const [confirmingId, setConfirmingId]     = useState<string | null>(null);
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [refundTarget, setRefundTarget]     = useState<string | null>(null);
  const refundReasonRef                     = useRef<HTMLTextAreaElement>(null);

  const [adminBookingForm, setAdminBookingForm] = useState<{
    court_id: string; date: string; start_hour: number; end_hour: number;
    booker_name: string; booker_phone: string; booker_email: string; notes: string;
  } | null>(null);
  const [adminBookingSubmitting, setAdminBookingSubmitting] = useState(false);
  const [adminBookingError, setAdminBookingError]           = useState<string | null>(null);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const loadCourts = useCallback(async (locationId: string) => {
    const res  = await fetch("/api/admin/locations");
    const json = await res.json();
    const loc  = (json.locations ?? []).find((l: { id: string; courts: Court[] }) => l.id === locationId);
    if (loc) setCourts(loc.courts ?? []);
  }, []);

  const loadBookings = useCallback(async (p: number, status: string, q: string) => {
    setBookings(null);
    const params = new URLSearchParams({ page: String(p), limit: String(PAGE_SIZE) });
    if (status) params.set("status", status);
    if (q)      params.set("search", q);
    const res  = await fetch(`/api/admin/bookings?${params}`);
    if (res.status === 401 || res.status === 403) return;
    const json = await res.json();
    setBookings(json.bookings ?? []);
    setTotal(json.total ?? 0);
  }, []);

  useEffect(() => {
    if (me?.location_id) loadCourts(me.location_id);
  }, [me, loadCourts]);

  useEffect(() => {
    loadBookings(page, statusFilter, search);
  }, [page, statusFilter, search, loadBookings]);

  // Reset to page 1 when filter or search changes
  useEffect(() => { setPage(1); }, [statusFilter, search]);

  // Keep detail modal in sync after reload
  useEffect(() => {
    if (selectedBooking && bookings) {
      setSelectedBooking(bookings.find((b) => b.id === selectedBooking.id) ?? null);
    }
  }, [bookings]); // eslint-disable-line react-hooks/exhaustive-deps

  function courtName(courtId: string) {
    return courts?.find((c) => c.id === courtId)?.name ?? "—";
  }

  function isBookingPast(b: Booking) { return b.date < today; }

  async function onCancelBooking(id: string) {
    if (!confirm("Cancel this booking?")) return;
    setCancellingId(id);
    try {
      const res = await fetch(`/api/admin/bookings/${encodeURIComponent(id)}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Cancel failed");
      setSelectedBooking(null);
      loadBookings(page, statusFilter, search);
    } catch (err) { alert((err as Error).message); }
    finally { setCancellingId(null); }
  }

  async function onRefundConfirm() {
    if (!refundTarget) return;
    const id     = refundTarget;
    const reason = refundReasonRef.current?.value ?? "";
    setRefundTarget(null);
    setRefundingId(id);
    try {
      const res = await fetch(`/api/admin/bookings/${encodeURIComponent(id)}/refund`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
      });
      if (!res.ok) throw new Error("Refund failed");
      setSelectedBooking(null);
      loadBookings(page, statusFilter, search);
    } catch (err) { alert((err as Error).message); }
    finally { setRefundingId(null); }
  }

  async function onConfirmPayment(id: string) {
    setConfirmingId(id);
    try {
      const res = await fetch(`/api/admin/bookings/${encodeURIComponent(id)}/confirm`, { method: "POST" });
      if (!res.ok) throw new Error("Confirm failed");
      loadBookings(page, statusFilter, search);
    } catch (err) { alert((err as Error).message); }
    finally { setConfirmingId(null); }
  }

  return (
    <>
      <main className="mx-auto max-w-4xl w-full px-4 py-6 sm:py-8 space-y-6">
        <SubscriptionBanner location={location} />

        <section className="space-y-4">
          {/* Header */}
          <div className="flex items-center gap-3 flex-wrap">
            <h2 className="text-base font-bold text-foreground flex-1">Bookings</h2>

            {/* Search */}
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
              <input
                type="text"
                value={searchInput}
                onChange={(e) => {
                  const v = e.target.value;
                  setSearchInput(v);
                  if (searchTimer.current) clearTimeout(searchTimer.current);
                  searchTimer.current = setTimeout(() => setSearch(v.trim()), 350);
                }}
                placeholder="Name, phone, email…"
                className="rounded-lg border border-border bg-background pl-8 pr-3 py-1.5 text-sm text-foreground placeholder:text-muted/60 focus:outline-none focus:border-accent w-48"
              />
              {searchInput && (
                <button
                  onClick={() => { setSearchInput(""); setSearch(""); }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted hover:text-foreground"
                >
                  <X size={13} />
                </button>
              )}
            </div>

            {/* Status filter */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="rounded-lg border border-border bg-background px-3 py-1.5 text-sm text-foreground focus:outline-none focus:border-accent"
            >
              <option value="">All statuses</option>
              <option value="confirmed">Confirmed</option>
              <option value="pending_payment">Pending</option>
              <option value="cancelled">Cancelled</option>
              <option value="refunded">Refunded</option>
            </select>

            <button
              onClick={() => {
                const activeCourts = courts?.filter((c) => c.is_active) ?? [];
                setAdminBookingForm({
                  court_id: activeCourts[0]?.id ?? "",
                  date: today,
                  start_hour: location?.open_hour ?? 7,
                  end_hour: (location?.open_hour ?? 7) + 1,
                  booker_name: "", booker_phone: "", booker_email: "", notes: "",
                });
                setAdminBookingError(null);
              }}
              className="flex items-center gap-2 rounded-full bg-accent text-white px-4 py-2 text-[13px] font-semibold hover:opacity-90 transition-opacity"
            >
              <Plus size={14} /> New booking
            </button>
          </div>

          {/* Table */}
          {bookings === null ? (
            <p className="text-sm text-muted">Loading…</p>
          ) : bookings.length === 0 ? (
            <div className="rounded-xl border border-border bg-background p-8 text-center">
              <p className="text-sm text-muted">{search || statusFilter ? "No bookings match your search." : "No bookings yet."}</p>
            </div>
          ) : (
            <div className="overflow-hidden rounded-xl border border-border bg-background shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full min-w-160 text-sm">
                  <thead className="bg-surface">
                    <tr className="text-left">
                      <th className="px-4 py-3 text-xs uppercase tracking-wide text-muted font-semibold">Date</th>
                      <th className="px-4 py-3 text-xs uppercase tracking-wide text-muted font-semibold">Court</th>
                      <th className="px-4 py-3 text-xs uppercase tracking-wide text-muted font-semibold">Time</th>
                      <th className="px-4 py-3 text-xs uppercase tracking-wide text-muted font-semibold">Booker</th>
                      <th className="px-4 py-3 text-xs uppercase tracking-wide text-muted font-semibold">Status</th>
                      <th className="px-4 py-3 text-xs uppercase tracking-wide text-muted font-semibold">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bookings.map((b, i) => {
                      const past = isBookingPast(b);
                      return (
                        <tr
                          key={b.id}
                          className={[
                            i === 0 ? "" : "border-t border-border",
                            b.status === "cancelled" || b.status === "refunded" ? "opacity-50" : "hover:bg-accent/5",
                            "transition-colors",
                          ].join(" ")}
                        >
                          <td className="px-4 py-3 whitespace-nowrap text-foreground">
                            <span className="text-sm font-medium">
                              {new Date(b.date + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                            </span>
                            {b.date === today && (
                              <span className="ml-1.5 rounded-full bg-accent/15 text-accent px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-widest">Today</span>
                            )}
                          </td>
                          <td className="px-4 py-3 font-semibold text-foreground whitespace-nowrap">{courtName(b.court_id)}</td>
                          <td className="px-4 py-3 text-foreground whitespace-nowrap">{fmtTime(b.start_time)} – {fmtTime(b.end_time)}</td>
                          <td className="px-4 py-3">
                            <p className="font-medium text-foreground">{b.booker_name}</p>
                            <p className="text-xs text-muted">{b.booker_phone || "—"}</p>
                          </td>
                          <td className="px-4 py-3">
                            <StatusBadge status={b.status} />
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex gap-2 flex-wrap">
                              <button
                                onClick={() => setSelectedBooking(b)}
                                className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-accent/10 hover:border-accent transition-colors"
                              >
                                View
                              </button>
                              {b.status === "pending_payment" && !past && (
                                <button
                                  onClick={() => onConfirmPayment(b.id)}
                                  disabled={confirmingId === b.id}
                                  className="rounded-lg border border-green-400 bg-green-50 px-3 py-1.5 text-xs font-semibold text-green-700 hover:bg-green-500 hover:text-white transition-colors disabled:opacity-40"
                                >
                                  {confirmingId === b.id ? "…" : "Confirm"}
                                </button>
                              )}
                              {b.status !== "cancelled" && b.status !== "refunded" && !past && (
                                <button
                                  onClick={() => onCancelBooking(b.id)}
                                  disabled={cancellingId === b.id}
                                  className="rounded-lg border border-accent/50 bg-accent/5 px-3 py-1.5 text-xs font-semibold text-accent hover:bg-accent hover:text-background transition-colors disabled:opacity-40"
                                >
                                  {cancellingId === b.id ? "…" : "Cancel"}
                                </button>
                              )}
                              {b.status !== "refunded" && past && (
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

          {/* Pagination */}
          {total > PAGE_SIZE && (
            <div className="flex items-center justify-between gap-4">
              <p className="text-xs text-muted">
                {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)} of {total} bookings
              </p>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="w-8 h-8 rounded-lg border border-border flex items-center justify-center text-foreground hover:bg-accent/10 transition-colors disabled:opacity-40"
                >
                  <ChevronLeft size={15} />
                </button>
                {Array.from({ length: totalPages }, (_, i) => i + 1)
                  .filter((p) => p === 1 || p === totalPages || Math.abs(p - page) <= 1)
                  .reduce<(number | "…")[]>((acc, p, idx, arr) => {
                    if (idx > 0 && (p as number) - (arr[idx - 1] as number) > 1) acc.push("…");
                    acc.push(p);
                    return acc;
                  }, [])
                  .map((p, idx) =>
                    p === "…" ? (
                      <span key={`e${idx}`} className="w-8 text-center text-xs text-muted">…</span>
                    ) : (
                      <button
                        key={p}
                        onClick={() => setPage(p as number)}
                        className={`w-8 h-8 rounded-lg text-xs font-semibold transition-colors ${
                          page === p ? "bg-accent text-white" : "border border-border text-foreground hover:bg-accent/10"
                        }`}
                      >
                        {p}
                      </button>
                    )
                  )}
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="w-8 h-8 rounded-lg border border-border flex items-center justify-center text-foreground hover:bg-accent/10 transition-colors disabled:opacity-40"
                >
                  <ChevronRight size={15} />
                </button>
              </div>
            </div>
          )}
        </section>
      </main>

      {/* ── New booking modal ── */}
      {adminBookingForm && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm px-0 sm:px-4 py-0 sm:py-6"
          onClick={() => setAdminBookingForm(null)}
        >
          <div
            className="w-full max-w-lg rounded-t-2xl sm:rounded-2xl border border-border bg-background shadow-xl overflow-hidden max-h-[90vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6 overflow-y-auto space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-[17px] font-bold text-foreground">New booking</h3>
                <button onClick={() => setAdminBookingForm(null)} className="w-9 h-9 rounded-full border border-border flex items-center justify-center text-muted hover:bg-surface">
                  <X size={16} />
                </button>
              </div>
              <div className="space-y-3">
                <div>
                  <label className="block text-[12px] font-semibold text-muted uppercase tracking-wide mb-1.5">Court</label>
                  <select value={adminBookingForm.court_id} onChange={(e) => setAdminBookingForm((f) => f && ({ ...f, court_id: e.target.value }))}
                    className="w-full rounded-xl border border-border bg-surface px-4 py-2.5 text-base sm:text-[14px] text-foreground focus:outline-none focus:border-accent">
                    {(courts ?? []).filter((c) => c.is_active).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[12px] font-semibold text-muted uppercase tracking-wide mb-1.5">Date</label>
                  <input type="date" value={adminBookingForm.date} onChange={(e) => setAdminBookingForm((f) => f && ({ ...f, date: e.target.value }))}
                    className="w-full rounded-xl border border-border bg-surface px-4 py-2.5 text-base sm:text-[14px] text-foreground focus:outline-none focus:border-accent" />
                </div>
                <div className="flex flex-col sm:flex-row gap-3">
                  <div className="flex-1">
                    <label className="block text-[12px] font-semibold text-muted uppercase tracking-wide mb-1.5">Start time</label>
                    <select value={adminBookingForm.start_hour}
                      onChange={(e) => { const h = Number(e.target.value); setAdminBookingForm((f) => f && ({ ...f, start_hour: h, end_hour: Math.max(f.end_hour, h + 1) })); }}
                      className="w-full rounded-xl border border-border bg-surface px-4 py-2.5 text-base sm:text-[14px] text-foreground focus:outline-none focus:border-accent">
                      {TIME_SLOTS.slice(0, 23).map((s, i) => <option key={i} value={i}>{fmtTime(s.start + ":00")}</option>)}
                    </select>
                  </div>
                  <div className="flex-1">
                    <label className="block text-[12px] font-semibold text-muted uppercase tracking-wide mb-1.5">End time</label>
                    <select value={adminBookingForm.end_hour} onChange={(e) => setAdminBookingForm((f) => f && ({ ...f, end_hour: Number(e.target.value) }))}
                      className="w-full rounded-xl border border-border bg-surface px-4 py-2.5 text-base sm:text-[14px] text-foreground focus:outline-none focus:border-accent">
                      {TIME_SLOTS.slice(adminBookingForm.start_hour + 1).map((s, i) => {
                        const hour = adminBookingForm.start_hour + 1 + i;
                        return <option key={hour} value={hour}>{fmtTime(s.start + ":00")}</option>;
                      })}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-[12px] font-semibold text-muted uppercase tracking-wide mb-1.5">Name</label>
                  <input type="text" value={adminBookingForm.booker_name} onChange={(e) => setAdminBookingForm((f) => f && ({ ...f, booker_name: e.target.value }))} placeholder="Booker's full name"
                    className="w-full rounded-xl border border-border bg-surface px-4 py-2.5 text-base sm:text-[14px] text-foreground placeholder:text-muted/60 focus:outline-none focus:border-accent" />
                </div>
                <div>
                  <label className="block text-[12px] font-semibold text-muted uppercase tracking-wide mb-1.5">Phone</label>
                  <input type="tel" value={adminBookingForm.booker_phone} onChange={(e) => setAdminBookingForm((f) => f && ({ ...f, booker_phone: e.target.value }))} placeholder="+63 9XX XXX XXXX"
                    className="w-full rounded-xl border border-border bg-surface px-4 py-2.5 text-base sm:text-[14px] text-foreground placeholder:text-muted/60 focus:outline-none focus:border-accent" />
                </div>
                <div>
                  <label className="block text-[12px] font-semibold text-muted uppercase tracking-wide mb-1.5">Email <span className="normal-case font-normal">(optional)</span></label>
                  <input type="email" value={adminBookingForm.booker_email} onChange={(e) => setAdminBookingForm((f) => f && ({ ...f, booker_email: e.target.value }))} placeholder="email@example.com"
                    className="w-full rounded-xl border border-border bg-surface px-4 py-2.5 text-base sm:text-[14px] text-foreground placeholder:text-muted/60 focus:outline-none focus:border-accent" />
                </div>
                <div>
                  <label className="block text-[12px] font-semibold text-muted uppercase tracking-wide mb-1.5">Notes <span className="normal-case font-normal">(optional)</span></label>
                  <textarea rows={2} value={adminBookingForm.notes} onChange={(e) => setAdminBookingForm((f) => f && ({ ...f, notes: e.target.value }))} placeholder="Any additional info…"
                    className="w-full rounded-xl border border-border bg-surface px-4 py-2.5 text-base sm:text-[14px] text-foreground placeholder:text-muted/60 focus:outline-none focus:border-accent resize-none" />
                </div>
                {adminBookingError && <p className="text-sm text-red-600">{adminBookingError}</p>}
              </div>
              <div className="flex gap-2.5 pt-1">
                <button onClick={() => setAdminBookingForm(null)}
                  className="rounded-full border border-border px-5 py-2.5 text-[14px] font-semibold text-foreground hover:bg-surface transition-colors">
                  Cancel
                </button>
                <button
                  disabled={adminBookingSubmitting || !adminBookingForm.court_id || !adminBookingForm.booker_name.trim() || !adminBookingForm.booker_phone.trim()}
                  onClick={async () => {
                    setAdminBookingSubmitting(true);
                    setAdminBookingError(null);
                    try {
                      const pad = (n: number) => String(n).padStart(2, "0");
                      const res = await fetch("/api/admin/bookings", {
                        method: "POST",
                        headers: { "content-type": "application/json" },
                        body: JSON.stringify({
                          court_id: adminBookingForm.court_id,
                          date: adminBookingForm.date,
                          start_time: `${pad(adminBookingForm.start_hour)}:00`,
                          end_time: `${pad(adminBookingForm.end_hour)}:00`,
                          booker_name: adminBookingForm.booker_name,
                          booker_phone: adminBookingForm.booker_phone,
                          booker_email: adminBookingForm.booker_email || null,
                          notes: adminBookingForm.notes || null,
                        }),
                      });
                      const json = await res.json().catch(() => ({}));
                      if (!res.ok) {
                        const msg: Record<string, string> = { slot_taken: "That time slot is already booked.", missing_fields: "Please fill in all required fields." };
                        throw new Error(msg[json.error] ?? json.error ?? "Failed to create booking");
                      }
                      setAdminBookingForm(null);
                      setPage(1);
                      loadBookings(1, statusFilter, search);
                    } catch (err) {
                      setAdminBookingError((err as Error).message);
                    } finally {
                      setAdminBookingSubmitting(false);
                    }
                  }}
                  className="flex-1 rounded-full bg-accent text-white px-5 py-2.5 text-[14px] font-semibold hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {adminBookingSubmitting ? "Saving…" : "Confirm booking"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Booking detail modal ── */}
      {selectedBooking && (() => {
        const past = isBookingPast(selectedBooking);
        return (
          <div
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm px-0 sm:px-4"
            onClick={() => setSelectedBooking(null)}
          >
            <div className="w-full max-w-md max-h-[90vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl border border-border bg-background shadow-xl"
              onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between border-b border-border px-5 py-4">
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-bold text-foreground">Booking</h2>
                  <StatusBadge status={selectedBooking.status} />
                </div>
                <button onClick={() => setSelectedBooking(null)} className="text-muted hover:text-foreground text-lg leading-none">×</button>
              </div>
              <div className="px-5 py-4 space-y-3">
                {[
                  { label: "Court", value: courtName(selectedBooking.court_id) },
                  { label: "Date",  value: displayDate(selectedBooking.date) },
                  { label: "Time",  value: `${fmtTime(selectedBooking.start_time)} – ${fmtTime(selectedBooking.end_time)}` },
                  { label: "Booker", value: selectedBooking.booker_name },
                  { label: "Phone",  value: selectedBooking.booker_phone || "—" },
                  { label: "Email",  value: selectedBooking.booker_email ?? "—" },
                  { label: "Notes",  value: selectedBooking.notes ?? "—" },
                ].map(({ label, value }) => (
                  <div key={label} className="flex gap-3">
                    <span className="w-20 shrink-0 text-xs text-muted font-semibold uppercase tracking-wide pt-0.5">{label}</span>
                    <span className="text-sm text-foreground">{value}</span>
                  </div>
                ))}
                {selectedBooking.status === "refunded" && (
                  <div className="flex gap-3 border-t border-border pt-3">
                    <span className="w-20 shrink-0 text-xs text-muted font-semibold uppercase tracking-wide pt-0.5">Refund reason</span>
                    <span className="text-sm text-foreground">{selectedBooking.refund_reason ?? "—"}</span>
                  </div>
                )}
              </div>
              {selectedBooking.status !== "cancelled" && selectedBooking.status !== "refunded" && (
                <div className="flex gap-2 border-t border-border px-5 py-4">
                  {selectedBooking.status === "pending_payment" && !past && (
                    <button onClick={() => onConfirmPayment(selectedBooking.id)} disabled={confirmingId === selectedBooking.id}
                      className="flex-1 rounded-lg border border-green-400 bg-green-50 px-3 py-2 text-sm font-semibold text-green-700 hover:bg-green-500 hover:text-white transition-colors disabled:opacity-40">
                      {confirmingId === selectedBooking.id ? "Confirming…" : "Confirm Payment"}
                    </button>
                  )}
                  {!past && (
                    <button onClick={() => onCancelBooking(selectedBooking.id)} disabled={cancellingId === selectedBooking.id}
                      className="flex-1 rounded-lg border border-accent/50 bg-accent/5 px-3 py-2 text-sm font-semibold text-accent hover:bg-accent hover:text-background transition-colors disabled:opacity-40">
                      {cancellingId === selectedBooking.id ? "Cancelling…" : "Cancel Booking"}
                    </button>
                  )}
                  {past && (
                    <button onClick={() => { setSelectedBooking(null); setRefundTarget(selectedBooking.id); }} disabled={refundingId === selectedBooking.id}
                      className="flex-1 rounded-lg border border-blue-400 bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-600 hover:text-white transition-colors disabled:opacity-40">
                      {refundingId === selectedBooking.id ? "Processing…" : "Mark as Refunded"}
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        );
      })()}

      {/* ── Refund reason dialog ── */}
      {refundTarget && (
        <div className="fixed inset-0 z-60 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm px-0 sm:px-4"
          onClick={() => setRefundTarget(null)}>
          <div className="w-full max-w-sm rounded-t-2xl sm:rounded-2xl border border-border bg-background shadow-xl"
            onClick={(e) => e.stopPropagation()}>
            <div className="border-b border-border px-5 py-4">
              <h3 className="text-base font-bold text-foreground">Mark as Refunded</h3>
              <p className="text-xs text-muted mt-1">Provide a reason (optional).</p>
            </div>
            <div className="px-5 py-4">
              <textarea ref={refundReasonRef} placeholder="e.g. Court unavailable, player requested cancellation…" rows={3}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-base sm:text-sm text-foreground placeholder:text-muted/50 focus:outline-none focus:border-accent resize-none" />
            </div>
            <div className="flex gap-2 border-t border-border px-5 py-4">
              <button onClick={() => setRefundTarget(null)}
                className="flex-1 rounded-lg border border-border px-3 py-2 text-sm font-semibold text-muted hover:bg-accent/5 transition-colors">Cancel</button>
              <button onClick={onRefundConfirm}
                className="flex-1 rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700 transition-colors">Mark Refunded</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
