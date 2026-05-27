"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import dynamic from "next/dynamic";
import { Logo } from "@/components/Logo";
import { AdminNav } from "@/components/AdminNav";
import type { Court, Booking } from "@/lib/types";

const MapPicker = dynamic(() => import("@/components/MapPicker"), {
  ssr: false,
  loading: () => <div className="rounded-xl border border-border bg-surface animate-pulse" style={{ height: 300 }} />,
});

type Me = { username: string; role: string; location_id: string | null };
type LocationInfo = {
  id: string;
  name: string;
  address: string | null;
  day_rate: number;
  night_rate: number;
  night_start_time: string;
  open_hour: number;
  close_hour: number;
  weekend_night_start_time: string;
  weekend_open_hour: number;
  weekend_close_hour: number;
  payment_qr_url: string | null;
  payment_account_name: string | null;
  payment_account_number: string | null;
  latitude: number | null;
  longitude: number | null;
};

type PricingForm = {
  day_rate: string;
  night_rate: string;
  night_start_time: string;
  open_hour: number;
  close_hour: number;
  weekend_night_start_time: string;
  weekend_open_hour: number;
  weekend_close_hour: number;
};

function fmtH(h: number): string {
  if (h === 0) return "12:00 AM";
  if (h < 12) return `${h}:00 AM`;
  if (h === 12) return "12:00 PM";
  return `${h - 12}:00 PM`;
}

const ALL_HOURS_24 = Array.from({ length: 24 }, (_, h) => ({
  value: `${String(h).padStart(2, "0")}:00`,
  label: fmtH(h),
  h,
}));

const CLOSE_HOURS = Array.from({ length: 24 }, (_, i) => ({
  value: i + 1,
  label: i + 1 === 24 ? "12:00 AM (midnight)" : fmtH(i + 1),
}));

