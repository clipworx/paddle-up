"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { MapPin, Megaphone, Volleyball } from "lucide-react";
import { Logo } from "@/components/Logo";
import { Footer } from "@/components/Footer";
import type { Court, Booking, Location, CourtBlock } from "@/lib/types";
import { TIME_SLOTS, HALF_HOUR_SLOTS } from "@/lib/types";
import type { TimeSlot } from "@/lib/types";
import { applyTheme, clearTheme, themeVarsStyle } from "@/lib/themes";

const MapView = dynamic(() => import("@/components/MapView"), {
  ssr: false,
  loading: () => <div className="rounded-xl border border-border bg-surface animate-pulse" style={{ height: 220 }} />,
});

type BookingForm = {
  court_id: string;
  startIdx: number;
  endIdx: number;
  booker_name: string;
  booker_phone: string;
  booker_email: string;
  notes: string;
  player_count: number;
};

type ConfirmedBooking = {
  courtName: string;
  locationName: string;
  date: string;
  rangeLabel: string;
  totalPrice: number;
  booker_name: string;
  bookerEmail: string;
  requiresPayment: boolean;
  paymentQrUrl: string | null;
  paymentAccountName: string | null;
  paymentAccountNumber: string | null;
  bookingId: string;
  requiresDownpayment: boolean;
  downpaymentAmount: number;
  receiptDeferred?: boolean;
};

type PublicAnnouncement = {
  id: string;
  title: string;
  body: string;
  image_url: string | null;
  created_at: string;
};

function formatDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function displayDate(iso: string): string {
  const [y, m, day] = iso.split("-").map(Number);
  return new Date(y, m - 1, day).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function displayDateCompact(iso: string): string {
  const [y, m, day] = iso.split("-").map(Number);
  return new Date(y, m - 1, day).toLocaleDateString("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
  });
}

function fmtHour(h: number): string {
  if (h === 0) return "12:00 AM";
  if (h < 12) return `${h}:00 AM`;
  if (h === 12) return "12:00 PM";
  return `${h - 12}:00 PM`;
}

// Normalize "00:00" end-time to "24:00" so midnight compares correctly as end-of-day.
function normEnd(t: string): string {
  return t === "00:00" ? "24:00" : t;
}

