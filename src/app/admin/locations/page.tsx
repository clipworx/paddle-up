"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import dynamic from "next/dynamic";
import { AdminNav } from "@/components/AdminNav";
import type { Location } from "@/lib/types";

const MapPicker = dynamic(() => import("@/components/MapPicker"), {
  ssr: false,
  loading: () => <div className="rounded-xl border border-border bg-surface animate-pulse" style={{ height: 300 }} />,
});

type AdminLocation = Location & {
  courts: Array<{ id: string; name: string; description: string | null; is_active: boolean }>;
  court_count: number;
};

type CreateForm = {
  name: string;
  address: string;
  description: string;
  court_count: number;
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

const EMPTY_FORM: CreateForm = {
  name: "",
  address: "",
  description: "",
  court_count: 4,
};

function fmtH(h: number): string {
  if (h === 0) return "12:00 AM";
  if (h < 12) return `${h}:00 AM`;
  if (h === 12) return "12:00 PM";
  return `${h - 12}:00 PM`;
}

// All 24 hours for night-start and open selectors
const ALL_HOURS_24 = Array.from({ length: 24 }, (_, h) => ({
  value: `${String(h).padStart(2, "0")}:00`,
  label: fmtH(h),
  h,
}));

// Close-hour options: 1am through midnight (24)
const CLOSE_HOURS = Array.from({ length: 24 }, (_, i) => ({
  value: i + 1,
  label: i + 1 === 24 ? "12:00 AM (midnight)" : fmtH(i + 1),
}));

export default function AdminLocationsPage() {
  const router = useRouter();
  const [locations, setLocations] = useState<AdminLocation[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState<CreateForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [deactivatingId, setDeactivatingId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editPricingId, setEditPricingId] = useState<string | null>(null);
  const [pricingForm, setPricingForm] = useState<PricingForm>({ day_rate: "0", night_rate: "0", night_start_time: "18:00", open_hour: 0, close_hour: 24, weekend_night_start_time: "18:00", weekend_open_hour: 0, weekend_close_hour: 24 });
  const [pricingSaving, setPricingSaving] = useState(false);
  const [pricingError, setPricingError] = useState<string | null>(null);
  const [editMapId, setEditMapId] = useState<string | null>(null);
  const [mapLat, setMapLat] = useState<number | null>(null);
  const [mapLng, setMapLng] = useState<number | null>(null);
  const [mapSaving, setMapSaving] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);
  const [editCourt, setEditCourt] = useState<{ id: string; name: string; description: string } | null>(null);
  const [editCourtSaving, setEditCourtSaving] = useState(false);
  const [editCourtError, setEditCourtError] = useState<string | null>(null);
  const [togglingCourtId, setTogglingCourtId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch("/api/admin/locations");
      if (res.status === 401) { router.replace("/admin/login"); return; }
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to load locations");
      setLocations(json.locations ?? []);
    } catch (err) {
      setError((err as Error).message);
    }
  }, [router]);

  useEffect(() => { load(); }, [load]);

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    if (!form.name.trim()) { setFormError("Name is required."); return; }
    if (form.court_count < 1 || form.court_count > 16) {
      setFormError("Court count must be between 1 and 16.");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/admin/locations", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          address: form.address,
          description: form.description,
          court_count: form.court_count,
        }),
      });
      if (res.status === 401) { router.replace("/admin/login"); return; }
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || "Failed to create location");
      setShowCreate(false);
      setForm(EMPTY_FORM);
      await load();
    } catch (err) {
      setFormError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function onDeactivate(id: string, name: string) {
    if (!confirm(`Deactivate "${name}"? All its courts will also be deactivated and new bookings will be blocked.`)) return;
    setDeactivatingId(id);
    try {
      const res = await fetch(`/api/admin/locations/${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      if (res.status === 401) { router.replace("/admin/login"); return; }
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || "Deactivation failed");
      await load();
    } catch (err) {
      alert((err as Error).message);
    } finally {
      setDeactivatingId(null);
    }
  }

  function openPricing(loc: AdminLocation) {
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
    setPricingError(null);
    setEditPricingId(loc.id);
  }

  async function onSavePricing(e: FormEvent) {
    e.preventDefault();
    if (!editPricingId) return;
    setPricingSaving(true);
    setPricingError(null);
    try {
      const res = await fetch(`/api/admin/locations/${encodeURIComponent(editPricingId)}`, {
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
      setEditPricingId(null);
      await load();
    } catch (err) {
      setPricingError((err as Error).message);
    } finally {
      setPricingSaving(false);
    }
  }

  function openMap(loc: AdminLocation) {
    setMapLat(loc.latitude ?? null);
    setMapLng(loc.longitude ?? null);
    setMapError(null);
    setEditMapId(loc.id);
  }

  async function onSaveMap(e: FormEvent) {
    e.preventDefault();
    if (!editMapId) return;
    setMapSaving(true);
    setMapError(null);
    try {
      const res = await fetch(`/api/admin/locations/${encodeURIComponent(editMapId)}/coordinates`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ latitude: mapLat, longitude: mapLng }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || "Failed to save");
      setEditMapId(null);
      await load();
    } catch (err) {
      setMapError((err as Error).message);
    } finally {
      setMapSaving(false);
    }
  }

  async function onSaveEditCourt(e: FormEvent) {
    e.preventDefault();
    if (!editCourt) return;
    setEditCourtSaving(true);
    setEditCourtError(null);
    try {
      const res = await fetch(`/api/admin/courts/${encodeURIComponent(editCourt.id)}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: editCourt.name, description: editCourt.description }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || "Failed to update court");
      setEditCourt(null);
      await load();
    } catch (err) {
      setEditCourtError((err as Error).message);
    } finally {
      setEditCourtSaving(false);
    }
  }

  async function onToggleCourtActive(id: string, activate: boolean) {
    setTogglingCourtId(id);
    try {
      const res = await fetch(`/api/admin/courts/${encodeURIComponent(id)}`, {
        method: activate ? "PATCH" : "DELETE",
        ...(activate ? { headers: { "content-type": "application/json" }, body: JSON.stringify({ is_active: true }) } : {}),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || "Failed");
      await load();
    } catch (err) {
      alert((err as Error).message);
    } finally {
      setTogglingCourtId(null);
    }
  }

  async function onLogout() {
    await fetch("/api/admin/logout", { method: "POST" });
    router.replace("/admin/login");
  }

  return (
    <>
      <AdminNav onLogout={onLogout} />
      <main className="mx-auto max-w-5xl w-full px-4 py-10 space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">Locations</h1>
        <button
          onClick={() => { setShowCreate(true); setFormError(null); setForm(EMPTY_FORM); }}
          className="rounded-lg bg-accent text-background px-4 py-2 text-sm font-semibold hover:bg-muted transition-colors"
        >
          + Add location
        </button>
      </div>

      {error && (
        <p className="rounded-lg border border-accent/40 bg-accent/5 px-4 py-3 text-sm text-accent font-semibold">
          {error}
        </p>
      )}

      {locations === null && !error && (
        <p className="text-sm text-muted">Loading…</p>
      )}

      {locations !== null && locations.length === 0 && !showCreate && (
        <div className="rounded-xl border border-border bg-background/60 p-8 text-center shadow-sm space-y-3">
          <p className="text-sm text-muted">No locations yet.</p>
          <button
            onClick={() => setShowCreate(true)}
            className="rounded-lg bg-accent text-background px-5 py-2 text-sm font-semibold hover:bg-muted transition-colors"
          >
            Add your first location
          </button>
        </div>
      )}

      {locations !== null && locations.length > 0 && (
        <div className="space-y-4">
          {locations.map((loc) => (
            <div
              key={loc.id}
              className={`rounded-xl border bg-background/60 shadow-sm overflow-hidden ${
                loc.is_active ? "border-border" : "border-border opacity-60"
              }`}
            >
              <div className="flex items-center justify-between gap-4 px-5 py-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-bold text-foreground">{loc.name}</h3>
                    <span className="rounded-full bg-accent/15 text-accent px-2 py-0.5 text-[10px] font-semibold uppercase tracking-widest">
                      {loc.court_count} {loc.court_count === 1 ? "court" : "courts"}
                    </span>
                    {!loc.is_active && (
                      <span className="rounded-full bg-border text-muted px-2 py-0.5 text-[10px] font-semibold uppercase tracking-widest">
                        Inactive
                      </span>
                    )}
                  </div>
                  {loc.address && (
                    <p className="text-xs text-muted mt-0.5">{loc.address}</p>
                  )}
                  {loc.description && (
                    <p className="text-sm text-muted mt-1">{loc.description}</p>
                  )}
                  {(loc.day_rate > 0 || loc.night_rate > 0) && (
                    <p className="text-xs text-muted mt-1">
                      Day: ₱{loc.day_rate.toFixed(2)}/hr · Night: ₱{loc.night_rate.toFixed(2)}/hr
                      {" · Night from "}
                      {(() => {
                        const h = parseInt(loc.night_start_time.slice(0, 2), 10);
                        return h < 12 ? `${h}:00 AM` : h === 12 ? "12:00 PM" : `${h - 12}:00 PM`;
                      })()}
                    </p>
                  )}
                </div>
                <div className="flex gap-2 shrink-0 flex-wrap justify-end">
                  <button
                    onClick={() => setExpandedId(expandedId === loc.id ? null : loc.id)}
                    className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-accent/10 hover:border-accent transition-colors"
                  >
                    {expandedId === loc.id ? "Hide courts" : "Courts"}
                  </button>
                  <button
                    onClick={() => openPricing(loc)}
                    className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-accent/10 hover:border-accent transition-colors"
                  >
                    Settings
                  </button>
                  <button
                    onClick={() => openMap(loc)}
                    className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-accent/10 hover:border-accent transition-colors"
                  >
                    {loc.latitude ? "📍 Map" : "Set map"}
                  </button>
                  <Link
                    href={`/admin/bookings?location=${encodeURIComponent(loc.id)}`}
                    className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-accent/10 hover:border-accent transition-colors"
                  >
                    Bookings
                  </Link>
                  {loc.is_active && (
                    <button
                      onClick={() => onDeactivate(loc.id, loc.name)}
                      disabled={deactivatingId === loc.id}
                      className="rounded-lg border border-accent/50 bg-accent/5 px-3 py-1.5 text-xs font-semibold text-accent hover:bg-accent hover:text-background transition-colors disabled:opacity-40"
                    >
                      {deactivatingId === loc.id ? "Deactivating…" : "Deactivate"}
                    </button>
                  )}
                </div>
              </div>

              {expandedId === loc.id && loc.courts.length > 0 && (
                <div className="border-t border-border px-5 py-3 bg-surface space-y-2">
                  {loc.courts.map((c) => (
                    <div key={c.id} className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <span className={`text-sm font-semibold ${c.is_active ? "text-foreground" : "text-muted"}`}>
                          {c.name}
                        </span>
                        {!c.is_active && (
                          <span className="ml-2 text-xs text-muted">(inactive)</span>
                        )}
                        {c.description && (
                          <p className="text-xs text-muted truncate">{c.description}</p>
                        )}
                      </div>
                      <div className="flex gap-2 shrink-0">
                        <button
                          onClick={() => setEditCourt({ id: c.id, name: c.name, description: c.description ?? "" })}
                          className="rounded-lg border border-border px-3 py-1 text-xs font-semibold text-foreground hover:bg-accent/10 hover:border-accent transition-colors"
                        >
                          Edit
                        </button>
                        {c.is_active ? (
                          <button
                            onClick={() => onToggleCourtActive(c.id, false)}
                            disabled={togglingCourtId === c.id}
                            className="rounded-lg border border-accent/50 bg-accent/5 px-3 py-1 text-xs font-semibold text-accent hover:bg-accent hover:text-background transition-colors disabled:opacity-40"
                          >
                            {togglingCourtId === c.id ? "…" : "Deactivate"}
                          </button>
                        ) : (
                          <button
                            onClick={() => onToggleCourtActive(c.id, true)}
                            disabled={togglingCourtId === c.id}
                            className="rounded-lg border border-green-400 bg-green-50 px-3 py-1 text-xs font-semibold text-green-700 hover:bg-green-500 hover:text-white transition-colors disabled:opacity-40"
                          >
                            {togglingCourtId === c.id ? "…" : "Activate"}
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Pricing modal */}
      {editPricingId && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 p-4"
          onClick={() => { if (!pricingSaving) setEditPricingId(null); }}
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
              <p className="text-xs text-muted mt-1">Hourly rates charged to bookers at this location.</p>
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
                      const v = Number(e.target.value);
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
                    onChange={(e) => setPricingForm({ ...pricingForm, close_hour: Number(e.target.value) })}
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
                      const v = Number(e.target.value);
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
                    onChange={(e) => setPricingForm({ ...pricingForm, weekend_close_hour: Number(e.target.value) })}
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
                onClick={() => setEditPricingId(null)}
                className="rounded-lg border border-border px-4 py-2 text-sm font-semibold text-foreground hover:bg-accent/10 hover:border-accent transition-colors disabled:opacity-40"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={pricingSaving}
                className="rounded-lg bg-accent text-background px-4 py-2 text-sm font-semibold hover:bg-muted transition-colors disabled:opacity-40"
              >
                {pricingSaving ? "Saving…" : "Save"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Map modal */}
      {editMapId && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 p-4"
          onClick={() => { if (!mapSaving) setEditMapId(null); }}
        >
          <form
            onSubmit={onSaveMap}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-lg space-y-4 rounded-xl border border-border bg-background p-6 shadow-lg"
          >
            <div>
              <div className="inline-block rounded-full bg-accent/15 text-accent px-3 py-0.5 text-[10px] font-semibold uppercase tracking-widest">
                Map location
              </div>
              <h2 className="mt-2 text-lg font-bold text-foreground">Pin exact location</h2>
              <p className="text-xs text-muted mt-1">Click the map or drag the pin to mark the court entrance.</p>
            </div>

            <MapPicker lat={mapLat} lng={mapLng} onChange={(lat, lng) => { setMapLat(lat); setMapLng(lng); }} />

            {mapError && <p className="text-sm text-accent font-semibold">{mapError}</p>}

            <div className="flex gap-2 justify-end pt-1">
              <button
                type="button"
                disabled={mapSaving}
                onClick={() => setEditMapId(null)}
                className="rounded-lg border border-border px-4 py-2 text-sm font-semibold text-foreground hover:bg-accent/10 hover:border-accent transition-colors disabled:opacity-40"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={mapSaving || mapLat === null}
                className="rounded-lg bg-accent text-background px-4 py-2 text-sm font-semibold hover:bg-muted transition-colors disabled:opacity-40"
              >
                {mapSaving ? "Saving…" : "Save location"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Create location modal */}
      {showCreate && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 p-4"
          onClick={() => { if (!saving) setShowCreate(false); }}
        >
          <form
            onSubmit={onCreate}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md space-y-4 rounded-xl border border-border bg-background p-6 shadow-lg"
          >
            <div>
              <div className="inline-block rounded-full bg-accent/15 text-accent px-3 py-0.5 text-[10px] font-semibold uppercase tracking-widest">
                New location
              </div>
              <h2 className="mt-2 text-lg font-bold text-foreground">
                Add a location
              </h2>
              <p className="text-xs text-muted mt-1">
                Courts are created automatically and named Court 1, Court 2, etc.
              </p>
            </div>

            <label className="block space-y-1">
              <span className="text-xs uppercase tracking-wide text-muted font-semibold">
                Location name <span className="text-accent">*</span>
              </span>
              <input
                type="text"
                required
                autoFocus
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="e.g. Downtown Rec Center"
                className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground focus:outline-none focus:border-accent"
              />
            </label>

            <label className="block space-y-1">
              <span className="text-xs uppercase tracking-wide text-muted font-semibold">
                Address (optional)
              </span>
              <input
                type="text"
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
                placeholder="123 Main St, City, State"
                className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground focus:outline-none focus:border-accent"
              />
            </label>

            <label className="block space-y-1">
              <span className="text-xs uppercase tracking-wide text-muted font-semibold">
                Description (optional)
              </span>
              <textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                rows={2}
                placeholder="Indoor courts, free parking…"
                className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground focus:outline-none focus:border-accent resize-none"
              />
            </label>

            <label className="block space-y-1">
              <span className="text-xs uppercase tracking-wide text-muted font-semibold">
                Number of courts <span className="text-accent">*</span>
              </span>
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min={1}
                  max={16}
                  value={form.court_count}
                  onChange={(e) => setForm({ ...form, court_count: Number(e.target.value) })}
                  className="flex-1 accent-accent"
                />
                <span className="w-10 text-center font-bold text-foreground text-sm">
                  {form.court_count}
                </span>
              </div>
              <p className="text-xs text-muted">
                Creates {form.court_count} court{form.court_count !== 1 ? "s" : ""} named Court 1 – Court {form.court_count}
              </p>
            </label>

            {formError && (
              <p className="text-sm text-accent font-semibold">{formError}</p>
            )}

            <div className="flex gap-2 justify-end pt-1">
              <button
                type="button"
                disabled={saving}
                onClick={() => setShowCreate(false)}
                className="rounded-lg border border-border px-4 py-2 text-sm font-semibold text-foreground hover:bg-accent/10 hover:border-accent transition-colors disabled:opacity-40"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="rounded-lg bg-accent text-background px-4 py-2 text-sm font-semibold hover:bg-muted transition-colors disabled:opacity-40"
              >
                {saving ? "Creating…" : "Create location"}
              </button>
            </div>
          </form>
        </div>
      )}
    </main>

    {/* Edit court modal */}
    {editCourt && (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 p-4"
        onClick={() => { if (!editCourtSaving) setEditCourt(null); }}
      >
        <form
          onSubmit={onSaveEditCourt}
          onClick={(e) => e.stopPropagation()}
          className="w-full max-w-sm space-y-4 rounded-xl border border-border bg-background p-6 shadow-lg"
        >
          <div>
            <div className="inline-block rounded-full bg-accent/15 text-accent px-3 py-0.5 text-[10px] font-semibold uppercase tracking-widest">
              Edit court
            </div>
            <h2 className="mt-2 text-lg font-bold text-foreground">Update court details</h2>
          </div>

          <label className="block space-y-1">
            <span className="text-xs uppercase tracking-wide text-muted font-semibold">
              Court name <span className="text-accent">*</span>
            </span>
            <input
              type="text"
              required
              autoFocus
              value={editCourt.name}
              onChange={(e) => setEditCourt({ ...editCourt, name: e.target.value })}
              className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground focus:outline-none focus:border-accent"
            />
          </label>

          <label className="block space-y-1">
            <span className="text-xs uppercase tracking-wide text-muted font-semibold">Description</span>
            <textarea
              value={editCourt.description}
              onChange={(e) => setEditCourt({ ...editCourt, description: e.target.value })}
              rows={3}
              placeholder="Optional notes about this court…"
              className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground focus:outline-none focus:border-accent resize-none"
            />
          </label>

          {editCourtError && (
            <p className="text-sm text-accent font-semibold">{editCourtError}</p>
          )}

          <div className="flex gap-2 justify-end pt-1">
            <button
              type="button"
              disabled={editCourtSaving}
              onClick={() => setEditCourt(null)}
              className="rounded-lg border border-border px-4 py-2 text-sm font-semibold text-foreground hover:bg-accent/10 hover:border-accent transition-colors disabled:opacity-40"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={editCourtSaving}
              className="rounded-lg bg-accent text-background px-4 py-2 text-sm font-semibold hover:bg-muted transition-colors disabled:opacity-40"
            >
              {editCourtSaving ? "Saving…" : "Save"}
            </button>
          </div>
        </form>
      </div>
    )}
    </>
  );
}