function formatDate(d: Date) {
  return d.toISOString().split("T")[0];
}
function fmtTime(t: string) {
  const [h, m] = t.split(":").map(Number);
  return `${h === 0 ? 12 : h > 12 ? h - 12 : h}:${String(m).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
}
function displayDate(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", {
    weekday: "short", month: "short", day: "numeric", year: "numeric",
  });
}

export default function MyLocationPage() {
  const router = useRouter();
  const today = formatDate(new Date(Date.now() - new Date().getTimezoneOffset() * 60000));
  const [me, setMe] = useState<Me | null>(null);
  const [location, setLocation] = useState<LocationInfo | null>(null);
  const [courts, setCourts] = useState<Court[] | null>(null);
  const [date, setDate] = useState(today);
  const [bookings, setBookings] = useState<Booking[] | null>(null);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [showAddCourt, setShowAddCourt] = useState(false);
  const [newCourtName, setNewCourtName] = useState("");
  const [addingCourt, setAddingCourt] = useState(false);
  const [addCourtError, setAddCourtError] = useState<string | null>(null);
  const [deactivatingCourtId, setDeactivatingCourtId] = useState<string | null>(null);
  const [showPricing, setShowPricing] = useState(false);
  const [pricingForm, setPricingForm] = useState<PricingForm>({ day_rate: "0", night_rate: "0", night_start_time: "18:00", open_hour: 0, close_hour: 24, weekend_night_start_time: "18:00", weekend_open_hour: 0, weekend_close_hour: 24 });
  const [pricingSaving, setPricingSaving] = useState(false);
  const [pricingError, setPricingError] = useState<string | null>(null);
  const [qrFile, setQrFile] = useState<File | null>(null);
  const [qrAccountName, setQrAccountName] = useState("");
  const [qrAccountNumber, setQrAccountNumber] = useState("");
  const [qrUploading, setQrUploading] = useState(false);
  const [qrError, setQrError] = useState<string | null>(null);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [mapLat, setMapLat] = useState<number | null>(null);
  const [mapLng, setMapLng] = useState<number | null>(null);
  const [mapSaving, setMapSaving] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);
  const courtNameRef = useRef<HTMLInputElement>(null);
  const qrFileRef = useRef<HTMLInputElement>(null);

  const loadMe = useCallback(async () => {
    const res = await fetch("/api/admin/me");
    if (res.status === 401) { router.replace("/admin/login"); return; }
    const json = await res.json();
    if (json.role !== "location_admin") {
      router.replace("/admin");
      return;
    }
    setMe(json);
    return json as Me;
  }, [router]);

  const loadLocation = useCallback(async (locationId: string) => {
    const res = await fetch("/api/admin/locations");
    const json = await res.json();
    const loc = (json.locations ?? []).find((l: LocationInfo) => l.id === locationId);
    if (loc) {
      setLocation(loc);
      setPricingForm({
        day_rate: String(loc.day_rate ?? 0),
        night_rate: String(loc.night_rate ?? 0),
        night_start_time: (loc.night_start_time ?? "18:00:00").slice(0, 5),
        open_hour: loc.open_hour ?? 0,
        close_hour: loc.close_hour ?? 24,
        weekend_night_start_time: (loc.weekend_night_start_time ?? "18:00:00").slice(0, 5),
        weekend_open_hour: loc.weekend_open_hour ?? 0,
        weekend_close_hour: loc.weekend_close_hour ?? 24,
      });
      setMapLat(loc.latitude ?? null);
      setMapLng(loc.longitude ?? null);
    }
  }, []);

  const loadCourts = useCallback(async (locationId: string) => {
    const res = await fetch(`/api/admin/locations`);
    const json = await res.json();
    const loc = (json.locations ?? []).find((l: { id: string; courts: Court[] }) => l.id === locationId);
    if (loc) setCourts(loc.courts ?? []);
  }, []);

  const loadBookings = useCallback(async (d: string) => {
    setBookings(null);
    const res = await fetch(`/api/bookings?date=${d}`);
    const json = await res.json();
    setBookings(json.bookings ?? []);
  }, []);

  useEffect(() => {
    loadMe().then((m) => {
      if (m?.location_id) {
        loadLocation(m.location_id);
        loadCourts(m.location_id);
      }
    });
  }, [loadMe, loadLocation, loadCourts]);

  useEffect(() => {
    if (me?.location_id) loadBookings(date);
  }, [date, me, loadBookings]);

  useEffect(() => {
    if (showAddCourt) setTimeout(() => courtNameRef.current?.focus(), 50);
  }, [showAddCourt]);

  const myBookings = bookings?.filter(
    (b) => courts?.some((c) => c.id === b.court_id)
  ) ?? [];

  function courtName(courtId: string) {
    return courts?.find((c) => c.id === courtId)?.name ?? courtId;
  }

  async function onAddCourt(e: FormEvent) {
    e.preventDefault();
    if (!me?.location_id) return;
    setAddCourtError(null);
    setAddingCourt(true);
    try {
      const res = await fetch("/api/admin/courts", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: newCourtName, location_id: me.location_id }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || "Failed to add court");
      setShowAddCourt(false);
      setNewCourtName("");
      if (me.location_id) loadCourts(me.location_id);
    } catch (err) {
      setAddCourtError((err as Error).message);
    } finally {
      setAddingCourt(false);
    }
  }

  async function onDeactivateCourt(id: string, name: string) {
    if (!confirm(`Deactivate "${name}"? It will no longer be available for booking.`)) return;
    setDeactivatingCourtId(id);
    try {
      const res = await fetch(`/api/admin/courts/${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || "Failed to deactivate");
      if (me?.location_id) loadCourts(me.location_id);
    } catch (err) {
      alert((err as Error).message);
    } finally {
      setDeactivatingCourtId(null);
    }
  }

  async function onCancelBooking(id: string) {
    if (!confirm("Cancel this booking?")) return;
    setCancellingId(id);
    try {
      const res = await fetch(`/api/admin/bookings/${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Cancel failed");
      loadBookings(date);
    } catch (err) {
      alert((err as Error).message);
    } finally {
      setCancellingId(null);
    }
  }

  async function onSavePricing(e: FormEvent) {
    e.preventDefault();
    if (!location) return;
    setPricingSaving(true);
    setPricingError(null);
    try {
      const res = await fetch(`/api/admin/locations/${encodeURIComponent(location.id)}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          day_rate: parseFloat(pricingForm.day_rate) || 0,
          night_rate: parseFloat(pricingForm.night_rate) || 0,
          night_start_time: pricingForm.night_start_time + ":00",
          open_hour: pricingForm.open_hour,
          close_hour: pricingForm.close_hour,
          weekend_night_start_time: pricingForm.weekend_night_start_time + ":00",
          weekend_open_hour: pricingForm.weekend_open_hour,
          weekend_close_hour: pricingForm.weekend_close_hour,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || "Failed to save pricing");
      setShowPricing(false);
      if (me?.location_id) loadLocation(me.location_id);
    } catch (err) {
      setPricingError((err as Error).message);
    } finally {
      setPricingSaving(false);
    }
  }

  async function onUploadQr(e: FormEvent) {
    e.preventDefault();
    if (!location || !qrFile) return;
    setQrUploading(true);
    setQrError(null);
    try {
      const fd = new FormData();
      fd.append("file", qrFile);
      fd.append("payment_account_name", qrAccountName);
      fd.append("payment_account_number", qrAccountNumber);
      const res = await fetch(`/api/admin/locations/${encodeURIComponent(location.id)}/qr`, {
        method: "POST",
        body: fd,
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || "Upload failed");
      setQrFile(null);
      if (qrFileRef.current) qrFileRef.current.value = "";
      if (me?.location_id) loadLocation(me.location_id);
    } catch (err) {
      setQrError((err as Error).message);
    } finally {
      setQrUploading(false);
    }
  }

  async function onRemoveQr() {
    if (!location || !confirm("Remove payment QR? Customers will no longer be prompted to pay.")) return;
    await fetch(`/api/admin/locations/${encodeURIComponent(location.id)}/qr`, { method: "DELETE" });
    if (me?.location_id) loadLocation(me.location_id);
  }

  async function onSaveCoordinates(e: FormEvent) {
    e.preventDefault();
    if (!location) return;
    setMapSaving(true);
    setMapError(null);
    try {
      const res = await fetch(`/api/admin/locations/${encodeURIComponent(location.id)}/coordinates`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ latitude: mapLat, longitude: mapLng }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || "Failed to save location");
      if (me?.location_id) loadLocation(me.location_id);
    } catch (err) {
      setMapError((err as Error).message);
    } finally {
      setMapSaving(false);
    }
  }

  async function onConfirmPayment(id: string) {
    setConfirmingId(id);
    try {
      const res = await fetch(`/api/admin/bookings/${encodeURIComponent(id)}/confirm`, { method: "POST" });
      if (!res.ok) throw new Error("Confirm failed");
      if (me?.location_id) loadBookings(date);
    } catch (err) {
      alert((err as Error).message);
    } finally {
      setConfirmingId(null);
    }
  }

  async function onLogout() {
    await fetch("/api/admin/logout", { method: "POST" });
    router.replace("/admin/login");
  }

  if (!me) return <main className="p-10 text-sm text-muted">Loading…</main>;

  return (
    <>
      <nav className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/80">
        <div className="mx-auto max-w-4xl w-full px-4 h-14 flex items-center gap-4">
          <Link href="/admin/my-location" className="flex items-center gap-2 shrink-0 mr-2">
            <Logo size={28} />
            <span className="text-sm font-bold text-foreground hidden sm:block">Paddle Up</span>
          </Link>
          <span className="text-xs font-semibold text-muted hidden sm:block">Location Admin</span>
          <div className="flex-1" />
          <Link
            href="/book"
            target="_blank"
            className="text-sm font-semibold text-muted hover:text-foreground transition-colors"
          >
            Booking page ↗
          </Link>
          <button
            onClick={onLogout}
            className="shrink-0 text-sm font-semibold text-muted hover:text-accent transition-colors"
          >
            Log out
          </button>
        </div>
      </nav>
      <main className="mx-auto max-w-4xl w-full px-4 py-10 space-y-10">
      <div>
        <h1 className="text-2xl font-bold text-foreground">{location?.name ?? "My Location"}</h1>
        {location?.address && <p className="text-sm text-muted mt-0.5">{location.address}</p>}
      </div>

      {/* ── Courts ── */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-foreground">Courts</h2>
          <button
            onClick={() => { setShowAddCourt(true); setAddCourtError(null); setNewCourtName(""); }}
            className="rounded-lg bg-accent text-background px-4 py-2 text-sm font-semibold hover:bg-muted transition-colors"
          >
            + Add court
          </button>
        </div>

        {courts === null ? (
          <p className="text-sm text-muted">Loading…</p>
        ) : courts.length === 0 ? (
          <div className="rounded-xl border border-border bg-background/60 p-6 text-center">
            <p className="text-sm text-muted">No courts yet. Add your first court above.</p>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {courts.map((court) => (
              <div
                key={court.id}
                className={`flex items-center justify-between rounded-xl border bg-background/60 px-4 py-3 ${
                  court.is_active ? "border-border" : "border-border opacity-50"
                }`}
              >
                <div>
                  <p className="font-semibold text-foreground text-sm">{court.name}</p>
                  {!court.is_active && (
                    <p className="text-xs text-muted">Inactive</p>
                  )}
                </div>
                {court.is_active && (
                  <button
                    onClick={() => onDeactivateCourt(court.id, court.name)}
                    disabled={deactivatingCourtId === court.id}
                    className="rounded-lg border border-accent/50 bg-accent/5 px-3 py-1.5 text-xs font-semibold text-accent hover:bg-accent hover:text-background transition-colors disabled:opacity-40"
                  >
                    {deactivatingCourtId === court.id ? "…" : "Deactivate"}
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ── Pricing ── */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-foreground">Pricing</h2>
            {location && (location.day_rate > 0 || location.night_rate > 0) ? (
              <p className="text-xs text-muted mt-0.5">
                Day ₱{location.day_rate.toFixed(2)}/hr · Night ₱{location.night_rate.toFixed(2)}/hr
                {" · Night from "}
                {(() => {
                  const h = parseInt((location.night_start_time ?? "18:00").slice(0, 2), 10);
                  return h < 12 ? `${h}:00 AM` : h === 12 ? "12:00 PM" : `${h - 12}:00 PM`;
                })()}
              </p>
            ) : (
              <p className="text-xs text-muted mt-0.5">No rates set — booking is free.</p>
            )}
          </div>
          <button
            onClick={() => { setPricingError(null); setShowPricing(true); }}
            className="rounded-lg border border-border px-4 py-2 text-sm font-semibold text-foreground hover:bg-accent/10 hover:border-accent transition-colors"
          >
            Edit rates
          </button>
        </div>
      </section>

      {/* ── Payment QR ── */}
      <section className="space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-foreground">Payment QR</h2>
            <p className="text-xs text-muted mt-0.5">
              {location?.payment_qr_url
                ? "Customers will be shown this QR after booking."
                : "No QR set — bookings are confirmed instantly without payment."}
            </p>
          </div>
          {location?.payment_qr_url && (
            <button
              onClick={onRemoveQr}
              className="shrink-0 text-xs font-semibold text-accent hover:underline"
            >
              Remove
            </button>
          )}
        </div>

        {location?.payment_qr_url && (
          <div className="flex items-start gap-4 rounded-xl border border-border bg-background/60 p-4">
            <img
              src={location.payment_qr_url}
              alt="Payment QR"
              className="w-28 h-28 object-contain rounded-lg border border-border shrink-0"
            />
            <div className="text-sm space-y-0.5">
              {location.payment_account_name && (
                <p className="font-semibold text-foreground">{location.payment_account_name}</p>
              )}
              {location.payment_account_number && (
                <p className="text-muted">{location.payment_account_number}</p>
              )}
              {!location.payment_account_name && !location.payment_account_number && (
                <p className="text-muted text-xs">No account info set.</p>
              )}
            </div>
          </div>
        )}

        <form onSubmit={onUploadQr} className="space-y-3 rounded-xl border border-border bg-background/60 p-4">
          <p className="text-xs font-semibold text-muted uppercase tracking-wide">
            {location?.payment_qr_url ? "Replace QR" : "Upload QR"}
          </p>
          <input
            ref={qrFileRef}
            type="file"
            accept="image/*"
            required
            onChange={(e) => setQrFile(e.target.files?.[0] ?? null)}
            className="block w-full text-sm text-muted file:mr-3 file:rounded-lg file:border-0 file:bg-accent/10 file:text-accent file:font-semibold file:px-3 file:py-1.5 file:text-xs hover:file:bg-accent/20 transition-colors"
          />
          <div className="grid grid-cols-2 gap-3">
            <input
              type="text"
              placeholder="Account name (e.g. Juan Dela Cruz)"
              value={qrAccountName}
              onChange={(e) => setQrAccountName(e.target.value)}
              className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:border-accent"
            />
            <input
              type="text"
              placeholder="GCash / Maya number"
              value={qrAccountNumber}
              onChange={(e) => setQrAccountNumber(e.target.value)}
              className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:border-accent"
            />
          </div>
          {qrError && <p className="text-xs text-accent font-semibold">{qrError}</p>}
          <button
            type="submit"
            disabled={qrUploading || !qrFile}
            className="rounded-lg bg-accent text-background px-4 py-2 text-sm font-semibold hover:bg-muted transition-colors disabled:opacity-40"
          >
            {qrUploading ? "Uploading…" : "Save QR"}
          </button>
        </form>
      </section>

      {/* ── Map Location ── */}
      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-bold text-foreground">Map location</h2>
          <p className="text-xs text-muted mt-0.5">
            Pin your exact location so customers can find you on the booking page.
          </p>
        </div>
        <form onSubmit={onSaveCoordinates} className="space-y-3 rounded-xl border border-border bg-background/60 p-4">
          <MapPicker lat={mapLat} lng={mapLng} onChange={(lat, lng) => { setMapLat(lat); setMapLng(lng); }} />
          {mapError && <p className="text-xs text-accent font-semibold">{mapError}</p>}
          <button
            type="submit"
            disabled={mapSaving || mapLat === null}
            className="rounded-lg bg-accent text-background px-4 py-2 text-sm font-semibold hover:bg-muted transition-colors disabled:opacity-40"
          >
            {mapSaving ? "Saving…" : "Save location"}
          </button>
        </form>
      </section>

      {/* ── Bookings ── */}
      <section className="space-y-4">
        <div className="flex items-center gap-3 flex-wrap">
          <h2 className="text-lg font-bold text-foreground">Bookings</h2>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                const d = new Date(date + "T12:00:00");
                d.setDate(d.getDate() - 1);
                setDate(formatDate(d));
              }}
              className="rounded-lg border border-border px-2 py-1 text-sm text-foreground hover:bg-accent/10 transition-colors"
            >
              ‹
            </button>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="rounded-lg border border-border bg-background px-3 py-1.5 text-sm text-foreground focus:outline-none focus:border-accent"
            />
            <button
              onClick={() => {
                const d = new Date(date + "T12:00:00");
                d.setDate(d.getDate() + 1);
                setDate(formatDate(d));
              }}
              className="rounded-lg border border-border px-2 py-1 text-sm text-foreground hover:bg-accent/10 transition-colors"
            >
              ›
            </button>
            {date === today && (
              <span className="rounded-full bg-accent/15 text-accent px-2 py-0.5 text-[10px] font-semibold uppercase tracking-widest">
                Today
              </span>
            )}
          </div>
        </div>

        {bookings === null ? (
          <p className="text-sm text-muted">Loading…</p>
        ) : myBookings.length === 0 ? (
          <div className="rounded-xl border border-border bg-background/60 p-6 text-center">
            <p className="text-sm text-muted">No bookings for {displayDate(date)}.</p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-border bg-background/60 shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-surface">
                  <tr className="text-left">
                    <th className="px-4 py-3 text-xs uppercase tracking-wide text-muted font-semibold">Court</th>
                    <th className="px-4 py-3 text-xs uppercase tracking-wide text-muted font-semibold">Time</th>
                    <th className="px-4 py-3 text-xs uppercase tracking-wide text-muted font-semibold">Booker</th>
                    <th className="px-4 py-3 text-xs uppercase tracking-wide text-muted font-semibold">Players</th>
                    <th className="px-4 py-3 text-xs uppercase tracking-wide text-muted font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {myBookings.map((b, i) => (
                    <tr
                      key={b.id}
                      className={`${i === 0 ? "" : "border-t border-border"} ${b.status === "pending_payment" ? "bg-yellow-50/60" : ""}`}
                    >
                      <td className="px-4 py-3 font-semibold text-foreground">
                        {courtName(b.court_id)}
                        {b.status === "pending_payment" && (
                          <span className="ml-2 rounded-full bg-yellow-100 text-yellow-700 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-widest">
                            Pending
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-foreground whitespace-nowrap">
                        {fmtTime(b.start_time)} – {fmtTime(b.end_time)}
                      </td>
                      <td className="px-4 py-3 text-foreground">
                        <div>{b.booker_name}</div>
                        <div className="text-xs text-muted">{b.booker_email}</div>
                      </td>
                      <td className="px-4 py-3 text-foreground text-center">{b.player_count}</td>
                      <td className="px-4 py-3">
                        <div className="flex gap-2">
                          {b.status === "pending_payment" && (
                            <button
                              onClick={() => onConfirmPayment(b.id)}
                              disabled={confirmingId === b.id}
                              className="rounded-lg border border-green-400 bg-green-50 px-3 py-1.5 text-xs font-semibold text-green-700 hover:bg-green-500 hover:text-white transition-colors disabled:opacity-40"
                            >
                              {confirmingId === b.id ? "…" : "Confirm payment"}
                            </button>
                          )}
                          <button
                            onClick={() => onCancelBooking(b.id)}
                            disabled={cancellingId === b.id}
                            className="rounded-lg border border-accent/50 bg-accent/5 px-3 py-1.5 text-xs font-semibold text-accent hover:bg-accent hover:text-background transition-colors disabled:opacity-40"
                          >
                            {cancellingId === b.id ? "…" : "Cancel"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>

      {/* Pricing modal */}
      {showPricing && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 p-4"
          onClick={() => { if (!pricingSaving) setShowPricing(false); }}
        >
          <form
            onSubmit={onSavePricing}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm space-y-4 rounded-xl border border-border bg-background p-6 shadow-lg"
          >
            <div>
              <div className="inline-block rounded-full bg-accent/15 text-accent px-3 py-0.5 text-[10px] font-semibold uppercase tracking-widest">
                Settings
              </div>
              <h2 className="mt-2 text-lg font-bold text-foreground">Court rates</h2>
              <p className="text-xs text-muted mt-1">Hourly rates shown to customers when booking.</p>
            </div>

            <label className="block space-y-1">
              <span className="text-xs uppercase tracking-wide text-muted font-semibold">Day rate (per hour)</span>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted">₱</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  autoFocus
                  value={pricingForm.day_rate}
                  onChange={(e) => setPricingForm({ ...pricingForm, day_rate: e.target.value })}
                  className="w-full rounded-lg border border-border bg-background pl-7 pr-3 py-2.5 text-sm text-foreground focus:outline-none focus:border-accent"
                />
              </div>
            </label>

            <label className="block space-y-1">
              <span className="text-xs uppercase tracking-wide text-muted font-semibold">Night rate (per hour)</span>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted">₱</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={pricingForm.night_rate}
                  onChange={(e) => setPricingForm({ ...pricingForm, night_rate: e.target.value })}
                  className="w-full rounded-lg border border-border bg-background pl-7 pr-3 py-2.5 text-sm text-foreground focus:outline-none focus:border-accent"
                />
              </div>
            </label>

            <div className="space-y-3">
              <p className="text-xs font-bold uppercase tracking-widest text-muted">Weekdays (Mon – Fri)</p>
              <label className="block space-y-1">
                <span className="text-xs uppercase tracking-wide text-muted font-semibold">Night rate starts at</span>
                <select
                  value={pricingForm.night_start_time}
                  onChange={(e) => setPricingForm({ ...pricingForm, night_start_time: e.target.value })}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground focus:outline-none focus:border-accent"
                >
                  {ALL_HOURS_24.map(({ value, label }) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="block space-y-1">
                  <span className="text-xs uppercase tracking-wide text-muted font-semibold">Open at</span>
                  <select
                    value={pricingForm.open_hour}
                    onChange={(e) => {
                      const v = parseInt(e.target.value, 10);
                      setPricingForm({ ...pricingForm, open_hour: v, close_hour: Math.max(pricingForm.close_hour, v + 1) });
                    }}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground focus:outline-none focus:border-accent"
                  >
                    {ALL_HOURS_24.map(({ value, label, h }) => (
                      <option key={value} value={h}>{label}</option>
                    ))}
                  </select>
                </label>
                <label className="block space-y-1">
                  <span className="text-xs uppercase tracking-wide text-muted font-semibold">Close at</span>
                  <select
                    value={pricingForm.close_hour}
                    onChange={(e) => setPricingForm({ ...pricingForm, close_hour: parseInt(e.target.value, 10) })}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground focus:outline-none focus:border-accent"
                  >
                    {CLOSE_HOURS.filter(({ value }) => value > pricingForm.open_hour).map(({ value, label }) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </select>
                </label>
              </div>
            </div>

            <div className="space-y-3">
              <p className="text-xs font-bold uppercase tracking-widest text-muted">Weekends (Sat – Sun)</p>
              <label className="block space-y-1">
                <span className="text-xs uppercase tracking-wide text-muted font-semibold">Night rate starts at</span>
                <select
                  value={pricingForm.weekend_night_start_time}
                  onChange={(e) => setPricingForm({ ...pricingForm, weekend_night_start_time: e.target.value })}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground focus:outline-none focus:border-accent"
                >
                  {ALL_HOURS_24.map(({ value, label }) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="block space-y-1">
                  <span className="text-xs uppercase tracking-wide text-muted font-semibold">Open at</span>
                  <select
                    value={pricingForm.weekend_open_hour}
                    onChange={(e) => {
                      const v = parseInt(e.target.value, 10);
                      setPricingForm({ ...pricingForm, weekend_open_hour: v, weekend_close_hour: Math.max(pricingForm.weekend_close_hour, v + 1) });
                    }}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground focus:outline-none focus:border-accent"
                  >
                    {ALL_HOURS_24.map(({ value, label, h }) => (
                      <option key={value} value={h}>{label}</option>
                    ))}
                  </select>
                </label>
                <label className="block space-y-1">
                  <span className="text-xs uppercase tracking-wide text-muted font-semibold">Close at</span>
                  <select
                    value={pricingForm.weekend_close_hour}
                    onChange={(e) => setPricingForm({ ...pricingForm, weekend_close_hour: parseInt(e.target.value, 10) })}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground focus:outline-none focus:border-accent"
                  >
                    {CLOSE_HOURS.filter(({ value }) => value > pricingForm.weekend_open_hour).map(({ value, label }) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </select>
                </label>
              </div>
            </div>

            {pricingError && (
              <p className="text-sm text-accent font-semibold">{pricingError}</p>
            )}

            <div className="flex gap-2 justify-end pt-1">
              <button
                type="button"
                disabled={pricingSaving}
                onClick={() => setShowPricing(false)}
                className="rounded-lg border border-border px-4 py-2 text-sm font-semibold text-foreground hover:bg-accent/10 hover:border-accent transition-colors disabled:opacity-40"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={pricingSaving}
                className="rounded-lg bg-accent text-background px-4 py-2 text-sm font-semibold hover:bg-muted transition-colors disabled:opacity-40"
              >
                {pricingSaving ? "Saving…" : "Save rates"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Add court modal */}
      {showAddCourt && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 p-4"
          onClick={() => { if (!addingCourt) setShowAddCourt(false); }}
        >
          <form
            onSubmit={onAddCourt}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm space-y-4 rounded-xl border border-border bg-background p-6 shadow-lg"
          >
            <div>
              <div className="inline-block rounded-full bg-accent/15 text-accent px-3 py-0.5 text-[10px] font-semibold uppercase tracking-widest">
                Add court
              </div>
              <h2 className="mt-2 text-lg font-bold text-foreground">New court</h2>
            </div>
            <label className="block space-y-1">
              <span className="text-xs uppercase tracking-wide text-muted font-semibold">
                Court name <span className="text-accent">*</span>
              </span>
              <input
                ref={courtNameRef}
                type="text"
                required
                value={newCourtName}
                onChange={(e) => setNewCourtName(e.target.value)}
                placeholder="e.g. Court 5"
                className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground focus:outline-none focus:border-accent"
              />
            </label>
            {addCourtError && (
              <p className="text-sm text-accent font-semibold">{addCourtError}</p>
            )}
            <div className="flex gap-2 justify-end">
              <button
                type="button"
                disabled={addingCourt}
                onClick={() => setShowAddCourt(false)}
                className="rounded-lg border border-border px-4 py-2 text-sm font-semibold text-foreground hover:bg-accent/10 hover:border-accent transition-colors disabled:opacity-40"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={addingCourt}
                className="rounded-lg bg-accent text-background px-4 py-2 text-sm font-semibold hover:bg-muted transition-colors disabled:opacity-40"
              >
                {addingCourt ? "Adding…" : "Add court"}
              </button>
            </div>
          </form>
        </div>
      )}
    </main>
    </>
  );
}