// Format "HH:MM" → "H:MM AM/PM"
function fmtSlotTime(hhmm: string): string {
  const [h, m] = hhmm.split(":").map(Number);
  const period = h < 12 ? "AM" : "PM";
  const hour = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${hour}:${String(m).padStart(2, "0")} ${period}`;
}

function isValidPHPhone(raw: string): boolean {
  return /^(\+?63|0)9\d{9}$/.test(raw.replace(/[\s\-().]/g, ""));
}

function isSlotBooked(slots: TimeSlot[], bookings: Booking[], courtId: string, slotIdx: number): boolean {
  const slot = slots[slotIdx];
  const slotEnd = normEnd(slot.end);
  return bookings.some((b) => {
    if (b.court_id !== courtId) return false;
    if (b.status !== "confirmed" && b.status !== "pending_payment") return false;
    const bStart = b.start_time.slice(0, 5);
    const bEnd = normEnd(b.end_time.slice(0, 5));
    return bStart < slotEnd && bEnd > slot.start;
  });
}

// Returns true if a related court (parent or child) is booked, blocking this slot.
function isSlotBlockedByRelated(slots: TimeSlot[], courts: Court[], bookings: Booking[], court: Court, slotIdx: number): boolean {
  if (court.parent_court_id && isSlotBooked(slots, bookings, court.parent_court_id, slotIdx)) return true;
  return courts.some((c) => c.parent_court_id === court.id && isSlotBooked(slots, bookings, c.id, slotIdx));
}

function isSlotAdminBlocked(slots: TimeSlot[], blocks: CourtBlock[], courtId: string, slotIdx: number): boolean {
  const slot = slots[slotIdx];
  const slotEnd = normEnd(slot.end);
  return blocks.some((blk) => {
    if (blk.court_id !== courtId) return false;
    const bStart = blk.start_time.slice(0, 5);
    const bEnd = normEnd(blk.end_time.slice(0, 5));
    return bStart < slotEnd && bEnd > slot.start;
  });
}

function isSlotUnavailable(slots: TimeSlot[], courts: Court[], bookings: Booking[], blocks: CourtBlock[], court: Court, slotIdx: number): boolean {
  return isSlotBooked(slots, bookings, court.id, slotIdx)
    || isSlotBlockedByRelated(slots, courts, bookings, court, slotIdx)
    || isSlotAdminBlocked(slots, blocks, court.id, slotIdx);
}

function isPast(slots: TimeSlot[], dateIso: string, slotIdx: number): boolean {
  const slot = slots[slotIdx];
  const now = new Date();
  const [y, m, d] = dateIso.split("-").map(Number);
  const [h, min] = slot.start.split(":").map(Number);
  return new Date(y, m - 1, d, h, min) < now;
}

function isWeekend(dateIso: string): boolean {
  const [y, m, d] = dateIso.split("-").map(Number);
  const dow = new Date(y, m - 1, d).getDay();
  return dow === 0 || dow === 6;
}

function calcPrice(
  slots: TimeSlot[],
  loc: Location,
  startIdx: number,
  endIdx: number,
  dateIso: string,
  court?: Court | null,
  playerCount = 4,
): number {
  const hasCustom = court != null && (court.custom_day_rate != null || court.custom_night_rate != null);
  const unit = hasCustom ? (court!.custom_rate_unit ?? "hr") : "hr";

  // flat: fixed fee regardless of hours/players
  if (unit === "flat") {
    return court?.custom_day_rate ?? loc.day_rate;
  }

  const weekend = isWeekend(dateIso);
  const nightHour = parseInt(
    (weekend ? loc.weekend_night_start_time : loc.night_start_time).slice(0, 2),
    10
  );
  const dayRate   = court?.custom_day_rate   ?? loc.day_rate;
  const nightRate = court?.custom_night_rate ?? loc.night_rate;
  const slotDuration = slots.length > 24 ? 0.5 : 1;

  // pax: per-person flat fee (one charge total, not per hour)
  if (unit === "pax") {
    const startH = parseInt(slots[startIdx].start.slice(0, 2), 10);
    const rate = startH >= nightHour ? nightRate : dayRate;
    return rate * playerCount;
  }

  // hr (default): per slot, scaled by slot duration
  let total = 0;
  for (let i = startIdx; i <= endIdx; i++) {
    const hour = parseInt(slots[i].start.slice(0, 2), 10);
    total += (hour >= nightHour ? nightRate : dayRate) * slotDuration;
  }
  return total;
}

function slotRangeLabel(slots: TimeSlot[], startIdx: number, endIdx: number): string {
  const startStr = slots[startIdx].start;
  const rawEnd = slots[endIdx].end;
  return `${fmtSlotTime(startStr)} – ${fmtSlotTime(rawEnd === "00:00" ? "00:00" : rawEnd)}`;
}

// ─── Court surface placeholder (no photo) ──────────────────────────────────────

const COURT_LINE_OVERLAY = {
  backgroundImage:
    "linear-gradient(transparent 48.5%, rgba(255,255,255,.28) 48.5%, rgba(255,255,255,.28) 51.5%, transparent 51.5%)," +
    "linear-gradient(90deg, transparent 48.5%, rgba(255,255,255,.15) 48.5%, rgba(255,255,255,.15) 51.5%, transparent 51.5%)," +
    "linear-gradient(transparent 23%, rgba(255,255,255,.18) 23%, rgba(255,255,255,.18) 24.5%, transparent 24.5%, transparent 75.5%, rgba(255,255,255,.18) 75.5%, rgba(255,255,255,.18) 77%, transparent 77%)",
};

const HERO_GRID_OVERLAY = {
  backgroundImage:
    "repeating-linear-gradient(90deg, rgba(255,255,255,.032) 0, rgba(255,255,255,.032) 1px, transparent 1px, transparent 46px)," +
    "repeating-linear-gradient(0deg, rgba(255,255,255,.032) 0, rgba(255,255,255,.032) 1px, transparent 1px, transparent 46px)",
};

function CourtSurface({ className }: { className?: string }) {
  return <div className={`court-surface ${className ?? ""}`} style={COURT_LINE_OVERLAY} />;
}

// ─── Location picker ──────────────────────────────────────────────────────────

function LocationPicker({
  locations,
  onSelect,
}: {
  locations: Location[];
  onSelect: (loc: Location) => void;
}) {
  return (
    <div className="space-y-0 -mt-8 -mx-4">
      {/* Hero */}
      <div className="relative overflow-hidden bg-foreground px-4 pt-16 pb-14 sm:pt-20 sm:pb-18 text-center">
        <div className="absolute inset-0 pointer-events-none" style={HERO_GRID_OVERLAY} />
        <div className="relative">
          <div className="mx-auto mb-4 h-[3px] w-7 bg-accent" />
          <h1 className="font-display italic text-5xl sm:text-6xl lg:text-7xl font-extrabold uppercase tracking-tight leading-[0.95] text-white mb-4">
            Find your<br />
            <span className="text-accent">court.</span>
          </h1>
          <p className="text-base sm:text-lg text-white/55 max-w-xl mx-auto leading-relaxed">
            Pick a venue, book your slot, pay by QR. No account needed.
          </p>
        </div>
      </div>

      {/* Venue list */}
      <div className="px-4 pb-12 pt-10">
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-op-mono text-[10px] font-bold text-accent uppercase tracking-[0.14em]">
            Venues near you
          </h2>
          <span className="text-xs text-muted">{locations.length} {locations.length === 1 ? "venue" : "venues"}</span>
        </div>

        <div className={`grid gap-5 ${
          locations.length === 1 ? "max-w-sm" :
          locations.length === 2 ? "sm:grid-cols-2 max-w-2xl" :
          "sm:grid-cols-2 lg:grid-cols-3"
        }`}>
          {locations.map((loc) => (
            <button
              key={loc.id}
              onClick={() => onSelect(loc)}
              style={themeVarsStyle(loc.accent_color)}
              className="group text-left rounded-2xl bg-background overflow-hidden shadow-sm hover:shadow-xl hover:shadow-foreground/10 transition-all duration-200"
            >
              {/* Facility photo / court surface */}
              <div className="relative h-28 overflow-hidden">
                {loc.photo_url ? (
                  <img
                    src={loc.photo_url}
                    alt={loc.name}
                    className="absolute inset-0 w-full h-full object-cover object-center"
                  />
                ) : (
                  <CourtSurface className="absolute inset-0" />
                )}
                <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-foreground/65" />
                <div className="absolute top-2.5 left-2.5 rounded-full bg-foreground/45 border border-white/20 px-2.5 py-0.5">
                  <span className="font-op-mono text-[9px] font-bold text-white tracking-[0.08em]">
                    {loc.court_count} {loc.court_count === 1 ? "SPACE" : "SPACES"}
                  </span>
                </div>
              </div>

              {/* Info */}
              <div className="p-3.5 space-y-2">
                <h3 className="text-[15px] font-bold text-foreground leading-snug">
                  {loc.name}
                </h3>
                {loc.address && (
                  <p className="font-op-mono text-[10px] text-muted flex items-center gap-1 leading-snug">
                    <MapPin size={11} className="shrink-0" />
                    {loc.address}
                  </p>
                )}
                <div className="flex items-center justify-between pt-1">
                  {(loc.day_rate > 0 || loc.night_rate > 0) ? (
                    <div className="flex items-baseline gap-1">
                      <span className="font-op-mono text-[9px] text-muted uppercase">from</span>
                      <span className="font-display italic text-2xl font-bold text-accent">
                        ₱{Math.min(loc.day_rate, loc.night_rate || loc.day_rate).toFixed(0)}
                      </span>
                      <span className="text-xs text-muted">{loc.allow_half_hour_bookings ? "/halfhr" : "/hr"}</span>
                    </div>
                  ) : (
                    <span />
                  )}
                  <span className="rounded-full bg-foreground text-background text-xs font-semibold px-3.5 py-1.5 group-hover:opacity-85 transition-opacity">
                    View courts →
                  </span>
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* How it works strip */}
      <div className="border-t border-border bg-background px-4 py-10">
        <div className="max-w-3xl mx-auto">
          <h2 className="font-op-mono text-[10px] font-bold text-accent uppercase tracking-[0.14em] text-center mb-8">
            How it works
          </h2>
          <div className="grid sm:grid-cols-3 gap-8">
            {[
              { n: "01", title: "Pick your venue", body: "Browse nearby venues, see what courts are available." },
              { n: "02", title: "Pick your slot", body: "Select a space and time on the live availability grid." },
              { n: "03", title: "Confirm & go", body: "Fill in your details, pay if required, and you're ready." },
            ].map((step) => (
              <div key={step.n} className="flex gap-3.5">
                <div className="shrink-0 w-9 h-9 rounded-full bg-foreground flex items-center justify-center">
                  <span className="font-op-mono text-xs font-bold text-white">{step.n}</span>
                </div>
                <div>
                  <h3 className="text-[14px] font-bold text-foreground mb-1">{step.title}</h3>
                  <p className="text-sm text-muted leading-relaxed">{step.body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main page ─────────────────────────────────────────────────────────────────

export function BookingPage({ initialSlug }: { initialSlug?: string } = {}) {
  const today = formatDate(new Date());
  const [locations, setLocations] = useState<Location[] | null>(null);
  const [locationNotFound, setLocationNotFound] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState<Location | null>(null);
  const [date, setDate] = useState(today);
  const [courts, setCourts] = useState<Court[]>([]);
  const [courtPage, setCourtPage] = useState(0);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [blocks, setBlocks] = useState<CourtBlock[]>([]);
  const [loadingCourts, setLoadingCourts] = useState(false);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [showMap, setShowMap] = useState(false);
  const [form, setForm] = useState<BookingForm>({
    court_id: "",
    startIdx: 0,
    endIdx: 0,
    booker_name: "",
    booker_phone: "",
    booker_email: "",
    notes: "",
    player_count: 4,
  });
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState<ConfirmedBooking | null>(null);
  const [locationTab, setLocationTab] = useState<"book" | "announcements">("book");
  const [announcements, setAnnouncements] = useState<PublicAnnouncement[]>([]);
  const [announcementsLoading, setAnnouncementsLoading] = useState(false);
  const [selectedAnnouncement, setSelectedAnnouncement] = useState<PublicAnnouncement | null>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const tbodyRef = useRef<HTMLTableSectionElement>(null);
  const [nowTop, setNowTop] = useState<number | null>(null);

  useEffect(() => {
    fetch("/api/locations")
      .then((r) => r.json())
      .then((j) => {
        const locs: Location[] = j.locations ?? [];
        setLocations(locs);
        if (initialSlug) {
          const match = locs.find((l) => l.slug === initialSlug);
          if (match) setSelectedLocation(match);
          else setLocationNotFound(true);
        } else if (locs.length === 1) {
          setSelectedLocation(locs[0]);
        }
      })
      .catch(() => setLocations([]));
  }, [initialSlug]);

  useEffect(() => {
    if (!selectedLocation) return;
    setLoadingCourts(true);
    fetch(`/api/courts?location_id=${selectedLocation.id}`)
      .then((r) => r.json())
      .then((j) => {
        const c: Court[] = (j.courts ?? []).sort((a: Court, b: Court) =>
          a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: "base" })
        );
        setCourts(c);
        setCourtPage(0);
      })
      .finally(() => setLoadingCourts(false));

    // Load announcements whenever location changes
    setLocationTab("book");
    setAnnouncements([]);
    setAnnouncementsLoading(true);
    fetch(`/api/announcements?location_id=${selectedLocation.id}`)
      .then((r) => r.json())
      .then((j) => setAnnouncements(j.announcements ?? []))
      .catch(() => {})
      .finally(() => setAnnouncementsLoading(false));
  }, [selectedLocation]);

  const fetchBookings = useCallback(async (d: string) => {
    if (!selectedLocation) return;
    setLoadingSlots(true);
    const res = await fetch(`/api/bookings?date=${d}`);
    const json = await res.json();
    setBookings(json.bookings ?? []);
    setLoadingSlots(false);
  }, [selectedLocation]);

  const fetchBlocks = useCallback(async (d: string) => {
    if (!selectedLocation) return;
    const res = await fetch(`/api/court-blocks?date=${d}`);
    if (!res.ok) return;
    const json = await res.json();
    setBlocks(json.blocks ?? []);
  }, [selectedLocation]);

  useEffect(() => { fetchBookings(date); fetchBlocks(date); }, [date, fetchBookings, fetchBlocks]);

  useEffect(() => {
    if (showModal) setTimeout(() => nameRef.current?.focus(), 50);
  }, [showModal]);

  useEffect(() => {
    applyTheme(selectedLocation?.accent_color ?? null);
    return () => clearTheme();
  }, [selectedLocation?.accent_color]);

  // Current-time indicator
  useEffect(() => {
    if (date !== today) { setNowTop(null); return; }
    const calc = () => {
      if (!gridRef.current || !tbodyRef.current) return;
      const now = new Date();
      const currentHour = now.getHours();
      if (currentHour < openH || currentHour >= closeH) { setNowTop(null); return; }
      const rows = tbodyRef.current.rows;
      if (!rows.length) return;
      const totalMinsSinceOpen = (currentHour - openH) * 60 + now.getMinutes();
      const rowIdx = halfHour ? Math.floor(totalMinsSinceOpen / 30) : currentHour - openH;
      const fraction = halfHour ? (totalMinsSinceOpen % 30) / 30 : now.getMinutes() / 60;
      const row = rows[Math.min(rowIdx, rows.length - 1)];
      const containerRect = gridRef.current.getBoundingClientRect();
      const rowRect = row.getBoundingClientRect();
      setNowTop(rowRect.top - containerRect.top + rowRect.height * fraction);
    };
    calc();
    const id = setInterval(calc, 60000);
    return () => clearInterval(id);
  }, [date, today, courts, bookings]);

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

  const weekend = isWeekend(date);
  const openH = weekend
    ? (selectedLocation?.weekend_open_hour ?? selectedLocation?.open_hour ?? 0)
    : (selectedLocation?.open_hour ?? 0);
  const closeH = weekend
    ? (selectedLocation?.weekend_close_hour ?? selectedLocation?.close_hour ?? 24)
    : (selectedLocation?.close_hour ?? 24);

  // Find the first non-past, non-booked slot within operating hours
  function defaultStartIdx(courtId: string): number {
    const court = courts.find((c) => c.id === courtId);
    for (let i = openH * slotsPerHour; i < closeH * slotsPerHour; i++) {
      if (!isPast(slots, date, i) && (!court || !isSlotUnavailable(slots, courts, bookings, blocks, court, i))) return i;
    }
    return openH * slotsPerHour;
  }

  // Last valid end slot within operating hours, not crossing a booked or blocked slot
  function maxEndIdx(courtId: string, startIdx: number): number {
    const court = courts.find((c) => c.id === courtId);
    // If split-rate bookings are blocked and start is in the day period, cap at the night boundary
    if (selectedLocation?.no_split_rate_booking && startIdx < nightHour * slotsPerHour) {
      const cap = nightHour * slotsPerHour - 1;
      for (let i = startIdx; i <= cap; i++) {
        if (court && isSlotUnavailable(slots, courts, bookings, blocks, court, i)) return i - 1;
      }
      return cap;
    }
    for (let i = startIdx; i < closeH * slotsPerHour; i++) {
      if (court && isSlotUnavailable(slots, courts, bookings, blocks, court, i)) return i - 1;
    }
    return closeH * slotsPerHour - 1;
  }

  const PAGE_SIZE = 5;
  const totalPages = Math.ceil(courts.length / PAGE_SIZE);
  const visibleCourts = courts.length > 5
    ? courts.slice(courtPage * PAGE_SIZE, (courtPage + 1) * PAGE_SIZE)
    : courts;

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

  const courtPaginator = courts.length > 5 ? (
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
            {(() => { const s = courts.slice(item * PAGE_SIZE, (item + 1) * PAGE_SIZE); return `${s[0]?.name} – ${s[s.length - 1]?.name}`; })()}
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
          const slice = courts.slice(i * PAGE_SIZE, (i + 1) * PAGE_SIZE);
          return <option key={i} value={i}>{slice[0]?.name} – {slice[slice.length - 1]?.name}</option>;
        })}
      </select>
    </div>
  ) : null;

  function openBookingModal(preCourtId?: string, preStartIdx?: number) {
    const court = preCourtId
      ? courts.find((c) => c.id === preCourtId)
      : (courts.find((c) => c.is_active) ?? courts[0]);
    if (!court) return;
    const sid = preStartIdx ?? defaultStartIdx(court.id);
    setForm({
      court_id: court.id,
      startIdx: sid,
      endIdx: sid,
      booker_name: "",
      booker_phone: "",
      booker_email: "",
      notes: "",
      player_count: 4,
    });
    setFormError(null);
    setShowModal(true);
  }

  function onCourtChange(courtId: string) {
    const sid = defaultStartIdx(courtId);
    setForm((f) => ({ ...f, court_id: courtId, startIdx: sid, endIdx: sid }));
  }

  function onStartChange(startIdx: number) {
    const max = maxEndIdx(form.court_id, startIdx);
    const endIdx = Math.min(Math.max(startIdx, form.endIdx), max < startIdx ? startIdx : max);
    setForm((f) => ({ ...f, startIdx, endIdx }));
  }

  function onEndChange(endIdx: number) {
    setForm((f) => ({ ...f, endIdx }));
  }

  // Check if the currently selected range has a conflict
  function rangeConflict(): string | null {
    const court = courts.find((c) => c.id === form.court_id);
    for (let i = form.startIdx; i <= form.endIdx; i++) {
      if (isPast(slots, date, i)) return `${slots[i].start} is in the past.`;
      if (court && isSlotUnavailable(slots, courts, bookings, blocks, court, i)) return `${slots[i].start} is not available.`;
    }
    return null;
  }

  async function onSubmit(e: React.SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!selectedLocation) return;
    const conflict = rangeConflict();
    if (conflict) { setFormError(conflict); return; }
    if (!form.booker_name.trim()) {
      setFormError("Your name is required.");
      return;
    }
    if (form.booker_name.trim().length > 100) {
      setFormError("Name is too long (max 100 characters).");
      return;
    }
    if (!isValidPHPhone(form.booker_phone)) {
      setFormError("Enter a valid Philippine mobile number (e.g. 09171234567 or +639171234567).");
      return;
    }
    if (!form.booker_email.trim()) {
      setFormError("Email address is required.");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.booker_email.trim())) {
      setFormError("Enter a valid email address.");
      return;
    }
    if (isPaxCourt && (form.player_count < 1 || form.player_count > 50)) {
      setFormError("Number of players must be between 1 and 50.");
      return;
    }
    setFormError(null);
    setSubmitting(true);

    const res = await fetch("/api/bookings", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        court_id: form.court_id,
        date,
        start_time: slots[form.startIdx].start + ":00",
        end_time: slots[form.endIdx].end + ":00",
        booker_name: form.booker_name,
        booker_phone: form.booker_phone,
        booker_email: form.booker_email,
        player_count: form.player_count,
        notes: form.notes || null,
      }),
    });

    const json = await res.json().catch(() => ({}));
    setSubmitting(false);

    if (!res.ok) {
      const msgs: Record<string, string> = {
        slot_taken: "That slot was just booked. Please pick another time.",
        name_required: "Name is required.",
        name_too_long: "Name is too long (max 100 characters).",
        phone_required: "Phone number is required.",
        phone_invalid: "Enter a valid Philippine mobile number (e.g. 09171234567).",
        email_required: "Email address is required.",
        valid_email_required: "Enter a valid email address.",
        notes_too_long: "Notes are too long (max 500 characters).",
        missing_fields: "Please fill in all required fields.",
        date_invalid: "Invalid date.",
        time_invalid: "Invalid time.",
        time_range_invalid: "End time must be after start time.",
        slot_in_past: "That time has already passed. Please pick another slot.",
        player_count_invalid: "Invalid number of players.",
        split_rate_not_allowed: "This location does not allow bookings that span the day and night rate. Please book day and night slots separately.",
      };
      setFormError(msgs[json.error] ?? json.error ?? "Booking failed.");
      return;
    }

    const courtName = courts.find((c) => c.id === form.court_id)?.name ?? "";
    const bookedCourt = courts.find((c) => c.id === form.court_id);
    const totalPrice = calcPrice(slots, selectedLocation, form.startIdx, form.endIdx, date, bookedCourt, form.player_count);
    setConfirmed({
      courtName,
      locationName: selectedLocation.name,
      date,
      rangeLabel: slotRangeLabel(slots, form.startIdx, form.endIdx),
      totalPrice,
      booker_name: form.booker_name,
      bookerEmail: form.booker_email,
      requiresPayment: json.requires_payment ?? false,
      paymentQrUrl: json.payment_qr_url ?? null,
      paymentAccountName: json.payment_account_name ?? null,
      paymentAccountNumber: json.payment_account_number ?? null,
      bookingId: json.booking?.id ?? "",
      requiresDownpayment: json.requires_downpayment ?? false,
      downpaymentAmount: totalPrice / 2,
    });
    setShowModal(false);
    fetchBookings(date);
  }

  const hasPricing = selectedLocation &&
    (selectedLocation.day_rate > 0 || selectedLocation.night_rate > 0);
  const nightHour = selectedLocation
    ? parseInt(
        (weekend ? selectedLocation.weekend_night_start_time : selectedLocation.night_start_time).slice(0, 2),
        10
      )
    : 18;

  const halfHour = selectedLocation?.allow_half_hour_bookings ?? false;
  const slots = halfHour ? HALF_HOUR_SLOTS : TIME_SLOTS;
  const slotsPerHour = halfHour ? 2 : 1;

  // Visible slot indices (filtered to operating hours)
  const visibleSlotIndices = Array.from(
    { length: (closeH - openH) * slotsPerHour },
    (_, k) => openH * slotsPerHour + k
  );

  // Precompute booking spans so consecutive slots from the same booking merge into one cell
  type SlotSpan = { booking: Booking; rowSpan: number; isStart: boolean };
  const bookingSpanMap = new Map<string, Map<number, SlotSpan>>();
  courts.forEach((court) => {
    const slotMap = new Map<number, SlotSpan>();
    bookings.forEach((b) => {
      if (b.court_id !== court.id) return;
      if (b.status !== "confirmed" && b.status !== "pending_payment") return;
      const bStart = b.start_time.slice(0, 5);
      const bEnd = normEnd(b.end_time.slice(0, 5));
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

  // Derived values for the modal
  const modalCourt = courts.find((c) => c.id === form.court_id);
  const validMax = maxEndIdx(form.court_id, form.startIdx);
  const totalPrice = selectedLocation
    ? calcPrice(slots, selectedLocation, form.startIdx, form.endIdx, date, modalCourt, form.player_count)
    : 0;
  const isPaxCourt = (modalCourt?.custom_rate_unit ?? "hr") === "pax" && modalCourt?.custom_day_rate != null;
  const durationSlots = form.endIdx - form.startIdx + 1;
  const durationMins = durationSlots * (halfHour ? 30 : 60);
  const durationLabel = durationMins < 60
    ? `${durationMins} min`
    : durationMins % 60 === 0
    ? `${durationMins / 60} ${durationMins === 60 ? "hour" : "hours"}`
    : `${Math.floor(durationMins / 60)}h ${durationMins % 60}m`;
  const durationHours = durationMins / 60;
  const showDownpaymentNotice = selectedLocation?.require_downpayment &&
    durationHours > (selectedLocation?.downpayment_min_hours ?? 3);

  // Available start indices for the selected court within operating hours
  const availableStarts = visibleSlotIndices.filter((i) => {
    if (isPast(slots, date, i)) return false;
    const court = courts.find((c) => c.id === form.court_id);
    return !court || !isSlotUnavailable(slots, courts, bookings, blocks, court, i);
  });

  return (
    <div className="min-h-screen bg-surface">
      {/* ── Nav ── */}
      <nav className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/80">
        <div className="mx-auto max-w-6xl w-full px-4 h-14 flex items-center gap-4">
          <Link href="/book" className="flex items-center gap-2 shrink-0">
            <Logo size={30} />
            <span className="font-display text-[19px] font-bold uppercase tracking-[0.07em] text-foreground hidden sm:block">
              Re<span className="text-accent">Z</span>erve
            </span>
          </Link>
          {!selectedLocation && (
            <>
              <Link
                href="/play"
                className="hidden sm:block text-xs font-semibold text-muted hover:text-foreground transition-colors ml-2"
              >
                Open Play ↗
              </Link>
              <Link
                href="/about"
                className="hidden sm:block text-xs font-semibold text-muted hover:text-foreground transition-colors"
              >
                About
              </Link>
            </>
          )}

          {/* Location crumb when selected */}
          {selectedLocation && (
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <span className="text-border mx-1">·</span>
              <span className="text-sm font-semibold text-foreground truncate">{selectedLocation.name}</span>
            </div>
          )}

          <div className="ml-auto flex items-center gap-3 shrink-0">
            {selectedLocation && !initialSlug && (locations?.length ?? 0) > 1 && (
              <button
                onClick={() => { setSelectedLocation(null); setCourts([]); setBookings([]); }}
                className="flex items-center gap-1 rounded-full border border-border px-3 py-1.5 text-xs font-semibold text-muted hover:text-foreground hover:border-accent/50 transition-colors"
              >
                ← All locations
              </button>
            )}
          </div>
        </div>
      </nav>

      <main className="mx-auto max-w-6xl w-full px-4 py-8 space-y-6">

      {/* Payment pending screen */}
      {confirmed?.requiresPayment && !confirmed.receiptDeferred && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-0 sm:p-4">
          <div className="w-full max-w-sm rounded-t-2xl sm:rounded-2xl bg-background shadow-2xl overflow-hidden max-h-[92vh] overflow-y-auto">
            {/* Dark header: booking ref */}
            <div className="bg-foreground px-5 py-3 flex items-center justify-between">
              <span className="font-op-mono text-[10px] font-bold text-white/45 tracking-widest">BOOKING REF</span>
              <span className="font-op-mono text-[13px] font-bold text-white tracking-widest">{confirmed.bookingId.slice(0, 8).toUpperCase()}</span>
            </div>

            {/* Accent summary strip */}
            <div className="bg-accent px-5 py-2.5 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[13px] font-bold text-white truncate">{confirmed.courtName} · {confirmed.locationName}</p>
                <p className="font-op-mono text-[10px] text-white/65 mt-0.5">{displayDateCompact(confirmed.date).toUpperCase()} · {confirmed.rangeLabel.toUpperCase()}</p>
              </div>
              <div className="text-right shrink-0">
                <p className="font-op-mono text-[9px] text-white/65">TOTAL</p>
                <p className="font-display italic text-xl font-bold text-white leading-none">₱{confirmed.totalPrice.toFixed(0)}</p>
              </div>
            </div>

            <div className="px-5 py-5 text-center">
              <p className="font-op-mono text-[10px] font-bold text-accent uppercase tracking-widest mb-1">
                {confirmed.requiresDownpayment ? "Downpayment" : "Amount due"}
              </p>
              <p className="font-display italic text-5xl font-extrabold text-foreground leading-none mb-1">
                ₱{(confirmed.requiresDownpayment ? confirmed.downpaymentAmount : confirmed.totalPrice).toFixed(0)}
              </p>
              {confirmed.requiresDownpayment && (
                <p className="text-xs text-muted mb-3">Balance on arrival: ₱{confirmed.downpaymentAmount.toFixed(2)}</p>
              )}
              <p className="text-[13px] text-muted mb-4">Scan to pay, then upload your receipt below.</p>

              {confirmed.paymentQrUrl && (
                <div className="flex flex-col items-center gap-3">
                  <div className="inline-block p-3 rounded-2xl border border-border">
                    <img
                      src={confirmed.paymentQrUrl}
                      alt="Payment QR code"
                      className="w-40 h-40 object-contain rounded-lg"
                    />
                  </div>
                  {(confirmed.paymentAccountName || confirmed.paymentAccountNumber) && (
                    <div className="rounded-xl bg-surface px-4 py-2.5 text-left w-full">
                      <p className="font-op-mono text-[9px] text-muted tracking-widest mb-0.5">SEND TO</p>
                      {confirmed.paymentAccountNumber && (
                        <p className="font-semibold text-foreground text-sm">{confirmed.paymentAccountNumber}</p>
                      )}
                      {confirmed.paymentAccountName && (
                        <p className="text-sm text-muted">{confirmed.paymentAccountName}</p>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="px-5 pb-5 space-y-2.5">
              <Link
                href={`/book/receipt/${confirmed.bookingId}`}
                className="block w-full text-center rounded-full bg-accent text-white py-3.5 text-sm font-bold hover:opacity-90 transition-opacity shadow-sm"
              >
                Upload payment receipt
              </Link>

              <button
                onClick={() => setConfirmed((c) => c && ({ ...c, receiptDeferred: true }))}
                className="w-full rounded-full border border-border text-foreground py-3 text-sm font-bold hover:bg-surface transition-colors"
              >
                I&apos;ll do this later
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Receipt-upload deferred modal */}
      {confirmed?.requiresPayment && confirmed.receiptDeferred && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-0 sm:p-4"
          onClick={() => setConfirmed(null)}
        >
          <div
            className="w-full max-w-sm rounded-t-2xl sm:rounded-2xl bg-background shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-6 pt-6 pb-4 border-b border-border">
              <div className="inline-flex items-center gap-1.5 font-op-mono text-[10px] font-bold text-accent uppercase tracking-widest mb-2">
                Link sent
              </div>
              <h2 className="text-lg font-bold text-foreground">We&apos;ve emailed you the link</h2>
              <p className="text-xs text-muted mt-1">
                Upload your payment receipt anytime using the link sent to <strong className="text-foreground">{confirmed.bookerEmail}</strong>.
              </p>
            </div>

            <div className="px-6 py-4 space-y-3">
              <Link
                href={`/book/receipt/${confirmed.bookingId}`}
                className="block w-full text-center rounded-full bg-accent text-white py-3 text-sm font-bold hover:opacity-90 transition-opacity shadow-sm"
              >
                Upload payment receipt now
              </Link>
              <button
                onClick={() => setConfirmed(null)}
                className="w-full rounded-full border border-border text-foreground py-3 text-sm font-bold hover:bg-surface transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation banner (no payment required) */}
      {confirmed && !confirmed.requiresPayment && (
        <div className="rounded-2xl border border-accent/25 bg-accent/8 px-5 py-4 flex items-start justify-between gap-4 shadow-sm">
          <div>
            <p className="font-bold text-foreground text-sm">Booking confirmed!</p>
            <p className="text-sm text-foreground/80 mt-0.5">
              {confirmed.courtName} · {confirmed.locationName} ·{" "}
              {confirmed.rangeLabel} · {displayDate(confirmed.date)}
              {confirmed.totalPrice > 0 && (
                <span className="font-semibold"> · ₱{confirmed.totalPrice.toFixed(2)}</span>
              )}
            </p>
            <p className="text-xs text-accent mt-1">
              See you there, {confirmed.booker_name}!
            </p>
          </div>
          <button
            onClick={() => setConfirmed(null)}
            className="shrink-0 w-6 h-6 rounded-full border border-accent/25 flex items-center justify-center text-accent hover:bg-accent/15 transition-colors text-sm leading-none mt-0.5"
          >
            ×
          </button>
        </div>
      )}

      {locationNotFound && (
        <div className="rounded-2xl border border-border bg-background p-10 text-center space-y-3 shadow-sm">
          <p className="text-base font-bold text-foreground">Location not found</p>
          <p className="text-sm text-muted">No active location exists at this URL.</p>
          <Link href="/book" className="inline-block rounded-lg bg-accent text-background px-4 py-2 text-sm font-semibold hover:bg-muted transition-colors">
            See all locations
          </Link>
        </div>
      )}

      {locations === null && !locationNotFound && (
        <p className="text-sm text-muted py-8 text-center">Loading…</p>
      )}

      {/* Location picker */}
      {locations !== null && !selectedLocation && (
        locations.length === 0 ? (
          <div className="rounded-xl border border-border bg-background p-8 text-center shadow-sm">
            <p className="text-sm text-muted">No locations available yet.</p>
          </div>
        ) : (
          <LocationPicker locations={locations} onSelect={setSelectedLocation} />
        )
      )}

      {/* Court grid */}
      {selectedLocation && (
        <>
          {/* Location branding header — dark photo/court-surface band */}
          <div className="relative h-40 sm:h-44 rounded-2xl overflow-hidden shadow-sm">
            {selectedLocation.photo_url ? (
              <img
                src={selectedLocation.photo_url}
                alt={selectedLocation.name}
                className="absolute inset-0 w-full h-full object-cover object-center"
              />
            ) : (
              <CourtSurface className="absolute inset-0" />
            )}
            <div className="absolute inset-0 bg-linear-to-b from-black/20 to-black/70" />
            <div className="absolute bottom-3.5 left-4 right-4 sm:bottom-4 sm:left-5 sm:right-5 flex items-end gap-3">
              <div className="w-11 h-11 sm:w-13 sm:h-13 rounded-xl border-2 border-white/40 bg-white/10 shrink-0 flex items-center justify-center overflow-hidden">
                {selectedLocation.logo_url ? (
                  <img src={selectedLocation.logo_url} alt="" className="w-full h-full object-contain" />
                ) : (
                  <Logo size={24} />
                )}
              </div>
              <div className="min-w-0">
                <h1 className="font-display italic text-2xl sm:text-3xl font-bold text-white leading-none [text-shadow:0_1px_4px_rgba(0,0,0,.3)] truncate">
                  {selectedLocation.name}
                </h1>
                <div className="flex items-center gap-2 mt-1">
                  {selectedLocation.address && (
                    <span className="font-op-mono text-[10px] text-white/65 truncate">{selectedLocation.address}</span>
                  )}
                  {(selectedLocation.day_rate > 0 || selectedLocation.night_rate > 0) && (
                    <span className="font-op-mono text-[10px] font-bold text-white bg-accent/90 px-1.75 py-px rounded-full shrink-0">
                      ₱{Math.min(selectedLocation.day_rate, selectedLocation.night_rate || selectedLocation.day_rate).toFixed(0)}{halfHour ? "/halfhr" : "/hr"}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Tab nav */}
          <div className="flex items-center border-b border-border">
            <button
              onClick={() => setLocationTab("book")}
              className={`flex-1 sm:flex-none text-center sm:text-left px-1 sm:px-0 sm:mr-7 py-3 text-sm font-bold border-b-2 transition-colors ${
                locationTab === "book"
                  ? "text-foreground border-accent"
                  : "text-muted border-transparent hover:text-foreground"
              }`}
            >
              Book a court
            </button>
            <button
              onClick={() => setLocationTab("announcements")}
              className={`flex-1 sm:flex-none text-center sm:text-left px-1 sm:px-0 py-3 text-sm font-bold border-b-2 transition-colors inline-flex items-center justify-center sm:justify-start gap-1.5 ${
                locationTab === "announcements"
                  ? "text-foreground border-accent"
                  : "text-muted border-transparent hover:text-foreground"
              }`}
            >
              Announcements
              {announcements.length > 0 && (
                <span className="rounded-full bg-accent text-white text-[10px] font-bold px-1.5 min-w-4.5 text-center leading-4.5">
                  {announcements.length}
                </span>
              )}
            </button>
            {selectedLocation?.latitude && selectedLocation?.longitude && (
              <button
                onClick={() => setShowMap(true)}
                className="ml-auto flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-accent text-white text-[13px] font-semibold hover:opacity-90 transition-opacity shadow-sm shrink-0"
              >
                <MapPin size={13} /> Map
              </button>
            )}
          </div>

          {/* Announcements view */}
          {locationTab === "announcements" && (
            <div className="space-y-4">
              {announcementsLoading ? (
                <div className="space-y-4">
                  {[...Array(3)].map((_, i) => (
                    <div key={i} className="rounded-xl border border-border bg-background h-32 animate-pulse" />
                  ))}
                </div>
              ) : announcements.length === 0 ? (
                <div className="rounded-xl border border-dashed border-border bg-background px-6 py-14 text-center">
                  <div className="w-10 h-10 rounded-xl bg-accent/15 flex items-center justify-center mx-auto mb-3">
                    <Megaphone size={20} className="text-accent" />
                  </div>
                  <p className="font-semibold text-foreground text-sm">No announcements</p>
                  <p className="text-sm text-muted mt-1">Check back later for updates from {selectedLocation.name}.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {announcements.map((a, i) => (
                    <div
                      key={a.id}
                      className={`rounded-xl bg-background shadow-sm overflow-hidden flex flex-col ${a.image_url ? (i % 2 === 0 ? "sm:flex-row" : "sm:flex-row-reverse") : ""}`}
                    >
                      {a.image_url && (
                        <img
                          src={a.image_url}
                          alt={a.title}
                          className="w-full sm:w-2/5 sm:h-48 aspect-video sm:aspect-auto object-cover shrink-0"
                        />
                      )}
                      <div className="px-5 py-4 flex-1 flex flex-col justify-between min-h-0 sm:h-48 overflow-hidden">
                        <div className="min-h-0">
                          <p className="font-op-mono text-[10px] font-bold text-muted uppercase tracking-widest mb-1">
                            {new Date(a.created_at).toLocaleDateString("en-US", {
                              weekday: "short", month: "long", day: "numeric", year: "numeric",
                            })}
                          </p>
                          <h3 className="text-[16px] font-bold text-foreground leading-snug line-clamp-2">{a.title}</h3>
                          {a.body && (
                            <p className="text-[14px] text-muted mt-2 leading-relaxed line-clamp-3">{a.body}</p>
                          )}
                        </div>
                        <button
                          onClick={() => setSelectedAnnouncement(a)}
                          className="mt-3 self-start text-[13px] font-bold text-accent hover:underline shrink-0"
                        >
                          See more →
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Date navigation + Book button */}
          {locationTab === "book" && (
            <>
            <div className="rounded-2xl border border-border bg-background shadow-sm px-4 sm:px-5 py-3.5 flex flex-wrap items-center gap-3">
              <button
                onClick={() => openBookingModal()}
                disabled={loadingCourts || courts.length === 0}
                className="rounded-full bg-accent text-white px-5 py-2 text-sm font-bold hover:opacity-90 transition-opacity disabled:opacity-40 shrink-0 shadow-sm"
              >
                + New booking
              </button>

              <div className="flex-1" />

              <div className="flex items-center gap-2">
                <button
                  onClick={prevDay}
                  className="rounded-full border border-border w-9 h-9 flex items-center justify-center text-foreground hover:border-accent hover:bg-accent/5 transition-colors shrink-0"
                >
                  ‹
                </button>
                <div className="relative text-center min-w-28 select-none">
                  <div className="text-[14px] font-bold text-foreground leading-tight whitespace-nowrap">{displayDateCompact(date)}</div>
                  <span className="font-op-mono text-[10px] font-bold text-accent tracking-[0.08em]">
                    {date === today ? "TODAY" : ""}
                  </span>
                  <input
                    type="date"
                    value={date}
                    min={today}
                    onChange={(e) => setDate(e.target.value)}
                    aria-label="Pick a date"
                    className="absolute inset-0 opacity-0 cursor-pointer"
                  />
                </div>
                <button
                  onClick={nextDay}
                  className="rounded-full border border-border w-9 h-9 flex items-center justify-center text-foreground hover:border-accent hover:bg-accent/5 transition-colors shrink-0"
                >
                  ›
                </button>
              </div>
            </div>

          {courtPaginator && <div className="flex justify-center">{courtPaginator}</div>}

          {loadingCourts || loadingSlots ? (
            <p className="text-sm text-muted py-8 text-center">Loading…</p>
          ) : courts.length === 0 ? (
            <div className="rounded-xl border border-border bg-background p-8 text-center shadow-sm">
              <p className="text-sm text-muted">No spaces available at this location.</p>
            </div>
          ) : (
            <>
              <div ref={gridRef} className="overflow-x-auto rounded-2xl border border-border shadow-sm relative">
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
                      <th className="px-3 sm:px-4 py-3.5 text-left font-op-mono text-[9px] uppercase tracking-[0.06em] text-muted font-bold w-24 sm:w-36 sticky left-0 bg-surface z-10 border-r border-border">
                        Time
                      </th>
                      {visibleCourts.map((court) => {
                        const u = court.custom_rate_unit ?? "hr";
                        const eyebrow = court.parent_court_id
                          ? "SHARED"
                          : u === "pax" ? "/PAX"
                          : u === "flat" ? "FLAT"
                          : null;
                        return (
                          <th
                            key={court.id}
                            className={`px-3 sm:px-4 py-3.5 text-center min-w-28 sm:min-w-36 ${visibleCourts.length > 1 ? "border-l border-border" : ""}`}
                          >
                            {eyebrow && (
                              <div className="font-op-mono text-[8px] font-bold text-accent uppercase tracking-widest">{eyebrow}</div>
                            )}
                            <span className="font-op-mono text-[12px] font-bold text-foreground tracking-[0.02em]">{court.name}</span>
                            {!court.is_active && (
                              <span className="ml-1.5 rounded-full bg-border/60 text-muted px-1.5 py-0.5 text-[9px] font-semibold normal-case tracking-normal">
                                inactive
                              </span>
                            )}
                            {hasPricing && (court.custom_day_rate != null || court.custom_night_rate != null) && (() => {
                              const ul = u === "pax" ? "/pax" : u === "flat" ? " flat" : "/hr";
                              return (
                                <div className="font-op-mono text-[9px] text-accent font-semibold mt-0.5 normal-case tracking-normal">
                                  {u === "flat"
                                    ? `₱${court.custom_day_rate?.toFixed(0)} flat`
                                    : [
                                        court.custom_day_rate != null && `₱${court.custom_day_rate.toFixed(0)}${ul}`,
                                        court.custom_night_rate != null && `₱${court.custom_night_rate.toFixed(0)}${ul} night`,
                                      ].filter(Boolean).join(" · ")
                                  }
                                </div>
                              );
                            })()}
                          </th>
                        );
                      })}
                    </tr>
                  </thead>
                  <tbody ref={tbodyRef}>
                    {visibleSlotIndices.map((absIdx, rowIdx) => {
                      const slot = slots[absIdx];
                      const slotH = parseInt(slot.start.slice(0, 2), 10);
                      const isNight = hasPricing && slotH >= nightHour;
                      return (
                        <tr
                          key={slot.start}
                          className={`${rowIdx === 0 ? "" : "border-t border-border"} ${isNight ? "bg-surface/30" : "bg-background"}`}
                        >
                          <td className={`px-3 sm:px-4 py-3 sticky left-0 z-10 border-r border-border whitespace-nowrap ${isNight ? "bg-surface/50" : "bg-background"}`}>
                            <div className="font-op-mono text-[11px] font-bold text-foreground tabular-nums">{fmtSlotTime(slot.start)}</div>
                            {hasPricing && (
                              <div className="text-[10px] text-muted mt-0.5 flex items-center gap-1">
                                ₱{(isNight ? selectedLocation!.night_rate : selectedLocation!.day_rate).toFixed(0)}{halfHour ? "/halfhr" : "/hr"}
                                {isNight && (
                                  <span className="rounded-full bg-border/50 px-1.5 py-px text-[9px] font-semibold uppercase tracking-widest text-muted">
                                    Night
                                  </span>
                                )}
                              </div>
                            )}
                          </td>
                          {visibleCourts.map((court) => {
                            const slotInfo = bookingSpanMap.get(court.id)?.get(absIdx);
                            // Skip — covered by a rowSpan from the booking's first slot
                            if (slotInfo && !slotInfo.isStart) return null;

                            const matchingBooking = slotInfo?.booking ?? null;
                            const isPending = matchingBooking?.status === "pending_payment";
                            const booked = !!matchingBooking;
                            const blockedByRelated = !booked && (isSlotBlockedByRelated(slots, courts, bookings, court, absIdx) || isSlotAdminBlocked(slots, blocks, court.id, absIdx));
                            const past = isPast(slots, date, absIdx);
                            const available = !booked && !blockedByRelated && !past && court.is_active;
                            const rowSpan = slotInfo?.rowSpan ?? 1;
                            return (
                              <td
                                key={court.id}
                                rowSpan={rowSpan}
                                onClick={() => available && openBookingModal(court.id, absIdx)}
                                className={`px-1.5 align-bottom transition-colors ${visibleCourts.length > 1 ? "border-l border-border" : ""} ${
                                  available
                                    ? "slot-open cursor-pointer"
                                    : isPending
                                    ? "slot-pending"
                                    : booked
                                    ? "slot-booked"
                                    : blockedByRelated
                                    ? "slot-closed"
                                    : "slot-past"
                                }`}
                              >
                                <div
                                  className={`w-full flex flex-col items-center justify-end gap-0.5 font-op-mono text-[8px] font-bold uppercase tracking-[0.06em] select-none ${rowSpan === 1 ? "py-2" : "py-1.5"} ${
                                    available
                                      ? "text-accent"
                                      : isPending
                                      ? "text-warning"
                                      : booked
                                      ? "text-white/40"
                                      : "text-muted"
                                  }`}
                                >
                                  {isPending ? "Pending" : booked ? "Booked" : blockedByRelated ? "Closed" : available ? "Open" : ""}
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
                <span className="flex items-center gap-1.5 font-op-mono text-[10px] text-muted uppercase tracking-[0.04em]">
                  <span className="w-2.5 h-2.5 rounded-sm bg-background shadow-[inset_2px_0_0_var(--color-accent)] shrink-0" />
                  Open
                </span>
                <span className="flex items-center gap-1.5 font-op-mono text-[10px] text-muted uppercase tracking-[0.04em]">
                  <span className="w-2.5 h-2.5 rounded-sm bg-slot-booked shrink-0" />
                  Booked
                </span>
                <span className="flex items-center gap-1.5 font-op-mono text-[10px] text-muted uppercase tracking-[0.04em]">
                  <span className="w-2.5 h-2.5 rounded-sm bg-slot-pending-bg shadow-[inset_2px_0_0_var(--color-warning)] shrink-0" />
                  Pending
                </span>
                <span className="flex items-center gap-1.5 font-op-mono text-[10px] text-muted uppercase tracking-[0.04em]">
                  <span className="w-2.5 h-2.5 rounded-sm slot-closed shrink-0" />
                  Closed
                </span>
                <span className="flex items-center gap-1.5 font-op-mono text-[10px] text-muted uppercase tracking-[0.04em] opacity-60">
                  <span className="w-2.5 h-2.5 rounded-sm bg-ink-100 shrink-0" />
                  Past
                </span>
                {date === today && (
                  <span className="flex items-center gap-1.5 font-op-mono text-[10px] text-muted uppercase tracking-[0.04em]">
                    <span className="inline-block w-4 h-px bg-red-500 shrink-0" />
                    Now
                  </span>
                )}
              </div>
            </>
          )}
            </>
          )}
        </>
      )}

      {/* Announcement detail modal */}
      {selectedAnnouncement && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
          onClick={() => setSelectedAnnouncement(null)}
        >
          <div
            className="w-full max-w-lg rounded-2xl bg-background shadow-xl overflow-hidden max-h-[90vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {selectedAnnouncement.image_url && (
              <img
                src={selectedAnnouncement.image_url}
                alt={selectedAnnouncement.title}
                className="w-full aspect-video object-cover shrink-0"
              />
            )}
            <div className="p-6 overflow-y-auto">
              <p className="font-op-mono text-[10px] font-bold text-muted uppercase tracking-widest mb-2">
                {new Date(selectedAnnouncement.created_at).toLocaleDateString("en-US", {
                  weekday: "long", month: "long", day: "numeric", year: "numeric",
                })}
              </p>
              <h2 className="text-[20px] font-bold text-foreground leading-snug">{selectedAnnouncement.title}</h2>
              {selectedAnnouncement.body && (
                <p className="text-[14px] text-muted mt-3 leading-relaxed whitespace-pre-wrap">{selectedAnnouncement.body}</p>
              )}
              <button
                onClick={() => setSelectedAnnouncement(null)}
                className="mt-6 w-full rounded-full border border-border py-2.5 text-[14px] font-bold text-foreground hover:bg-surface transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Booking modal */}
      {showModal && selectedLocation && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm p-0 sm:p-4"
          onClick={() => { if (!submitting) setShowModal(false); }}
        >
          <form
            onSubmit={onSubmit}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-t-2xl sm:rounded-2xl border border-border bg-background shadow-2xl max-h-[92vh] overflow-y-auto"
          >
            {/* Modal header */}
            <div className="px-6 pt-5 pb-0 flex items-center justify-between">
              <h2 className="text-[17px] font-extrabold text-foreground">Book a court</h2>
              <button
                type="button"
                disabled={submitting}
                onClick={() => setShowModal(false)}
                className="shrink-0 w-8 h-8 rounded-full bg-surface flex items-center justify-center text-muted hover:text-foreground transition-colors"
              >
                ×
              </button>
            </div>

            <div className="px-6 pt-3.5">
              <div className="rounded-xl bg-foreground px-3.5 py-3 flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-accent flex items-center justify-center shrink-0">
                  <Volleyball size={20} className="text-white" />
                </div>
                <div className="min-w-0">
                  <div className="font-display italic text-lg font-bold text-white leading-none truncate">
                    {modalCourt?.name ?? "Court"}
                  </div>
                  <div className="font-op-mono text-[10px] text-white/55 tracking-[0.06em] mt-1">
                    {displayDateCompact(date).toUpperCase()} · {slotRangeLabel(slots, form.startIdx, form.endIdx).toUpperCase()}
                  </div>
                </div>
              </div>
            </div>

            <div className="px-6 py-4 space-y-4">
              {/* Court selector */}
              <label className="block space-y-1.5">
                <span className="font-op-mono text-[10px] uppercase tracking-widest text-muted font-bold">
                  Court <span className="text-accent">*</span>
                </span>
                <select
                  value={form.court_id}
                  onChange={(e) => onCourtChange(e.target.value)}
                  className="w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-sm text-foreground focus:outline-none focus:border-accent"
                >
                  {courts.filter((c) => c.is_active).map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </label>

              {/* Time range */}
              <div className="grid grid-cols-2 gap-3">
                <label className="block space-y-1.5">
                  <span className="font-op-mono text-[10px] uppercase tracking-widest text-muted font-bold">
                    Start <span className="text-accent">*</span>
                  </span>
                  <select
                    value={form.startIdx}
                    onChange={(e) => onStartChange(Number(e.target.value))}
                    className="w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-sm text-foreground focus:outline-none focus:border-accent"
                  >
                    {visibleSlotIndices.map((i) => {
                      const past = isPast(slots, date, i);
                      const court = courts.find((c) => c.id === form.court_id);
                      const unavailable = !!court && isSlotUnavailable(slots, courts, bookings, blocks, court, i);
                      return (
                        <option key={i} value={i} disabled={past || unavailable}>
                          {fmtSlotTime(slots[i].start)}{past ? " (past)" : unavailable ? " (unavailable)" : ""}
                        </option>
                      );
                    })}
                  </select>
                </label>

                <label className="block space-y-1.5">
                  <span className="font-op-mono text-[10px] uppercase tracking-widest text-muted font-bold">
                    End <span className="text-accent">*</span>
                  </span>
                  <select
                    value={form.endIdx}
                    onChange={(e) => onEndChange(Number(e.target.value))}
                    className="w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-sm text-foreground focus:outline-none focus:border-accent"
                  >
                    {Array.from({ length: validMax - form.startIdx + 1 }, (_, k) => form.startIdx + k).map((i) => {
                      const rawEnd = slots[i].end;
                      return (
                        <option key={i} value={i}>{fmtSlotTime(rawEnd === "00:00" ? "00:00" : rawEnd)}</option>
                      );
                    })}
                  </select>
                </label>
              </div>

              {/* Split-rate policy notice */}
              {selectedLocation?.no_split_rate_booking && hasPricing && (
                <div className="rounded-xl bg-surface border border-border px-4 py-3 space-y-1">
                  <p className="font-op-mono text-[10px] font-bold text-foreground uppercase tracking-[0.08em]">Day &amp; Night booking policy</p>
                  <p className="text-[13px] text-muted leading-snug">
                    This court has separate day and night rates. Bookings cannot span the{" "}
                    <span className="font-semibold text-foreground">{fmtHour(nightHour)}</span> rate change —
                    please make two separate bookings if you need time on both sides.
                  </p>
                  <div className="flex gap-4 pt-1 flex-wrap">
                    {(() => {
                      const u = modalCourt?.custom_rate_unit ?? "hr";
                      const ul = u === "pax" ? "/pax" : u === "flat" ? " flat" : "/hr";
                      const dr = (modalCourt?.custom_day_rate   ?? selectedLocation.day_rate).toFixed(0);
                      const nr = (modalCourt?.custom_night_rate ?? selectedLocation.night_rate).toFixed(0);
                      return (
                        <>
                          <span className="text-[12px] text-muted">☀︎ Day: <span className="font-semibold text-foreground">₱{dr}{ul}</span></span>
                          {u !== "flat" && <span className="text-[12px] text-muted">☽ Night <span className="font-normal">(from {fmtHour(nightHour)})</span>: <span className="font-semibold text-foreground">₱{nr}{ul}</span></span>}
                        </>
                      );
                    })()}
                  </div>
                </div>
              )}

              {/* Duration + price summary */}
              <div className="flex items-center justify-between rounded-xl bg-surface px-4 py-3">
                <div>
                  <p className="font-op-mono text-[10px] text-muted font-bold uppercase tracking-[0.08em]">Duration</p>
                  <p className="font-display italic text-2xl font-bold text-foreground mt-0.5 leading-none">
                    {durationLabel}
                  </p>
                  <p className="font-op-mono text-[10px] text-muted mt-1">{slotRangeLabel(slots, form.startIdx, form.endIdx)}</p>
                </div>
                {totalPrice > 0 && (
                  <div className="text-right">
                    <p className="font-op-mono text-[10px] text-muted font-bold uppercase tracking-[0.08em]">Total</p>
                    <p className="font-display italic text-2xl font-bold text-accent mt-0.5 leading-none">₱{totalPrice.toFixed(2)}</p>
                  </div>
                )}
              </div>

              {showDownpaymentNotice && (
                <div className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-3">
                  <p className="text-[13px] font-semibold text-amber-800">
                    50% down payment required — ₱{(totalPrice / 2).toFixed(2)}
                  </p>
                  <p className="text-[12px] text-amber-700 mt-0.5">
                    Bookings over {selectedLocation?.downpayment_min_hours ?? 3} hours require a 50% down payment. The remaining balance is due on arrival. Note: the down payment is non-refundable if the booking is cancelled.
                  </p>
                </div>
              )}

              <div className="border-t border-border pt-4 space-y-4">
                {/* Player count — only shown for /pax courts */}
                {isPaxCourt && (
                  <div className="space-y-1.5">
                    <span className="font-op-mono text-[10px] uppercase tracking-widest text-muted font-bold block">
                      Number of players <span className="text-accent">*</span>
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setForm((f) => ({ ...f, player_count: Math.max(1, f.player_count - 1) }))}
                        className="w-9 h-9 rounded-lg border border-border text-foreground text-lg font-bold hover:bg-accent/10 hover:border-accent transition-colors shrink-0"
                      >
                        −
                      </button>
                      <input
                        type="number"
                        min={1}
                        max={50}
                        value={form.player_count}
                        onChange={(e) => {
                          const v = parseInt(e.target.value);
                          if (!isNaN(v) && v >= 1 && v <= 50) setForm((f) => ({ ...f, player_count: v }));
                        }}
                        className="flex-1 rounded-lg border border-border bg-surface px-3 py-2 text-base text-center font-semibold text-foreground focus:outline-none focus:border-accent"
                      />
                      <button
                        type="button"
                        onClick={() => setForm((f) => ({ ...f, player_count: Math.min(50, f.player_count + 1) }))}
                        className="w-9 h-9 rounded-lg border border-border text-foreground text-lg font-bold hover:bg-accent/10 hover:border-accent transition-colors shrink-0"
                      >
                        +
                      </button>
                    </div>
                    <p className="text-[11px] text-muted">
                      ₱{(modalCourt?.custom_day_rate ?? 0).toFixed(0)} × {form.player_count} {form.player_count === 1 ? "person" : "people"} = ₱{totalPrice.toFixed(2)}
                    </p>
                  </div>
                )}

                {/* Name */}
                <label className="block space-y-1.5">
                  <span className="font-op-mono text-[10px] uppercase tracking-widest text-muted font-bold">
                    Your name <span className="text-accent">*</span>
                  </span>
                  <input
                    ref={nameRef}
                    type="text"
                    required
                    maxLength={100}
                    value={form.booker_name}
                    onChange={(e) => setForm({ ...form, booker_name: e.target.value })}
                    className="w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-sm text-foreground focus:outline-none focus:border-accent"
                    placeholder="Jane Smith"
                  />
                </label>

                {/* Phone */}
                <label className="block space-y-1.5">
                  <span className="font-op-mono text-[10px] uppercase tracking-widest text-muted font-bold">
                    Phone number <span className="text-accent">*</span>
                  </span>
                  <input
                    type="tel"
                    required
                    value={form.booker_phone}
                    onChange={(e) => setForm({ ...form, booker_phone: e.target.value })}
                    className={`w-full rounded-lg border bg-surface px-3 py-2.5 text-sm text-foreground focus:outline-none focus:border-accent ${
                      form.booker_phone && !isValidPHPhone(form.booker_phone)
                        ? "border-accent"
                        : "border-border"
                    }`}
                    placeholder="09171234567"
                  />
                  {form.booker_phone && !isValidPHPhone(form.booker_phone) ? (
                    <p className="text-xs text-accent">Enter a valid PH number (09XXXXXXXXX or +639XXXXXXXXX).</p>
                  ) : (
                    <p className="text-xs text-muted">Philippine mobile number only.</p>
                  )}
                </label>

                {/* Email */}
                <label className="block space-y-1.5">
                  <span className="font-op-mono text-[10px] uppercase tracking-widest text-muted font-bold">
                    Email <span className="text-accent">*</span>
                  </span>
                  <input
                    type="email"
                    required
                    maxLength={200}
                    value={form.booker_email}
                    onChange={(e) => setForm({ ...form, booker_email: e.target.value })}
                    className="w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-sm text-foreground focus:outline-none focus:border-accent"
                    placeholder="jane@example.com"
                  />
                </label>

                {/* Notes */}
                <label className="block space-y-1.5">
                  <span className="font-op-mono text-[10px] uppercase tracking-widest text-muted font-bold">
                    Notes <span className="text-muted font-normal normal-case">(optional)</span>
                  </span>
                  <textarea
                    value={form.notes}
                    onChange={(e) => setForm({ ...form, notes: e.target.value })}
                    rows={2}
                    maxLength={500}
                    className="w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-sm text-foreground focus:outline-none focus:border-accent resize-none"
                    placeholder="Anything else we should know…"
                  />
                </label>
              </div>

              {formError && (
                <p className="text-sm text-accent font-semibold">{formError}</p>
              )}

              {availableStarts.length === 0 && (
                <p className="text-xs text-muted text-center">No available slots for {modalCourt?.name} on this date.</p>
              )}
            </div>

            {/* Modal footer */}
            <div className="px-6 py-4 border-t border-border flex gap-3">
              <button
                type="button"
                disabled={submitting}
                onClick={() => setShowModal(false)}
                className="flex-1 rounded-full border border-border py-2.5 text-sm font-bold text-foreground hover:bg-accent/5 hover:border-accent transition-colors disabled:opacity-40"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting || availableStarts.length === 0}
                className="flex-1 rounded-full bg-accent text-white py-2.5 text-sm font-bold hover:opacity-90 transition-opacity disabled:opacity-40 shadow-sm"
              >
                {submitting
                  ? "Booking…"
                  : totalPrice > 0
                  ? `Book · ₱${totalPrice.toFixed(2)}`
                  : "Confirm Booking"}
              </button>
            </div>
          </form>
        </div>
      )}

      </main>

      <Footer />

      {/* Map modal */}
      {showMap && selectedLocation?.latitude && selectedLocation?.longitude && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
          onClick={() => setShowMap(false)}
        >
          <div
            className="w-full max-w-lg space-y-4 rounded-2xl bg-background p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-display italic text-xl font-bold text-foreground">{selectedLocation.name}</h2>
                {selectedLocation.address && (
                  <p className="font-op-mono text-[10px] text-muted mt-0.5">{selectedLocation.address}</p>
                )}
              </div>
              <button
                onClick={() => setShowMap(false)}
                className="shrink-0 w-8 h-8 rounded-full bg-surface flex items-center justify-center text-muted hover:text-foreground transition-colors"
              >
                ×
              </button>
            </div>
            <MapView
              lat={selectedLocation.latitude}
              lng={selectedLocation.longitude}
              label={selectedLocation.name}
            />
            <a
              href={`https://www.google.com/maps?q=${selectedLocation.latitude},${selectedLocation.longitude}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 w-full rounded-full bg-foreground text-background px-4 py-2.5 text-sm font-bold hover:opacity-90 transition-opacity"
            >
              <MapPin size={14} />
              Open in Google Maps
            </a>
          </div>
        </div>
      )}
    </div>
  );
}

export default function BookPage() {
  return <BookingPage />;
}
