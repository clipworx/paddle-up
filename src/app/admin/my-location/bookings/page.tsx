"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { Ban, ChevronLeft, ChevronRight, LayoutGrid, List, Plus, RefreshCw, X } from "lucide-react";
import { useLocationAdminContext } from "@/contexts/LocationAdminContext";
import { SubscriptionBanner } from "@/components/SubscriptionBanner";
import type { Court, Booking, BookingStatus, CourtBlock } from "@/lib/types";
import { TIME_SLOTS, HALF_HOUR_SLOTS } from "@/lib/types";
import { formatDate, fmtTime, displayDate, displayMonth, ALL_HOURS_24, CLOSE_HOURS } from "@/lib/admin-utils";

function normEnd(t: string): string {
  return t === "00:00" ? "24:00" : t;
}

function fmtSlotTime(hhmm: string): string {
  const [h, m] = hhmm.split(":").map(Number);
  const period = h < 12 ? "AM" : "PM";
  const hour = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${hour}:${String(m).padStart(2, "0")} ${period}`;
}

const STATUS_STYLES: Record<BookingStatus, string> = {
  confirmed:             "bg-green-100 text-green-700",
  pending_payment:       "bg-yellow-100 text-yellow-700",
  pending_confirmation:  "bg-violet-100 text-violet-700",
  cancelled:             "bg-gray-100 text-gray-500",
  refunded:              "bg-blue-100 text-blue-600",
};
const STATUS_LABELS: Record<BookingStatus, string> = {
  confirmed:             "Confirmed",
  pending_payment:       "Pending",
  pending_confirmation:  "Awaiting Review",
  cancelled:             "Cancelled",
  refunded:              "Refunded",
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
  const today = formatDate(new Date());

  const [date, setDate] = useState(today);
  const [month, setMonth] = useState(today.slice(0, 7));
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [courts, setCourts]     = useState<Court[] | null>(null);
  const [courtPage, setCourtPage] = useState(0);
  const [bookings, setBookings] = useState<Booking[] | null>(null);
  const [monthBookings, setMonthBookings] = useState<Booking[] | null>(null);
  const [blocks, setBlocks]     = useState<CourtBlock[] | null>(null);
  const [nowTop, setNowTop]     = useState<number | null>(null);

  const [cancellingId, setCancellingId]   = useState<string | null>(null);
  const [refundingId, setRefundingId]     = useState<string | null>(null);
  const [confirmingId, setConfirmingId]   = useState<string | null>(null);
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [refundTarget, setRefundTarget]   = useState<string | null>(null);

  const [adminBookingForm, setAdminBookingForm] = useState<{
    court_id: string; date: string; start_hour: number; end_hour: number;
    booker_name: string; booker_phone: string; booker_email: string; notes: string;
  } | null>(null);
  const [adminBookingSubmitting, setAdminBookingSubmitting] = useState(false);
  const [adminBookingError, setAdminBookingError]           = useState<string | null>(null);

  const [rescheduleTarget, setRescheduleTarget]       = useState<Booking | null>(null);
  const [rescheduleDate, setRescheduleDate]           = useState("");
  const [rescheduleStartHour, setRescheduleStartHour] = useState(0);
  const [rescheduleEndHour, setRescheduleEndHour]     = useState(1);
  const [rescheduleSubmitting, setRescheduleSubmitting] = useState(false);
  const [rescheduleError, setRescheduleError]           = useState<string | null>(null);

  const [listSearch, setListSearch]             = useState("");
  const [listStatusFilter, setListStatusFilter] = useState<BookingStatus | "all">("all");
  const [listPage, setListPage]                 = useState(0);

  const [blockForm, setBlockForm] = useState<{
    court_ids: string[]; all_courts: boolean;
    start_date: string; end_date: string; start_hour: number; end_hour: number; reason: string;
    is_open_play: boolean;
  } | null>(null);
  const [blockSubmitting, setBlockSubmitting] = useState(false);
  const [blockError, setBlockError]           = useState<string | null>(null);
  const [blockConflicts, setBlockConflicts]   = useState<{ court_name: string; date: string; start_time: string; end_time: string; booker_name: string }[] | null>(null);
  const [removeBlockTarget, setRemoveBlockTarget] = useState<CourtBlock | null>(null);
  const [removingBlock, setRemovingBlock]         = useState(false);

  const tbodyRef       = useRef<HTMLTableSectionElement>(null);
  const refundReasonRef = useRef<HTMLTextAreaElement>(null);

  // ── Load courts ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!me?.location_id) return;
    fetch("/api/admin/locations")
      .then((r) => r.json())
      .then((j) => {
        const loc = (j.locations ?? []).find((l: { id: string; courts: Court[] }) => l.id === me.location_id);
        if (loc) {
          const sorted = (loc.courts ?? []).sort((a: Court, b: Court) =>
            a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: "base" })
          );
          setCourts(sorted);
          setCourtPage(0);
        }
      });
  }, [me]);

  // ── Load bookings for selected date (grid view) ──────────────────────────
  const loadBookings = useCallback(async (d: string) => {
    setBookings(null);
    const res = await fetch(`/api/admin/bookings?date=${d}&limit=200`);
    if (res.status === 401 || res.status === 403) return;
    const json = await res.json();
    setBookings(json.bookings ?? []);
  }, []);

  // ── Load bookings for selected month (list view) ─────────────────────────
  const loadMonthBookings = useCallback(async (m: string) => {
    setMonthBookings(null);
    const res = await fetch(`/api/admin/bookings?month=${m}&limit=500`);
    if (res.status === 401 || res.status === 403) return;
    const json = await res.json();
    setMonthBookings(json.bookings ?? []);
  }, []);

  const loadBlocks = useCallback(async (d: string) => {
    const res = await fetch(`/api/court-blocks?date=${d}`);
    if (!res.ok) return;
    const json = await res.json();
    setBlocks(json.blocks ?? []);
  }, []);

  useEffect(() => { loadBookings(date); loadBlocks(date); }, [date, loadBookings, loadBlocks]);
  useEffect(() => { loadMonthBookings(month); }, [month, loadMonthBookings]);

  // Keep detail modal in sync after reload
  useEffect(() => {
    if (!selectedBooking) return;
    const updated = bookings?.find((b) => b.id === selectedBooking.id)
      ?? monthBookings?.find((b) => b.id === selectedBooking.id);
    if (bookings || monthBookings) setSelectedBooking(updated ?? null);
  }, [bookings, monthBookings]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Derived grid values ──────────────────────────────────────────────────
  const weekend = (() => { const d = new Date(date + "T12:00:00").getDay(); return d === 0 || d === 6; })();
  const openH   = location ? (weekend ? location.weekend_open_hour  : location.open_hour)  : 7;
  const closeH  = location ? (weekend ? location.weekend_close_hour : location.close_hour) : 22;
  const nightHour = parseInt(
    ((weekend ? location?.weekend_night_start_time : location?.night_start_time) ?? "18:00").slice(0, 2), 10
  );
  const hasPricing = (location?.day_rate ?? 0) > 0 || (location?.night_rate ?? 0) > 0;
  const halfHour    = location?.allow_half_hour_bookings ?? false;
  const slots       = halfHour ? HALF_HOUR_SLOTS : TIME_SLOTS;
  const slotsPerHour = halfHour ? 2 : 1;

  const visibleSlotIndices = Array.from(
    { length: (closeH - openH) * slotsPerHour },
    (_, k) => openH * slotsPerHour + k
  );

  type SlotSpan = { booking: Booking; rowSpan: number; isStart: boolean };
  const bookingSpanMap = new Map<string, Map<number, SlotSpan>>();
  (courts ?? []).forEach((court) => {
    const slotMap = new Map<number, SlotSpan>();
    (bookings ?? []).forEach((b) => {
      if (b.court_id !== court.id) return;
      if (b.status !== "confirmed" && b.status !== "pending_payment" && b.status !== "pending_confirmation") return;
      const bStart = b.start_time.slice(0, 5);
      const bEnd   = normEnd(b.end_time.slice(0, 5));
      const covered = visibleSlotIndices.filter((idx) => {
        const s = slots[idx];
        return s.start < bEnd && normEnd(s.end) > bStart;
      });
      if (!covered.length) return;
      covered.forEach((idx, i) =>
        slotMap.set(idx, { booking: b, rowSpan: covered.length, isStart: i === 0 })
      );
    });
    bookingSpanMap.set(court.id, slotMap);
  });

  // Blocked slots — only surfaced where no real booking already occupies the cell.
  type BlockSpan = { block: CourtBlock; rowSpan: number; isStart: boolean };
  const blockSpanMap = new Map<string, Map<number, BlockSpan>>();
  (courts ?? []).forEach((court) => {
    const slotMap = new Map<number, BlockSpan>();
    (blocks ?? []).forEach((blk) => {
      if (blk.court_id !== court.id) return;
      const blkStart = blk.start_time.slice(0, 5);
      const blkEnd   = normEnd(blk.end_time.slice(0, 5));
      const covered = visibleSlotIndices.filter((idx) => {
        if (bookingSpanMap.get(court.id)?.has(idx)) return false;
        const s = slots[idx];
        return s.start < blkEnd && normEnd(s.end) > blkStart;
      });
      if (!covered.length) return;
      covered.forEach((idx, i) =>
        slotMap.set(idx, { block: blk, rowSpan: covered.length, isStart: i === 0 })
      );
    });
    blockSpanMap.set(court.id, slotMap);
  });

  // ── Now indicator ─────────────────────────────────────────────────────────
  useEffect(() => {
    function update() {
      if (!tbodyRef.current || date !== today) { setNowTop(null); return; }
      const now = new Date();
      const h = now.getHours(), m = now.getMinutes();
      if (h < openH || h >= closeH) { setNowTop(null); return; }
      const totalMins = (h - openH) * 60 + m;
      const rowIdx   = halfHour ? Math.floor(totalMins / 30) : h - openH;
      const fraction = halfHour ? (totalMins % 30) / 30 : m / 60;
      const rows = tbodyRef.current.querySelectorAll("tr");
      if (rowIdx >= rows.length) { setNowTop(null); return; }
      const row    = rows[rowIdx] as HTMLTableRowElement;
      const tbodyT = tbodyRef.current.getBoundingClientRect().top;
      const rowT   = row.getBoundingClientRect().top - tbodyT;
      setNowTop(rowT + row.offsetHeight * fraction);
    }
    update();
    const id = setInterval(update, 30000);
    return () => clearInterval(id);
  }, [date, today, openH, closeH, halfHour]);

  // ── Helpers ──────────────────────────────────────────────────────────────
  function courtName(courtId: string) {
    return (courts ?? []).find((c) => c.id === courtId)?.name ?? "—";
  }
  function isBookingPast(b: Booking) { return b.date < today; }
  function isSlotPast(slotIdx: number): boolean {
    if (date < today) return true;
    if (date > today) return false;
    const slot = slots[slotIdx];
    const [h, m] = slot.start.split(":").map(Number);
    const now = new Date();
    return now.getHours() > h || (now.getHours() === h && now.getMinutes() >= m);
  }

  function prevDay() {
    const d = new Date(date + "T12:00:00");
    d.setDate(d.getDate() - 1);
    setDate(formatDate(d));
  }
  function nextDay() {
    const d = new Date(date + "T12:00:00");
    d.setDate(d.getDate() + 1);
    setDate(formatDate(d));
  }

  function prevMonth() {
    const [y, m] = month.split("-").map(Number);
    const d = new Date(y, m - 2, 1);
    setMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
    setListPage(0);
  }
  function nextMonth() {
    const [y, m] = month.split("-").map(Number);
    const d = new Date(y, m, 1);
    setMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
    setListPage(0);
  }

  function openNewBooking(courtId?: string, slotIdx?: number, dateOverride?: string) {
    const activeCourts = (courts ?? []).filter((c) => c.is_active);
    let startH = location?.open_hour ?? 7;
    let endH   = startH + 1;
    if (slotIdx !== undefined) {
      startH = parseInt(slots[slotIdx].start.slice(0, 2), 10);
      endH   = Math.min(startH + 1, closeH);
    }
    setAdminBookingForm({
      court_id: courtId ?? activeCourts[0]?.id ?? "",
      date: dateOverride ?? date,
      start_hour: startH,
      end_hour: endH,
      booker_name: "", booker_phone: "", booker_email: "", notes: "",
    });
    setAdminBookingError(null);
  }

  function openBlockModal() {
    setBlockForm({
      court_ids: [], all_courts: true,
      start_date: date, end_date: date,
      start_hour: location?.open_hour ?? 7, end_hour: (location?.open_hour ?? 7) + 1,
      reason: "",
      is_open_play: false,
    });
    setBlockError(null);
    setBlockConflicts(null);
  }

  async function onRemoveBlock() {
    if (!removeBlockTarget) return;
    setRemovingBlock(true);
    try {
      const res = await fetch(`/api/admin/court-blocks/${encodeURIComponent(removeBlockTarget.id)}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to remove block");
      setRemoveBlockTarget(null);
      loadBlocks(date);
    } catch (err) { alert((err as Error).message); }
    finally { setRemovingBlock(false); }
  }

  // ── Actions ──────────────────────────────────────────────────────────────
  async function onCancelBooking(id: string) {
    if (!confirm("Cancel this booking?")) return;
    setCancellingId(id);
    try {
      const res = await fetch(`/api/admin/bookings/${encodeURIComponent(id)}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Cancel failed");
      setSelectedBooking(null);
      loadBookings(date);
      loadMonthBookings(month);
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
      loadBookings(date);
      loadMonthBookings(month);
    } catch (err) { alert((err as Error).message); }
    finally { setRefundingId(null); }
  }

  async function onConfirmPayment(id: string) {
    setConfirmingId(id);
    try {
      const res = await fetch(`/api/admin/bookings/${encodeURIComponent(id)}/confirm`, { method: "POST" });
      if (!res.ok) throw new Error("Confirm failed");
      loadBookings(date);
      loadMonthBookings(month);
    } catch (err) { alert((err as Error).message); }
    finally { setConfirmingId(null); }
  }

  function openReschedule(b: Booking) {
    setRescheduleTarget(b);
    setRescheduleDate(b.date);
    setRescheduleStartHour(parseInt(b.start_time.split(":")[0], 10));
    setRescheduleEndHour(parseInt(b.end_time.split(":")[0], 10));
    setRescheduleError(null);
    setSelectedBooking(null);
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
          end_time: rescheduleEndHour === 24 ? "00:00" : `${pad(rescheduleEndHour)}:00`,
        }),
      });
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
      loadBookings(date);
      loadMonthBookings(month);
    } catch (err) {
      setRescheduleError((err as Error).message);
    } finally {
      setRescheduleSubmitting(false);
    }
  }

  const activeCourts = (courts ?? []).filter((c) => c.is_active);

  const PAGE_SIZE = 5;
  const allCourts = courts ?? [];
  const totalPages = Math.ceil(allCourts.length / PAGE_SIZE);
  const visibleCourts = allCourts.length > 5
    ? allCourts.slice(courtPage * PAGE_SIZE, (courtPage + 1) * PAGE_SIZE)
    : allCourts;

  const pageButtons: (number | "...")[] = (() => {
    if (totalPages <= 4) return Array.from({ length: totalPages }, (_, i) => i);
    const visible = new Set<number>([0, totalPages - 1, courtPage]);
    if (courtPage > 0) visible.add(courtPage - 1);
    if (courtPage < totalPages - 1) visible.add(courtPage + 1);
    const sorted = [...visible].sort((a, b) => a - b).slice(0, 4);
    const result: (number | "...")[] = [];
    sorted.forEach((p, idx) => {
      if (idx > 0 && p - sorted[idx - 1] > 1) result.push("...");
      result.push(p);
    });
    if (sorted[sorted.length - 1] < totalPages - 1) result.push("...", totalPages - 1);
    return result;
  })();

  const courtPaginator = allCourts.length > 5 ? (
    <div className="flex flex-wrap items-center gap-2">
      <button
        onClick={() => setCourtPage((p) => Math.max(0, p - 1))}
        disabled={courtPage === 0}
        className="rounded-lg border border-border w-8 h-8 flex items-center justify-center font-bold text-muted hover:text-foreground hover:border-accent disabled:opacity-30 transition-colors"
      >‹</button>
      {pageButtons.map((item, idx) =>
        item === "..." ? (
          <span key={`ellipsis-${idx}`} className="text-muted px-1 text-sm font-semibold">…</span>
        ) : (
          <button
            key={item}
            onClick={() => setCourtPage(item)}
            className={`rounded-lg border px-2.5 h-8 text-sm font-semibold transition-colors whitespace-nowrap ${
              courtPage === item
                ? "border-accent bg-accent text-white"
                : "border-border text-muted hover:text-foreground hover:border-accent"
            }`}
          >
            {(() => { const s = allCourts.slice(item * PAGE_SIZE, (item + 1) * PAGE_SIZE); return `${s[0]?.name} – ${s[s.length - 1]?.name}`; })()}
          </button>
        )
      )}
      <button
        onClick={() => setCourtPage((p) => Math.min(totalPages - 1, p + 1))}
        disabled={courtPage === totalPages - 1}
        className="rounded-lg border border-border w-8 h-8 flex items-center justify-center font-bold text-muted hover:text-foreground hover:border-accent disabled:opacity-30 transition-colors"
      >›</button>
      <select
        value={courtPage}
        onChange={(e) => setCourtPage(Number(e.target.value))}
        className="rounded-lg border border-border bg-background px-3 h-8 text-sm text-foreground focus:outline-none focus:border-accent"
      >
        {Array.from({ length: totalPages }, (_, i) => {
          const slice = allCourts.slice(i * PAGE_SIZE, (i + 1) * PAGE_SIZE);
          return <option key={i} value={i}>{slice[0]?.name} – {slice[slice.length - 1]?.name}</option>;
        })}
      </select>
    </div>
  ) : null;

  return (
    <>
      <main className="mx-auto max-w-6xl w-full px-4 py-6 sm:py-8 space-y-6">
        <SubscriptionBanner location={location} />

        {/* ── Date nav + New booking ── */}
        <div className="rounded-2xl border border-border bg-background shadow-sm px-4 sm:px-5 py-3.5 flex flex-wrap items-center gap-3">
          <button
            onClick={() => openNewBooking()}
            disabled={!courts || activeCourts.length === 0}
            className="rounded-lg bg-accent text-background px-5 py-2 text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-40 shrink-0 shadow-sm flex items-center gap-1.5"
          >
            <Plus size={14} /> New booking
          </button>

          <button
            onClick={openBlockModal}
            disabled={!courts || courts.length === 0}
            className="rounded-lg border border-border px-4 py-2 text-sm font-semibold text-foreground hover:bg-surface transition-colors disabled:opacity-40 shrink-0 flex items-center gap-1.5"
          >
            <Ban size={14} /> Block time
          </button>

          <div className="flex-1" />

          {/* View toggle */}
          <div className="flex items-center rounded-lg border border-border overflow-hidden shrink-0">
            <button
              onClick={() => setViewMode("grid")}
              title="Grid view"
              className={`w-8 h-8 flex items-center justify-center transition-colors ${viewMode === "grid" ? "bg-accent text-white" : "text-muted hover:text-foreground hover:bg-surface"}`}
            >
              <LayoutGrid size={14} />
            </button>
            <button
              onClick={() => setViewMode("list")}
              title="List view"
              className={`w-8 h-8 flex items-center justify-center transition-colors border-l border-border ${viewMode === "list" ? "bg-accent text-white" : "text-muted hover:text-foreground hover:bg-surface"}`}
            >
              <List size={14} />
            </button>
          </div>

          {viewMode === "grid" ? (
            <>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={prevDay}
                  className="rounded-lg border border-border w-8 h-8 flex items-center justify-center text-muted hover:text-foreground hover:border-accent hover:bg-accent/5 transition-colors"
                >
                  <ChevronLeft size={15} />
                </button>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="rounded-lg border border-border bg-background px-3 py-1.5 text-sm text-foreground focus:outline-none focus:border-accent"
                />
                <button
                  onClick={nextDay}
                  className="rounded-lg border border-border w-8 h-8 flex items-center justify-center text-muted hover:text-foreground hover:border-accent hover:bg-accent/5 transition-colors"
                >
                  <ChevronRight size={15} />
                </button>
              </div>

              <div className="hidden md:flex items-center gap-2">
                <span className="text-sm text-muted">{displayDate(date)}</span>
                {date === today && (
                  <span className="rounded-full bg-accent/15 text-accent px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-widest">
                    Today
                  </span>
                )}
              </div>
            </>
          ) : (
            <>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={prevMonth}
                  className="rounded-lg border border-border w-8 h-8 flex items-center justify-center text-muted hover:text-foreground hover:border-accent hover:bg-accent/5 transition-colors"
                >
                  <ChevronLeft size={15} />
                </button>
                <input
                  type="month"
                  value={month}
                  onChange={(e) => { setMonth(e.target.value); setListPage(0); }}
                  className="rounded-lg border border-border bg-background px-3 py-1.5 text-sm text-foreground focus:outline-none focus:border-accent"
                />
                <button
                  onClick={nextMonth}
                  className="rounded-lg border border-border w-8 h-8 flex items-center justify-center text-muted hover:text-foreground hover:border-accent hover:bg-accent/5 transition-colors"
                >
                  <ChevronRight size={15} />
                </button>
              </div>

              <div className="hidden md:flex items-center gap-2">
                <span className="text-sm text-muted">{displayMonth(month)}</span>
                {month === today.slice(0, 7) && (
                  <span className="rounded-full bg-accent/15 text-accent px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-widest">
                    This month
                  </span>
                )}
              </div>
            </>
          )}
        </div>

        {/* ── Content ── */}
        {(viewMode === "list" ? monthBookings === null : bookings === null) || courts === null ? (
          <p className="text-sm text-muted py-8 text-center">Loading…</p>
        ) : courts.length === 0 ? (
          <div className="rounded-xl border border-border bg-background p-8 text-center shadow-sm">
            <p className="text-sm text-muted">No spaces at this location.</p>
          </div>
        ) : viewMode === "list" ? (
          /* ── List view ── */
          (() => {
            const q = listSearch.trim().toLowerCase();
            const filtered = (monthBookings ?? [])
              .filter((b) => b.status === "confirmed" || b.status === "pending_payment" || b.status === "pending_confirmation" || b.status === "cancelled" || b.status === "refunded")
              .filter((b) => listStatusFilter === "all" || b.status === listStatusFilter)
              .filter((b) => !q || b.booker_name.toLowerCase().includes(q) || courtName(b.court_id).toLowerCase().includes(q))
              .sort((a, b) => {
                const pendingA = (a.status === "pending_payment" || a.status === "pending_confirmation") ? 0 : 1;
                const pendingB = (b.status === "pending_payment" || b.status === "pending_confirmation") ? 0 : 1;
                if (pendingA !== pendingB) return pendingA - pendingB;
                return a.date.localeCompare(b.date) || a.start_time.localeCompare(b.start_time) || courtName(a.court_id).localeCompare(courtName(b.court_id));
              });
            const LIST_PAGE_SIZE = 10;
            const listTotalPages = Math.ceil(filtered.length / LIST_PAGE_SIZE);
            const safePage = Math.min(listPage, Math.max(0, listTotalPages - 1));
            const activeBookings = filtered.slice(safePage * LIST_PAGE_SIZE, (safePage + 1) * LIST_PAGE_SIZE);

            const listPaginator = filtered.length > LIST_PAGE_SIZE ? (
              <div className="flex justify-center items-center gap-1.5 flex-wrap">
                <button onClick={() => setListPage((p) => Math.max(0, p - 1))} disabled={safePage === 0}
                  className="rounded-lg border border-border w-8 h-8 flex items-center justify-center font-bold text-muted hover:text-foreground hover:border-accent disabled:opacity-30 transition-colors">‹</button>
                {Array.from({ length: listTotalPages }, (_, i) => (
                  <button key={i} onClick={() => setListPage(i)}
                    className={`rounded-lg border px-2.5 h-8 text-sm font-semibold transition-colors ${safePage === i ? "border-accent bg-accent text-white" : "border-border text-muted hover:text-foreground hover:border-accent"}`}>
                    {i + 1}
                  </button>
                ))}
                <button onClick={() => setListPage((p) => Math.min(listTotalPages - 1, p + 1))} disabled={safePage === listTotalPages - 1}
                  className="rounded-lg border border-border w-8 h-8 flex items-center justify-center font-bold text-muted hover:text-foreground hover:border-accent disabled:opacity-30 transition-colors">›</button>
              </div>
            ) : null;

            return (
              <div className="space-y-3">
                {/* Search + filter bar */}
                <div className="flex flex-wrap gap-2">
                  <input
                    type="text"
                    value={listSearch}
                    onChange={(e) => { setListSearch(e.target.value); setListPage(0); }}
                    placeholder="Search booker or space…"
                    className="flex-1 min-w-48 rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted/60 focus:outline-none focus:border-accent"
                  />
                  <button
                    onClick={() => loadMonthBookings(month)}
                    title="Refresh"
                    className="rounded-lg border border-border w-9 h-9 flex items-center justify-center text-muted hover:text-foreground hover:border-accent hover:bg-accent/5 transition-colors shrink-0"
                  >
                    <RefreshCw size={14} />
                  </button>
                  <select
                    value={listStatusFilter}
                    onChange={(e) => { setListStatusFilter(e.target.value as BookingStatus | "all"); setListPage(0); }}
                    className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:border-accent"
                  >
                    <option value="all">All statuses</option>
                    <option value="confirmed">Confirmed</option>
                    <option value="pending_payment">Pending</option>
                    <option value="pending_confirmation">Awaiting Review</option>
                    <option value="cancelled">Cancelled</option>
                    <option value="refunded">Refunded</option>
                  </select>
                </div>

                {filtered.length === 0 ? (
                  <div className="rounded-xl border border-border bg-background p-10 text-center shadow-sm">
                    <p className="text-sm text-muted">{q || listStatusFilter !== "all" ? "No bookings match your search." : `No bookings in ${displayMonth(month)}.`}</p>
                    {!q && listStatusFilter === "all" && (
                      <button onClick={() => openNewBooking(undefined, undefined, `${month}-01`)} className="mt-4 rounded-full bg-accent text-white px-5 py-2 text-sm font-semibold hover:opacity-90 transition-opacity">
                        + New booking
                      </button>
                    )}
                  </div>
                ) : (
                  <>
                    {listPaginator}
                    <div className="rounded-2xl border border-border shadow-sm overflow-hidden">
                      <table className="w-full text-sm border-collapse">
                        <thead>
                          <tr className="border-b border-border bg-surface text-left">
                            <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-muted">Date</th>
                            <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-muted">Time</th>
                            <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-muted">Space</th>
                            <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-muted">Booker</th>
                            <th className="hidden sm:table-cell px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-muted">Phone</th>
                            <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-muted">Status</th>
                          </tr>
                        </thead>
                        <tbody>
                    {activeBookings.map((b, i) => (
                      <tr
                        key={b.id}
                        onClick={() => setSelectedBooking(b)}
                        className={`cursor-pointer hover:bg-accent/5 transition-colors ${i > 0 ? "border-t border-border" : ""}`}
                      >
                        <td className="px-4 py-3 whitespace-nowrap text-foreground font-medium">
                          {displayDate(b.date)}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap tabular-nums text-foreground font-medium">
                          {fmtTime(b.start_time)} – {fmtTime(b.end_time)}
                        </td>
                        <td className="px-4 py-3 text-foreground">{courtName(b.court_id)}</td>
                        <td className="px-4 py-3">
                          <div className="font-semibold text-foreground">{b.booker_name}</div>
                          {b.notes && <div className="text-[11px] text-muted truncate max-w-40">{b.notes}</div>}
                        </td>
                        <td className="hidden sm:table-cell px-4 py-3 text-muted">{b.booker_phone || "—"}</td>
                        <td className="px-4 py-3"><StatusBadge status={b.status} /></td>
                      </tr>
                    ))}
                        </tbody>
                      </table>
                    </div>
                    {listPaginator}
                  </>
                )}
              </div>
            );
          })()
        ) : (
          /* ── Grid view ── */
          <>
            {courtPaginator && <div className="flex justify-center">{courtPaginator}</div>}
            <div className="overflow-x-auto rounded-2xl border border-border shadow-sm relative">
              {/* Now indicator */}
              {nowTop !== null && (
                <div
                  style={{ top: `${nowTop}px` }}
                  className="absolute left-0 right-0 z-20 pointer-events-none flex items-center"
                >
                  <div className="w-2.5 h-2.5 rounded-full bg-red-500 shrink-0 -ml-1" />
                  <div className="flex-1 h-px bg-red-500" />
                </div>
              )}

              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="border-b border-border bg-surface">
                    <th className="px-3 sm:px-4 py-3.5 text-left text-[10px] uppercase tracking-widest text-muted font-bold w-24 sm:w-36 sticky left-0 bg-surface z-10 border-r border-border">
                      Time
                    </th>
                    {visibleCourts.map((court) => (
                      <th
                        key={court.id}
                        className={`px-3 sm:px-4 py-3.5 text-center min-w-28 sm:min-w-36 ${visibleCourts.length > 1 ? "border-l border-border" : ""}`}
                      >
                        <span className="text-sm font-bold text-foreground">{court.name}</span>
                        {!court.is_active && (
                          <span className="ml-1.5 rounded-full bg-border/60 text-muted px-1.5 py-0.5 text-[9px] font-semibold normal-case tracking-normal">
                            inactive
                          </span>
                        )}
                        {court.parent_court_id && (
                          <div className="text-[10px] text-muted font-normal mt-0.5 normal-case tracking-normal">
                            shared space
                          </div>
                        )}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody ref={tbodyRef}>
                  {visibleSlotIndices.map((absIdx, rowIdx) => {
                    const slot    = slots[absIdx];
                    const slotH   = parseInt(slot.start.slice(0, 2), 10);
                    const isNight = hasPricing && slotH >= nightHour;
                    return (
                      <tr
                        key={slot.start}
                        className={`${rowIdx === 0 ? "" : "border-t border-border"} ${isNight ? "bg-surface/30" : "bg-background"}`}
                      >
                        {/* Time label */}
                        <td className={`px-3 sm:px-4 py-3 sticky left-0 z-10 border-r border-border whitespace-nowrap ${isNight ? "bg-surface/50" : "bg-background"}`}>
                          <div className="text-sm font-semibold text-foreground tabular-nums">{fmtSlotTime(slot.start)}</div>
                          {hasPricing && (
                            <div className="text-[10px] text-muted mt-0.5 flex items-center gap-1">
                              ₱{(isNight ? location!.night_rate : location!.day_rate).toFixed(0)}{halfHour ? "/halfhr" : "/hr"}
                              {isNight && (
                                <span className="rounded-full bg-border/50 px-1.5 py-px text-[9px] font-semibold uppercase tracking-widest text-muted">
                                  Night
                                </span>
                              )}
                            </div>
                          )}
                        </td>

                        {/* Court cells */}
                        {visibleCourts.map((court) => {
                          const slotInfo = bookingSpanMap.get(court.id)?.get(absIdx);
                          const blockInfo = blockSpanMap.get(court.id)?.get(absIdx);
                          if ((slotInfo && !slotInfo.isStart) || (blockInfo && !blockInfo.isStart)) return null;

                          const booking  = slotInfo?.booking ?? null;
                          const isPending = booking?.status === "pending_payment";
                          const isAwaitingReview = booking?.status === "pending_confirmation";
                          const booked   = !!booking;
                          const block    = blockInfo?.block ?? null;
                          const blocked  = !!block;
                          const past     = isSlotPast(absIdx);
                          const available = !booked && !blocked && !past && court.is_active;
                          const rowSpan  = slotInfo?.rowSpan ?? blockInfo?.rowSpan ?? 1;
                          const isOpenPlayBlock = blocked && !!block?.is_open_play;

                          return (
                            <td
                              key={court.id}
                              rowSpan={rowSpan}
                              onClick={() => {
                                if (booked && booking) { setSelectedBooking(booking); }
                                else if (blocked && block) { setRemoveBlockTarget(block); }
                                else if (available) { openNewBooking(court.id, absIdx); }
                              }}
                              style={blocked && !isOpenPlayBlock ? { backgroundImage: "repeating-linear-gradient(45deg, var(--color-border) 0, var(--color-border) 1px, transparent 1px, transparent 8px)" } : undefined}
                              className={`px-2 py-2 align-middle transition-colors ${visibleCourts.length > 1 ? "border-l border-border" : ""} ${
                                booked
                                  ? "cursor-pointer " + (isPending ? "bg-amber-50/80 hover:bg-amber-100/60" : isAwaitingReview ? "bg-violet-50/80 hover:bg-violet-100/60" : "bg-accent/12 hover:bg-accent/20")
                                  : isOpenPlayBlock
                                  ? "cursor-pointer bg-red-50/80 hover:bg-red-100/60"
                                  : blocked
                                  ? "cursor-pointer bg-surface hover:bg-border/20"
                                  : available
                                  ? "cursor-pointer hover:bg-accent/8 group/cell"
                                  : "opacity-25 bg-surface"
                              }`}
                            >
                              <div className={`w-full rounded-lg flex flex-col items-center justify-center text-xs font-semibold select-none ${rowSpan === 1 ? "py-3" : "py-2.5 gap-0.5"} ${
                                booked
                                  ? isPending ? "text-amber-700" : isAwaitingReview ? "text-violet-700" : "text-accent/80"
                                  : isOpenPlayBlock
                                  ? "text-red-700"
                                  : blocked
                                  ? "text-muted"
                                  : available
                                  ? "text-accent/0 group-hover/cell:text-accent/50 transition-colors"
                                  : "text-muted"
                              }`}>
                                {booked && booking ? (
                                  <>
                                    <span className="font-bold leading-tight text-center line-clamp-1">{booking.booker_name}</span>
                                    {rowSpan > 1 && (
                                      <span className="text-[10px] font-normal opacity-75">{fmtTime(booking.start_time)} – {fmtTime(booking.end_time)}</span>
                                    )}
                                    {isPending && rowSpan > 1 && (
                                      <span className="mt-0.5 rounded-full bg-amber-100 text-amber-700 px-1.5 py-px text-[9px] font-semibold uppercase tracking-wider">Pending</span>
                                    )}
                                    {isAwaitingReview && rowSpan > 1 && (
                                      <span className="mt-0.5 rounded-full bg-violet-100 text-violet-700 px-1.5 py-px text-[9px] font-semibold uppercase tracking-wider">Awaiting Review</span>
                                    )}
                                  </>
                                ) : blocked && block ? (
                                  <>
                                    <span className="font-bold leading-tight text-center">{isOpenPlayBlock ? "Open Play" : "Blocked"}</span>
                                    {rowSpan > 1 && block.reason && (
                                      <span className="text-[10px] font-normal opacity-75 text-center line-clamp-1">{block.reason}</span>
                                    )}
                                  </>
                                ) : available ? (
                                  <span>+</span>
                                ) : null}
                              </div>
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {courtPaginator && <div className="flex justify-center">{courtPaginator}</div>}

            {/* Legend */}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-1">
              <span className="flex items-center gap-1.5 text-xs text-muted">
                <span className="w-3 h-3 rounded-sm border border-dashed border-accent/40 shrink-0" />
                Available
              </span>
              <span className="flex items-center gap-1.5 text-xs text-muted">
                <span className="w-3 h-3 rounded-sm bg-accent/12 shrink-0" />
                Booked
              </span>
              <span className="flex items-center gap-1.5 text-xs text-muted">
                <span className="w-3 h-3 rounded-sm bg-amber-100 shrink-0" />
                Pending payment
              </span>
              <span className="flex items-center gap-1.5 text-xs text-muted">
                <span className="w-3 h-3 rounded-sm bg-violet-100 shrink-0" />
                Awaiting review
              </span>
              <span className="flex items-center gap-1.5 text-xs text-muted">
                <span className="w-3 h-3 rounded-sm bg-surface border border-border shrink-0" style={{ backgroundImage: "repeating-linear-gradient(45deg, var(--color-border) 0, var(--color-border) 1px, transparent 1px, transparent 4px)" }} />
                Blocked
              </span>
              <span className="flex items-center gap-1.5 text-xs text-muted">
                <span className="w-3 h-3 rounded-sm bg-red-100 shrink-0" />
                Open Play
              </span>
            </div>
          </>
        )}
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
                  <label className="block text-[12px] font-semibold text-muted uppercase tracking-wide mb-1.5">Space</label>
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
                      {ALL_HOURS_24.map(({ h, label }) => <option key={h} value={h}>{label}</option>)}
                    </select>
                  </div>
                  <div className="flex-1">
                    <label className="block text-[12px] font-semibold text-muted uppercase tracking-wide mb-1.5">End time</label>
                    <select value={adminBookingForm.end_hour} onChange={(e) => setAdminBookingForm((f) => f && ({ ...f, end_hour: Number(e.target.value) }))}
                      className="w-full rounded-xl border border-border bg-surface px-4 py-2.5 text-base sm:text-[14px] text-foreground focus:outline-none focus:border-accent">
                      {CLOSE_HOURS.filter(({ value }) => value > adminBookingForm.start_hour).map(({ value, label }) => (
                        <option key={value} value={value}>{label}</option>
                      ))}
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
                  <label className="block text-[12px] font-semibold text-muted uppercase tracking-wide mb-1.5">Email</label>
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
                  disabled={adminBookingSubmitting || !adminBookingForm.court_id || !adminBookingForm.booker_name.trim() || !adminBookingForm.booker_phone.trim() || !adminBookingForm.booker_email.trim()}
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
                          end_time: adminBookingForm.end_hour === 24 ? "00:00" : `${pad(adminBookingForm.end_hour)}:00`,
                          booker_name: adminBookingForm.booker_name,
                          booker_phone: adminBookingForm.booker_phone,
                          booker_email: adminBookingForm.booker_email,
                          notes: adminBookingForm.notes || null,
                        }),
                      });
                      const json = await res.json().catch(() => ({}));
                      if (!res.ok) {
                        const msg: Record<string, string> = {
                          slot_taken: "That time slot is already booked.",
                          missing_fields: "Please fill in all required fields.",
                          slot_blocked: "That slot is blocked off.",
                          invalid_email: "Enter a valid email address.",
                          name_too_long: "Name is too long (max 100 characters).",
                          date_invalid: "Invalid date.",
                          time_invalid: "Invalid time.",
                          time_range_invalid: "End time must be after start time.",
                        };
                        throw new Error(msg[json.error] ?? json.error ?? "Failed to create booking");
                      }
                      setAdminBookingForm(null);
                      loadBookings(date);
                      loadMonthBookings(month);
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

      {/* ── Block time modal ── */}
      {blockForm && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm px-0 sm:px-4 py-0 sm:py-6"
          onClick={() => setBlockForm(null)}
        >
          <div
            className="w-full max-w-lg rounded-t-2xl sm:rounded-2xl border border-border bg-background shadow-xl overflow-hidden max-h-[90vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6 overflow-y-auto space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-[17px] font-bold text-foreground">Block off time</h3>
                <button onClick={() => setBlockForm(null)} className="w-9 h-9 rounded-full border border-border flex items-center justify-center text-muted hover:bg-surface">
                  <X size={16} />
                </button>
              </div>
              <div className="space-y-3">
                <div>
                  <label className="block text-[12px] font-semibold text-muted uppercase tracking-wide mb-1.5">Courts</label>
                  <label className="flex items-center gap-2 mb-2 text-sm text-foreground">
                    <input
                      type="checkbox"
                      checked={blockForm.all_courts}
                      onChange={(e) => setBlockForm((f) => f && ({ ...f, all_courts: e.target.checked }))}
                      className="rounded border-border"
                    />
                    All courts
                  </label>
                  {!blockForm.all_courts && (
                    <div className="grid grid-cols-2 gap-1.5 max-h-32 overflow-y-auto rounded-xl border border-border p-3">
                      {(courts ?? []).map((c) => (
                        <label key={c.id} className="flex items-center gap-2 text-sm text-foreground">
                          <input
                            type="checkbox"
                            checked={blockForm.court_ids.includes(c.id)}
                            onChange={(e) => setBlockForm((f) => f && ({
                              ...f,
                              court_ids: e.target.checked ? [...f.court_ids, c.id] : f.court_ids.filter((id) => id !== c.id),
                            }))}
                            className="rounded border-border"
                          />
                          {c.name}
                        </label>
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex flex-col sm:flex-row gap-3">
                  <div className="flex-1">
                    <label className="block text-[12px] font-semibold text-muted uppercase tracking-wide mb-1.5">Start date</label>
                    <input type="date" value={blockForm.start_date}
                      onChange={(e) => setBlockForm((f) => f && ({ ...f, start_date: e.target.value, end_date: f.end_date < e.target.value ? e.target.value : f.end_date }))}
                      className="w-full rounded-xl border border-border bg-surface px-4 py-2.5 text-base sm:text-[14px] text-foreground focus:outline-none focus:border-accent" />
                  </div>
                  <div className="flex-1">
                    <label className="block text-[12px] font-semibold text-muted uppercase tracking-wide mb-1.5">End date</label>
                    <input type="date" value={blockForm.end_date} min={blockForm.start_date}
                      onChange={(e) => setBlockForm((f) => f && ({ ...f, end_date: e.target.value }))}
                      className="w-full rounded-xl border border-border bg-surface px-4 py-2.5 text-base sm:text-[14px] text-foreground focus:outline-none focus:border-accent" />
                  </div>
                </div>
                <div className="flex flex-col sm:flex-row gap-3">
                  <div className="flex-1">
                    <label className="block text-[12px] font-semibold text-muted uppercase tracking-wide mb-1.5">Start time</label>
                    <select value={blockForm.start_hour}
                      onChange={(e) => { const h = Number(e.target.value); setBlockForm((f) => f && ({ ...f, start_hour: h, end_hour: Math.max(f.end_hour, h + 1) })); }}
                      className="w-full rounded-xl border border-border bg-surface px-4 py-2.5 text-base sm:text-[14px] text-foreground focus:outline-none focus:border-accent">
                      {ALL_HOURS_24.map(({ h, label }) => <option key={h} value={h}>{label}</option>)}
                    </select>
                  </div>
                  <div className="flex-1">
                    <label className="block text-[12px] font-semibold text-muted uppercase tracking-wide mb-1.5">End time</label>
                    <select value={blockForm.end_hour} onChange={(e) => setBlockForm((f) => f && ({ ...f, end_hour: Number(e.target.value) }))}
                      className="w-full rounded-xl border border-border bg-surface px-4 py-2.5 text-base sm:text-[14px] text-foreground focus:outline-none focus:border-accent">
                      {CLOSE_HOURS.filter(({ value }) => value > blockForm.start_hour).map(({ value, label }) => (
                        <option key={value} value={value}>{label}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-[12px] font-semibold text-muted uppercase tracking-wide mb-1.5">Reason <span className="normal-case font-normal">(optional)</span></label>
                  <input type="text" value={blockForm.reason} onChange={(e) => setBlockForm((f) => f && ({ ...f, reason: e.target.value }))} placeholder="e.g. Maintenance, private event…"
                    className="w-full rounded-xl border border-border bg-surface px-4 py-2.5 text-base sm:text-[14px] text-foreground placeholder:text-muted/60 focus:outline-none focus:border-accent" />
                </div>
                <label className="flex items-center gap-2 text-sm text-foreground">
                  <input
                    type="checkbox"
                    checked={blockForm.is_open_play}
                    onChange={(e) => setBlockForm((f) => f && ({ ...f, is_open_play: e.target.checked }))}
                    className="rounded border-border"
                  />
                  This block is for Open Play
                </label>
                {blockError && <p className="text-sm text-red-600">{blockError}</p>}
              </div>
              <div className="flex gap-2.5 pt-1">
                <button onClick={() => setBlockForm(null)}
                  className="rounded-full border border-border px-5 py-2.5 text-[14px] font-semibold text-foreground hover:bg-surface transition-colors">
                  Cancel
                </button>
                <button
                  disabled={blockSubmitting || (!blockForm.all_courts && blockForm.court_ids.length === 0)}
                  onClick={async () => {
                    setBlockSubmitting(true);
                    setBlockError(null);
                    try {
                      const pad = (n: number) => String(n).padStart(2, "0");
                      const res = await fetch("/api/admin/court-blocks", {
                        method: "POST",
                        headers: { "content-type": "application/json" },
                        body: JSON.stringify({
                          court_ids: blockForm.court_ids,
                          all_courts: blockForm.all_courts,
                          start_date: blockForm.start_date,
                          end_date: blockForm.end_date,
                          start_time: `${pad(blockForm.start_hour)}:00`,
                          end_time: blockForm.end_hour === 24 ? "00:00" : `${pad(blockForm.end_hour)}:00`,
                          reason: blockForm.reason || null,
                          is_open_play: blockForm.is_open_play,
                        }),
                      });
                      const json = await res.json().catch(() => ({}));
                      if (!res.ok) {
                        const msgs: Record<string, string> = {
                          missing_fields: "Please fill in all required fields.",
                          invalid_date: "Enter a valid date range.",
                          invalid_range: "End date must be on or after the start date.",
                          court_required: "Select at least one court.",
                          range_too_long: "Date range is too long (max 90 days).",
                        };
                        throw new Error(msgs[json.error] ?? json.error ?? "Failed to create block.");
                      }
                      setBlockForm(null);
                      loadBlocks(date);
                      if (json.conflicts?.length > 0) setBlockConflicts(json.conflicts);
                    } catch (err) {
                      setBlockError((err as Error).message);
                    } finally {
                      setBlockSubmitting(false);
                    }
                  }}
                  className="flex-1 rounded-full bg-accent text-white px-5 py-2.5 text-[14px] font-semibold hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {blockSubmitting ? "Blocking…" : "Block time"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Block conflicts warning ── */}
      {blockConflicts && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm px-0 sm:px-4"
          onClick={() => setBlockConflicts(null)}>
          <div className="w-full max-w-md max-h-[90vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl border border-border bg-background shadow-xl"
            onClick={(e) => e.stopPropagation()}>
            <div className="border-b border-border px-5 py-4">
              <h3 className="text-base font-bold text-foreground">Block created — heads up</h3>
              <p className="text-xs text-muted mt-1">
                {blockConflicts.length} existing booking{blockConflicts.length > 1 ? "s" : ""} fall inside this blocked window. They were not cancelled — review them manually.
              </p>
            </div>
            <div className="px-5 py-4 space-y-2">
              {blockConflicts.map((c, i) => (
                <div key={i} className="rounded-lg border border-border px-3 py-2">
                  <p className="text-sm font-semibold text-foreground">{c.court_name} · {c.booker_name}</p>
                  <p className="text-xs text-muted">{displayDate(c.date)} · {fmtTime(c.start_time)} – {fmtTime(c.end_time)}</p>
                </div>
              ))}
            </div>
            <div className="flex gap-2 border-t border-border px-5 py-4">
              <button onClick={() => setBlockConflicts(null)}
                className="flex-1 rounded-lg bg-accent text-white px-3 py-2 text-sm font-semibold hover:opacity-90 transition-opacity">Got it</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Remove block confirm ── */}
      {removeBlockTarget && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm px-0 sm:px-4"
          onClick={() => setRemoveBlockTarget(null)}>
          <div className="w-full max-w-sm rounded-t-2xl sm:rounded-2xl border border-border bg-background shadow-xl"
            onClick={(e) => e.stopPropagation()}>
            <div className="border-b border-border px-5 py-4">
              <h3 className="text-base font-bold text-foreground">Remove this block?</h3>
              <p className="text-xs text-muted mt-1">
                {fmtTime(removeBlockTarget.start_time)} – {fmtTime(removeBlockTarget.end_time)} on {displayDate(removeBlockTarget.date)}
                {removeBlockTarget.reason ? ` · ${removeBlockTarget.reason}` : ""}
              </p>
            </div>
            <div className="flex gap-2 border-t border-border px-5 py-4">
              <button onClick={() => setRemoveBlockTarget(null)}
                className="flex-1 rounded-lg border border-border px-3 py-2 text-sm font-semibold text-muted hover:bg-accent/5 transition-colors">Cancel</button>
              <button onClick={onRemoveBlock} disabled={removingBlock}
                className="flex-1 rounded-lg bg-accent text-white px-3 py-2 text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-50">
                {removingBlock ? "Removing…" : "Remove block"}
              </button>
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
                  { label: "Space",  value: courtName(selectedBooking.court_id) },
                  { label: "Date",   value: displayDate(selectedBooking.date) },
                  { label: "Time",   value: `${fmtTime(selectedBooking.start_time)} – ${fmtTime(selectedBooking.end_time)}` },
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
                {selectedBooking.receipt_url && (
                  <div className="border-t border-border pt-3 space-y-2">
                    <span className="text-xs text-muted font-semibold uppercase tracking-wide">Payment receipt</span>
                    <a href={selectedBooking.receipt_url} target="_blank" rel="noopener noreferrer" className="block">
                      <img
                        src={selectedBooking.receipt_url}
                        alt="Payment receipt"
                        className="w-full max-h-72 object-contain rounded-xl border border-border hover:opacity-90 transition-opacity"
                      />
                    </a>
                  </div>
                )}
              </div>
              {selectedBooking.status !== "cancelled" && selectedBooking.status !== "refunded" && (
                <div className="flex flex-wrap gap-2 border-t border-border px-5 py-4">
                  {(selectedBooking.status === "pending_payment" || selectedBooking.status === "pending_confirmation") && !past && (
                    <button onClick={() => onConfirmPayment(selectedBooking.id)} disabled={confirmingId === selectedBooking.id}
                      className="flex-1 rounded-lg border border-green-400 bg-green-50 px-3 py-2 text-sm font-semibold text-green-700 hover:bg-green-500 hover:text-white transition-colors disabled:opacity-40">
                      {confirmingId === selectedBooking.id ? "Confirming…" : "Confirm Payment"}
                    </button>
                  )}
                  {!past && (
                    <button onClick={() => openReschedule(selectedBooking)}
                      className="flex-1 rounded-lg border border-border px-3 py-2 text-sm font-semibold text-foreground hover:bg-accent/10 hover:border-accent transition-colors">
                      Reschedule
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

      {/* ── Reschedule modal ── */}
      {rescheduleTarget && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm px-0 sm:px-4 py-0 sm:py-6"
          onClick={() => setRescheduleTarget(null)}
        >
          <div
            className="w-full max-w-md rounded-t-2xl sm:rounded-2xl border border-border bg-background shadow-xl overflow-hidden max-h-[90vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6 overflow-y-auto space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-[17px] font-bold text-foreground">Reschedule booking</h3>
                <button onClick={() => setRescheduleTarget(null)} className="w-9 h-9 rounded-full border border-border flex items-center justify-center text-muted hover:bg-surface">
                  <X size={16} />
                </button>
              </div>
              <p className="text-sm text-muted">{courtName(rescheduleTarget.court_id)} · {rescheduleTarget.booker_name}</p>
              <div className="space-y-3">
                <div>
                  <label className="block text-[12px] font-semibold text-muted uppercase tracking-wide mb-1.5">New date</label>
                  <input type="date" value={rescheduleDate} onChange={(e) => setRescheduleDate(e.target.value)}
                    className="w-full rounded-xl border border-border bg-surface px-4 py-2.5 text-base sm:text-[14px] text-foreground focus:outline-none focus:border-accent" />
                </div>
                <div className="flex flex-col sm:flex-row gap-3">
                  <div className="flex-1">
                    <label className="block text-[12px] font-semibold text-muted uppercase tracking-wide mb-1.5">Start time</label>
                    <select value={rescheduleStartHour}
                      onChange={(e) => { const h = Number(e.target.value); setRescheduleStartHour(h); if (rescheduleEndHour <= h) setRescheduleEndHour(h + 1); }}
                      className="w-full rounded-xl border border-border bg-surface px-4 py-2.5 text-base sm:text-[14px] text-foreground focus:outline-none focus:border-accent">
                      {ALL_HOURS_24.map(({ h, label }) => <option key={h} value={h}>{label}</option>)}
                    </select>
                  </div>
                  <div className="flex-1">
                    <label className="block text-[12px] font-semibold text-muted uppercase tracking-wide mb-1.5">End time</label>
                    <select value={rescheduleEndHour} onChange={(e) => setRescheduleEndHour(Number(e.target.value))}
                      className="w-full rounded-xl border border-border bg-surface px-4 py-2.5 text-base sm:text-[14px] text-foreground focus:outline-none focus:border-accent">
                      {CLOSE_HOURS.filter(({ value }) => value > rescheduleStartHour).map(({ value, label }) => (
                        <option key={value} value={value}>{label}</option>
                      ))}
                    </select>
                  </div>
                </div>
                {rescheduleError && <p className="text-sm text-red-600">{rescheduleError}</p>}
              </div>
              <div className="flex gap-2.5 pt-1">
                <button onClick={() => setRescheduleTarget(null)}
                  className="rounded-full border border-border px-5 py-2.5 text-[14px] font-semibold text-foreground hover:bg-surface transition-colors">
                  Cancel
                </button>
                <button
                  disabled={rescheduleSubmitting || !rescheduleDate}
                  onClick={onRescheduleSubmit}
                  className="flex-1 rounded-full bg-accent text-white px-5 py-2.5 text-[14px] font-semibold hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed">
                  {rescheduleSubmitting ? "Saving…" : "Confirm reschedule"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

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
              <textarea ref={refundReasonRef} placeholder="e.g. Venue unavailable, guest requested cancellation…" rows={3}
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
