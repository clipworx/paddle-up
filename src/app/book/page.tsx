"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { MapPin, Megaphone, CalendarDays } from "lucide-react";
import { Logo } from "@/components/Logo";
import type { Court, Booking, Location } from "@/lib/types";
import { TIME_SLOTS } from "@/lib/types";
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
};

type ConfirmedBooking = {
  courtName: string;
  locationName: string;
  date: string;
  rangeLabel: string;
  totalPrice: number;
  booker_name: string;
  requiresPayment: boolean;
  paymentQrUrl: string | null;
  paymentAccountName: string | null;
  paymentAccountNumber: string | null;
  bookingId: string;
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

function isSlotBooked(bookings: Booking[], courtId: string, slotIdx: number): boolean {
  const slot = TIME_SLOTS[slotIdx];
  const slotEnd = normEnd(slot.end);
  return bookings.some((b) => {
    if (b.court_id !== courtId) return false;
    if (b.status !== "confirmed" && b.status !== "pending_payment") return false;
    const bStart = b.start_time.slice(0, 5);
    const bEnd = normEnd(b.end_time.slice(0, 5));
    return bStart < slotEnd && bEnd > slot.start;
  });
}

function isPast(dateIso: string, slotIdx: number): boolean {
  const slot = TIME_SLOTS[slotIdx];
  const now = new Date();
  const [y, m, d] = dateIso.split("-").map(Number);
  return new Date(y, m - 1, d, parseInt(slot.start, 10), 0) < now;
}

function isWeekend(dateIso: string): boolean {
  const [y, m, d] = dateIso.split("-").map(Number);
  const dow = new Date(y, m - 1, d).getDay();
  return dow === 0 || dow === 6;
}

function calcPrice(loc: Location, startIdx: number, endIdx: number, dateIso: string): number {
  const weekend = isWeekend(dateIso);
  const nightHour = parseInt(
    (weekend ? loc.weekend_night_start_time : loc.night_start_time).slice(0, 2),
    10
  );
  let total = 0;
  for (let i = startIdx; i <= endIdx; i++) {
    const hour = parseInt(TIME_SLOTS[i].start.slice(0, 2), 10);
    total += hour >= nightHour ? loc.night_rate : loc.day_rate;
  }
  return total;
}

function slotRangeLabel(startIdx: number, endIdx: number): string {
  const startH = parseInt(TIME_SLOTS[startIdx].start.slice(0, 2), 10);
  const rawEnd = TIME_SLOTS[endIdx].end;
  const endH = rawEnd === "00:00" ? 0 : parseInt(rawEnd.slice(0, 2), 10);
  return `${fmtHour(startH)} – ${fmtHour(endH)}`;
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
    <div className="space-y-6 text-center">
      <div>
        <h2 className="text-2xl font-bold text-foreground">Choose a location</h2>
        <p className="text-sm text-muted mt-1">
          Select a facility to see available courts and time slots.
        </p>
      </div>
      <div className={`grid gap-4 ${locations.length === 1 ? "max-w-sm mx-auto" : locations.length === 2 ? "sm:grid-cols-2 max-w-2xl mx-auto" : "sm:grid-cols-2 lg:grid-cols-3"}`}>
        {locations.map((loc) => (
          <button
            key={loc.id}
            onClick={() => onSelect(loc)}
            style={themeVarsStyle(loc.accent_color)}
            className="text-center rounded-xl border border-border bg-background p-6 shadow-sm hover:border-accent hover:shadow-md transition-all group flex flex-col items-center"
          >
            {loc.logo_url ? (
              <img
                src={loc.logo_url}
                alt={loc.name}
                className="h-16 w-16 object-contain rounded-xl border border-border bg-surface/50 mb-4"
              />
            ) : (
              <div className="h-16 w-16 rounded-xl border border-border bg-accent/10 flex items-center justify-center mb-4 shrink-0">
                <span className="text-2xl font-bold text-accent">{loc.name.charAt(0)}</span>
              </div>
            )}
            <h3 className="text-base font-bold text-foreground group-hover:text-accent transition-colors leading-tight">
              {loc.name}
            </h3>
            {loc.address && (
              <p className="text-xs text-muted mt-1 leading-snug">{loc.address}</p>
            )}
            <div className="flex items-center justify-center gap-2 mt-3 flex-wrap">
              <span className="rounded-full bg-accent/15 text-accent px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-widest">
                {loc.court_count} {loc.court_count === 1 ? "court" : "courts"}
              </span>
              {(loc.day_rate > 0 || loc.night_rate > 0) && (
                <span className="rounded-full bg-surface border border-border text-muted px-2.5 py-0.5 text-[10px] font-semibold">
                  From ₱{Math.min(loc.day_rate, loc.night_rate || loc.day_rate).toFixed(0)}/hr
                </span>
              )}
            </div>
            {loc.description && (
              <p className="text-sm text-muted mt-3 leading-relaxed line-clamp-2">
                {loc.description}
              </p>
            )}
            <span className="inline-block mt-4 text-xs font-semibold text-accent group-hover:underline">
              Book a court →
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Main page ─────────────────────────────────────────────────────────────────

export default function BookPage() {
  const today = formatDate(new Date());
  const [locations, setLocations] = useState<Location[] | null>(null);
  const [selectedLocation, setSelectedLocation] = useState<Location | null>(null);
  const [date, setDate] = useState(today);
  const [courts, setCourts] = useState<Court[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
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
        if (locs.length === 1) setSelectedLocation(locs[0]);
      })
      .catch(() => setLocations([]));
  }, []);

  useEffect(() => {
    if (!selectedLocation) return;
    setLoadingCourts(true);
    fetch(`/api/courts?location_id=${selectedLocation.id}`)
      .then((r) => r.json())
      .then((j) => setCourts(j.courts ?? []))
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

  useEffect(() => { fetchBookings(date); }, [date, fetchBookings]);

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
      // Is current time within the visible operating window?
      if (currentHour < openH || currentHour >= closeH) { setNowTop(null); return; }
      const rows = tbodyRef.current.rows;
      if (!rows.length) return;
      // Row index within the visible (filtered) rows
      const rowIdx = currentHour - openH;
      const fraction = now.getMinutes() / 60;
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
    for (let i = openH; i < closeH; i++) {
      if (!isPast(date, i) && !isSlotBooked(bookings, courtId, i)) return i;
    }
    return openH;
  }

  // Last valid end slot within operating hours, not crossing a booked slot
  function maxEndIdx(courtId: string, startIdx: number): number {
    for (let i = startIdx; i < closeH; i++) {
      if (isSlotBooked(bookings, courtId, i)) return i - 1;
    }
    return closeH - 1;
  }

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
    for (let i = form.startIdx; i <= form.endIdx; i++) {
      if (isPast(date, i)) return `${TIME_SLOTS[i].start} is in the past.`;
      if (isSlotBooked(bookings, form.court_id, i)) return `${TIME_SLOTS[i].start} is already booked.`;
    }
    return null;
  }

  async function onSubmit(e: React.SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!selectedLocation) return;
    const conflict = rangeConflict();
    if (conflict) { setFormError(conflict); return; }
    setFormError(null);
    setSubmitting(true);

    const res = await fetch("/api/bookings", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        court_id: form.court_id,
        date,
        start_time: TIME_SLOTS[form.startIdx].start + ":00",
        end_time: TIME_SLOTS[form.endIdx].end + ":00",
        booker_name: form.booker_name,
        booker_phone: form.booker_phone,
        booker_email: form.booker_email || null,
        player_count: 4,
        notes: form.notes || null,
      }),
    });

    const json = await res.json().catch(() => ({}));
    setSubmitting(false);

    if (!res.ok) {
      const msgs: Record<string, string> = {
        slot_taken: "That slot was just booked. Please pick another time.",
        name_required: "Name is required.",
        phone_required: "Phone number is required.",
        valid_email_required: "Enter a valid email address.",
        missing_fields: "Please fill in all required fields.",
      };
      setFormError(msgs[json.error] ?? json.error ?? "Booking failed.");
      return;
    }

    const courtName = courts.find((c) => c.id === form.court_id)?.name ?? "";
    const totalPrice = calcPrice(selectedLocation, form.startIdx, form.endIdx, date);
    setConfirmed({
      courtName,
      locationName: selectedLocation.name,
      date,
      rangeLabel: slotRangeLabel(form.startIdx, form.endIdx),
      totalPrice,
      booker_name: form.booker_name,
      requiresPayment: json.requires_payment ?? false,
      paymentQrUrl: json.payment_qr_url ?? null,
      paymentAccountName: json.payment_account_name ?? null,
      paymentAccountNumber: json.payment_account_number ?? null,
      bookingId: json.booking?.id ?? "",
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

  // Visible slot indices (filtered to operating hours)
  const visibleSlotIndices = Array.from({ length: closeH - openH }, (_, k) => openH + k);

  // Precompute booking spans so consecutive hours from the same booking merge into one cell
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
        const s = TIME_SLOTS[idx];
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
    ? calcPrice(selectedLocation, form.startIdx, form.endIdx, date)
    : 0;

  // Available start indices for the selected court within operating hours
  const availableStarts = visibleSlotIndices.filter(
    (i) => !isPast(date, i) && !isSlotBooked(bookings, form.court_id, i)
  );

  return (
    <div className="min-h-screen bg-surface">
      {/* ── Nav ── */}
      <nav className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/80">
        <div className="mx-auto max-w-6xl w-full px-4 h-14 flex items-center gap-4">
          <Link href="/" className="flex items-center gap-2 shrink-0 mr-2">
            <Logo size={28} />
            <span className="text-sm font-bold text-foreground hidden sm:block">Paddle Up</span>
          </Link>
          <div className="flex items-center gap-2 flex-1 min-w-0">
            {selectedLocation && (
              <>
                <span className="text-sm text-muted hidden sm:inline truncate">{selectedLocation.name}</span>
                <span className="text-border hidden sm:inline mx-1">·</span>
                <span className="rounded-full bg-accent/15 text-accent px-2 py-0.5 text-[10px] font-semibold uppercase tracking-widest hidden sm:inline-block shrink-0">
                  Court Booking
                </span>
              </>
            )}
          </div>
          <div className="flex items-center gap-4 shrink-0">
            {selectedLocation?.latitude && selectedLocation?.longitude && (
              <button
                onClick={() => setShowMap(true)}
                className="flex items-center gap-1 text-sm font-semibold text-muted hover:text-foreground transition-colors"
              >
                <MapPin size={13} />
                Map
              </button>
            )}
            {selectedLocation && (locations?.length ?? 0) > 1 && (
              <button
                onClick={() => { setSelectedLocation(null); setCourts([]); setBookings([]); }}
                className="text-sm font-semibold text-muted hover:text-foreground transition-colors"
              >
                ← Locations
              </button>
            )}
          </div>
        </div>
      </nav>

      <main className="mx-auto max-w-6xl w-full px-4 py-8 space-y-6">

      {/* Payment pending screen */}
      {confirmed?.requiresPayment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm rounded-xl border border-border bg-background p-6 shadow-xl space-y-4">
            <div>
              <div className="inline-block rounded-full bg-accent/15 text-accent px-3 py-0.5 text-[10px] font-semibold uppercase tracking-widest">
                Payment required
              </div>
              <h2 className="mt-2 text-lg font-bold text-foreground">Complete your booking</h2>
              <p className="text-xs text-muted mt-1">
                Scan the QR below and send the exact amount. Your slot will be confirmed once the location admin verifies the payment.
              </p>
            </div>

            <div className="rounded-lg border border-border bg-surface p-3 text-sm space-y-1">
              <p className="text-muted text-xs">Booking details</p>
              <p className="font-semibold text-foreground">{confirmed.courtName} · {confirmed.locationName}</p>
              <p className="text-foreground">{confirmed.rangeLabel} · {displayDate(confirmed.date)}</p>
              {confirmed.totalPrice > 0 && (
                <p className="font-bold text-accent text-base">₱{confirmed.totalPrice.toFixed(2)}</p>
              )}
              <p className="text-xs text-muted">Ref: {confirmed.bookingId.slice(0, 8).toUpperCase()}</p>
            </div>

            {confirmed.paymentQrUrl && (
              <div className="flex flex-col items-center gap-2">
                <img
                  src={confirmed.paymentQrUrl}
                  alt="Payment QR code"
                  className="w-48 h-48 object-contain rounded-lg border border-border"
                />
                {(confirmed.paymentAccountName || confirmed.paymentAccountNumber) && (
                  <div className="text-center text-sm">
                    {confirmed.paymentAccountName && (
                      <p className="font-semibold text-foreground">{confirmed.paymentAccountName}</p>
                    )}
                    {confirmed.paymentAccountNumber && (
                      <p className="text-muted">{confirmed.paymentAccountNumber}</p>
                    )}
                  </div>
                )}
              </div>
            )}

            <p className="text-xs text-muted text-center">
              After sending, show your payment screenshot to the staff on the day of your booking.
            </p>

            <button
              onClick={() => setConfirmed(null)}
              className="w-full rounded-lg bg-accent text-background py-2.5 text-sm font-semibold hover:bg-muted transition-colors"
            >
              Done
            </button>
          </div>
        </div>
      )}

      {/* Confirmation banner (no payment required) */}
      {confirmed && !confirmed.requiresPayment && (
        <div className="rounded-xl border border-green-300 bg-green-50 px-5 py-4 flex items-start justify-between gap-4">
          <div>
            <p className="font-semibold text-green-800 text-sm">Booking confirmed!</p>
            <p className="text-sm text-green-700 mt-0.5">
              {confirmed.courtName} · {confirmed.locationName} ·{" "}
              {confirmed.rangeLabel} · {displayDate(confirmed.date)}
              {confirmed.totalPrice > 0 && (
                <span className="font-semibold"> · ₱{confirmed.totalPrice.toFixed(2)}</span>
              )}
            </p>
            <p className="text-xs text-green-600 mt-0.5">
              See you on the court, {confirmed.booker_name}!
            </p>
          </div>
          <button
            onClick={() => setConfirmed(null)}
            className="text-green-600 hover:text-green-900 text-lg leading-none mt-0.5"
          >
            ×
          </button>
        </div>
      )}

      {locations === null && (
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
          {/* Location branding header */}
          <div className="rounded-xl border border-border bg-background shadow-sm px-5 py-4 flex items-center gap-4">
            {selectedLocation.logo_url && (
              <img
                src={selectedLocation.logo_url}
                alt={selectedLocation.name}
                className="h-14 w-14 sm:h-16 sm:w-16 object-contain rounded-xl border border-border bg-surface shrink-0"
              />
            )}
            <div className="min-w-0 flex-1">
              <h1 className="text-lg font-bold text-foreground leading-tight">{selectedLocation.name}</h1>
              {selectedLocation.address && (
                <p className="text-sm text-muted mt-0.5">{selectedLocation.address}</p>
              )}
              {selectedLocation.description && (
                <p className="text-sm text-muted mt-1 leading-snug line-clamp-2">{selectedLocation.description}</p>
              )}
            </div>
            {(selectedLocation.day_rate > 0 || selectedLocation.night_rate > 0) && (
              <div className="shrink-0 text-right hidden sm:block">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-muted">From</p>
                <p className="text-sm font-bold text-accent">
                  ₱{Math.min(selectedLocation.day_rate, selectedLocation.night_rate || selectedLocation.day_rate).toFixed(0)}/hr
                </p>
              </div>
            )}
          </div>

          {/* Tab nav */}
          <div className="flex items-center gap-1">
            <button
              onClick={() => setLocationTab("book")}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-[13.5px] font-semibold transition-colors ${
                locationTab === "book"
                  ? "bg-accent/15 text-accent"
                  : "text-muted hover:text-foreground hover:bg-surface"
              }`}
            >
              <CalendarDays size={14} /> Book a court
            </button>
            <button
              onClick={() => setLocationTab("announcements")}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-[13.5px] font-semibold transition-colors ${
                locationTab === "announcements"
                  ? "bg-accent/15 text-accent"
                  : "text-muted hover:text-foreground hover:bg-surface"
              }`}
            >
              <Megaphone size={14} /> Announcements
              {announcements.length > 0 && (
                <span className="rounded-full bg-accent text-white text-[10px] font-bold px-1.5 min-w-4.5 text-center leading-4.5">
                  {announcements.length}
                </span>
              )}
            </button>
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
                      className={`rounded-xl border border-border bg-background shadow-sm overflow-hidden flex flex-col ${a.image_url ? (i % 2 === 0 ? "sm:flex-row" : "sm:flex-row-reverse") : ""}`}
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
                          <p className="font-mono text-[11px] font-semibold text-muted uppercase tracking-widest mb-1">
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
                          className="mt-3 self-start text-[13px] font-semibold text-accent hover:underline shrink-0"
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
            <div className="rounded-xl border border-border bg-background shadow-sm px-4 py-3 flex flex-wrap items-center gap-3">
            <button
              onClick={() => openBookingModal()}
              disabled={loadingCourts || courts.length === 0}
              className="rounded-lg bg-accent text-background px-4 py-2 text-sm font-semibold hover:bg-muted transition-colors disabled:opacity-40 shrink-0"
            >
              + Book a Court
            </button>

            <div className="flex-1 hidden sm:block" />

            <div className="flex items-center gap-2 flex-1 sm:flex-none justify-end">
              <button
                onClick={prevDay}
                className="rounded-lg border border-border w-8 h-8 flex items-center justify-center text-foreground hover:bg-accent/10 hover:border-accent transition-colors text-base leading-none"
              >
                ‹
              </button>
              <input
                type="date"
                value={date}
                min={today}
                onChange={(e) => setDate(e.target.value)}
                className="rounded-lg border border-border bg-background px-3 py-1.5 text-sm text-foreground focus:outline-none focus:border-accent min-w-0"
              />
              <button
                onClick={nextDay}
                className="rounded-lg border border-border w-8 h-8 flex items-center justify-center text-foreground hover:bg-accent/10 hover:border-accent transition-colors text-base leading-none"
              >
                ›
              </button>
            </div>

            <span className="text-sm text-muted hidden md:block">{displayDate(date)}</span>
            {date === today && (
              <span className="rounded-full bg-accent/15 text-accent px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-widest hidden sm:inline-block">
                Today
              </span>
            )}
          </div>

          {loadingCourts || loadingSlots ? (
            <p className="text-sm text-muted py-8 text-center">Loading…</p>
          ) : courts.length === 0 ? (
            <div className="rounded-xl border border-border bg-background p-8 text-center shadow-sm">
              <p className="text-sm text-muted">No courts at this location.</p>
            </div>
          ) : (
            <>
              <div ref={gridRef} className="overflow-x-auto rounded-xl border border-border shadow-sm relative">
                {/* Now indicator */}
                {nowTop !== null && (
                  <div
                    style={{ top: `${nowTop}px` }}
                    className="absolute left-0 right-0 z-20 pointer-events-none flex items-center"
                  >
                    <div className="w-2.5 h-2.5 rounded-full bg-red-500 shrink-0 -ml-1" />
                    <div className="flex-1 h-0.5 bg-red-500 opacity-75" />
                  </div>
                )}

                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="border-b-2 border-border bg-surface">
                      <th className="px-2 sm:px-4 py-4 text-left text-[10px] uppercase tracking-widest text-muted font-bold w-24 sm:w-36 sticky left-0 bg-surface z-10 border-r border-border">
                        Time
                      </th>
                      {courts.map((court) => (
                        <th
                          key={court.id}
                          className={`px-2 sm:px-4 py-4 text-center text-sm font-bold text-foreground min-w-24 sm:min-w-36 ${courts.length > 1 ? "border-l border-border" : ""}`}
                        >
                          {court.name}
                          {!court.is_active && (
                            <span className="ml-2 text-[10px] font-semibold text-muted normal-case tracking-normal">
                              (inactive)
                            </span>
                          )}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody ref={tbodyRef}>
                    {visibleSlotIndices.map((absIdx, rowIdx) => {
                      const slot = TIME_SLOTS[absIdx];
                      const slotH = parseInt(slot.start.slice(0, 2), 10);
                      const isNight = hasPricing && slotH >= nightHour;
                      return (
                        <tr
                          key={slot.start}
                          className={`${rowIdx === 0 ? "" : "border-t border-border"} ${isNight ? "bg-surface/30" : "bg-background"}`}
                        >
                          <td className={`px-2 sm:px-4 py-3 sticky left-0 z-10 border-r border-border whitespace-nowrap ${isNight ? "bg-surface/30" : "bg-background"}`}>
                            <div className="text-sm font-semibold text-foreground">{fmtHour(slotH)}</div>
                            {hasPricing && (
                              <div className="text-[10px] text-muted mt-0.5 flex items-center gap-1">
                                ₱{(isNight ? selectedLocation!.night_rate : selectedLocation!.day_rate).toFixed(0)}/hr
                                {isNight && (
                                  <span className="rounded-full bg-surface border border-border px-1.5 py-px text-[9px] font-semibold uppercase tracking-widest text-muted">
                                    Night
                                  </span>
                                )}
                              </div>
                            )}
                          </td>
                          {courts.map((court) => {
                            const slotInfo = bookingSpanMap.get(court.id)?.get(absIdx);
                            // Skip — covered by a rowSpan from the booking's first slot
                            if (slotInfo && !slotInfo.isStart) return null;

                            const matchingBooking = slotInfo?.booking ?? null;
                            const isPending = matchingBooking?.status === "pending_payment";
                            const booked = !!matchingBooking;
                            const past = isPast(date, absIdx);
                            const available = !booked && !past && court.is_active;
                            const rowSpan = slotInfo?.rowSpan ?? 1;
                            return (
                              <td
                                key={court.id}
                                rowSpan={rowSpan}
                                onClick={() => available && openBookingModal(court.id, absIdx)}
                                className={`px-1.5 sm:px-2.5 align-middle transition-colors ${rowSpan > 1 ? "py-1.5" : "py-2"} ${courts.length > 1 ? "border-l border-border" : ""} ${
                                  available
                                      ? ""
                                      : isPending
                                      ? "bg-amber-50 text-amber-600 border border-amber-200"
                                      : booked
                                      ? "bg-amber-100"
                                      : "opacity-30 bg-surface text-muted"
                                }`}
                              >
                                <div
                                  className={`w-full h-full rounded-lg flex items-center justify-center text-xs font-semibold select-none transition-colors ${rowSpan === 1 ? "py-2.5" : "py-2"} ${
                                    available
                                      ? ""
                                      : isPending
                                      ? ""
                                      : booked
                                      ? ""
                                      : "opacity-30 bg-surface text-muted"
                                  }`}
                                >
                                  {isPending ? "Pending" : booked ? "Booked" : available ? "" : "—"}
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

              {/* Legend */}
              <div className="flex flex-wrap items-center gap-3">
                <span className="rounded-lg border border-dashed border-border px-3 py-1 text-xs font-semibold text-muted">
                  Available (click to book)
                </span>
                <span className="rounded-lg bg-surface text-muted border border-border px-3 py-1 text-xs font-semibold">
                  Booked
                </span>
                <span className="rounded-lg bg-amber-50 text-amber-600 border border-amber-200 px-3 py-1 text-xs font-semibold">
                  Pending payment
                </span>
                <span className="rounded-lg bg-surface text-muted border border-border px-3 py-1 text-xs font-semibold opacity-30">
                  Past / inactive
                </span>
                {date === today && (
                  <span className="flex items-center gap-1.5 text-xs text-muted">
                    <span className="inline-block w-4 h-0.5 bg-red-500 rounded-full" />
                    Current time
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
            className="w-full max-w-lg rounded-2xl border border-border bg-background shadow-xl overflow-hidden max-h-[90vh] flex flex-col"
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
              <p className="font-mono text-[11px] font-semibold text-muted uppercase tracking-widest mb-2">
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
                className="mt-6 w-full rounded-full border border-border py-2.5 text-[14px] font-semibold text-foreground hover:bg-surface transition-colors"
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
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
          onClick={() => { if (!submitting) setShowModal(false); }}
        >
          <form
            onSubmit={onSubmit}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md space-y-4 rounded-xl border border-border bg-background p-6 shadow-xl max-h-[90vh] overflow-y-auto"
          >
            <div>
              <div className="inline-block rounded-full bg-accent/15 text-accent px-3 py-0.5 text-[10px] font-semibold uppercase tracking-widest">
                Reserve
              </div>
              <h2 className="mt-2 text-lg font-bold text-foreground">Book a Court</h2>
              <p className="text-sm text-muted mt-0.5">{selectedLocation.name} · {displayDate(date)}</p>
            </div>

            {/* Court selector */}
            <label className="block space-y-1">
              <span className="text-xs uppercase tracking-wide text-muted font-semibold">
                Court <span className="text-accent">*</span>
              </span>
              <select
                value={form.court_id}
                onChange={(e) => onCourtChange(e.target.value)}
                className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground focus:outline-none focus:border-accent"
              >
                {courts.filter((c) => c.is_active).map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </label>

            {/* Time range */}
            <div className="grid grid-cols-2 gap-3">
              <label className="block space-y-1">
                <span className="text-xs uppercase tracking-wide text-muted font-semibold">
                  Start time <span className="text-accent">*</span>
                </span>
                <select
                  value={form.startIdx}
                  onChange={(e) => onStartChange(Number(e.target.value))}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground focus:outline-none focus:border-accent"
                >
                  {visibleSlotIndices.map((i) => {
                    const past = isPast(date, i);
                    const booked = isSlotBooked(bookings, form.court_id, i);
                    const h = parseInt(TIME_SLOTS[i].start.slice(0, 2), 10);
                    return (
                      <option key={i} value={i} disabled={past || booked}>
                        {fmtHour(h)}{past ? " (past)" : booked ? " (booked)" : ""}
                      </option>
                    );
                  })}
                </select>
              </label>

              <label className="block space-y-1">
                <span className="text-xs uppercase tracking-wide text-muted font-semibold">
                  End time <span className="text-accent">*</span>
                </span>
                <select
                  value={form.endIdx}
                  onChange={(e) => onEndChange(Number(e.target.value))}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground focus:outline-none focus:border-accent"
                >
                  {Array.from({ length: validMax - form.startIdx + 1 }, (_, k) => form.startIdx + k).map((i) => {
                    const rawEnd = TIME_SLOTS[i].end;
                    const endH = rawEnd === "00:00" ? 0 : parseInt(rawEnd.slice(0, 2), 10);
                    return (
                      <option key={i} value={i}>{fmtHour(endH)}</option>
                    );
                  })}
                </select>
              </label>
            </div>

            {/* Duration + price */}
            <div className="flex items-center gap-3 rounded-lg bg-surface px-4 py-2.5">
              <span className="text-sm text-muted">
                {form.endIdx - form.startIdx + 1} {form.endIdx - form.startIdx + 1 === 1 ? "hour" : "hours"}
                {" · "}
                {slotRangeLabel(form.startIdx, form.endIdx)}
              </span>
              {totalPrice > 0 && (
                <span className="ml-auto rounded-full bg-accent/15 text-accent px-3 py-0.5 text-sm font-bold">
                  ₱{totalPrice.toFixed(2)}
                </span>
              )}
            </div>

            {/* Name */}
            <label className="block space-y-1">
              <span className="text-xs uppercase tracking-wide text-muted font-semibold">
                Your name <span className="text-accent">*</span>
              </span>
              <input
                ref={nameRef}
                type="text"
                required
                value={form.booker_name}
                onChange={(e) => setForm({ ...form, booker_name: e.target.value })}
                className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground focus:outline-none focus:border-accent"
                placeholder="Jane Smith"
              />
            </label>

            {/* Phone */}
            <label className="block space-y-1">
              <span className="text-xs uppercase tracking-wide text-muted font-semibold">
                Phone number <span className="text-accent">*</span>
              </span>
              <input
                type="tel"
                required
                value={form.booker_phone}
                onChange={(e) => setForm({ ...form, booker_phone: e.target.value })}
                className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground focus:outline-none focus:border-accent"
                placeholder="+63 912 345 6789"
              />
            </label>

            {/* Email (optional) */}
            <label className="block space-y-1">
              <span className="text-xs uppercase tracking-wide text-muted font-semibold">
                Email <span className="text-muted font-normal normal-case">(optional)</span>
              </span>
              <input
                type="email"
                value={form.booker_email}
                onChange={(e) => setForm({ ...form, booker_email: e.target.value })}
                className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground focus:outline-none focus:border-accent"
                placeholder="jane@example.com"
              />
            </label>


            {/* Notes */}
            <label className="block space-y-1">
              <span className="text-xs uppercase tracking-wide text-muted font-semibold">
                Notes (optional)
              </span>
              <textarea
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                rows={2}
                className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground focus:outline-none focus:border-accent resize-none"
                placeholder="Anything else we should know…"
              />
            </label>

            {formError && (
              <p className="text-sm text-accent font-semibold">{formError}</p>
            )}

            <div className="flex gap-2 justify-end pt-1">
              <button
                type="button"
                disabled={submitting}
                onClick={() => setShowModal(false)}
                className="rounded-lg border border-border px-4 py-2 text-sm font-semibold text-foreground hover:bg-accent/10 hover:border-accent transition-colors disabled:opacity-40"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting || availableStarts.length === 0}
                className="rounded-lg bg-accent text-background px-4 py-2 text-sm font-semibold hover:bg-muted transition-colors disabled:opacity-40"
              >
                {submitting
                  ? "Booking…"
                  : totalPrice > 0
                  ? `Book · ₱${totalPrice.toFixed(2)}`
                  : "Book Court"}
              </button>
            </div>

            {availableStarts.length === 0 && (
              <p className="text-xs text-muted text-center">No available slots for {modalCourt?.name} on this date.</p>
            )}
          </form>
        </div>
      )}

      </main>

      {/* Map modal */}
      {showMap && selectedLocation?.latitude && selectedLocation?.longitude && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
          onClick={() => setShowMap(false)}
        >
          <div
            className="w-full max-w-lg space-y-4 rounded-xl border border-border bg-background p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-foreground">{selectedLocation.name}</h2>
                {selectedLocation.address && (
                  <p className="text-xs text-muted mt-0.5">{selectedLocation.address}</p>
                )}
              </div>
              <button
                onClick={() => setShowMap(false)}
                className="text-muted hover:text-foreground text-lg leading-none"
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
              className="flex items-center justify-center gap-2 w-full rounded-xl border border-border bg-surface px-4 py-2.5 text-sm font-semibold text-foreground hover:bg-accent/10 hover:border-accent hover:text-accent transition-colors"
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
