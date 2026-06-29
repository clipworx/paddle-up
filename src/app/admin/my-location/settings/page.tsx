"use client";

import React, { useRef, useState } from "react";
import dynamic from "next/dynamic";
import { useLocationAdminContext } from "@/contexts/LocationAdminContext";
import { SubscriptionBanner } from "@/components/SubscriptionBanner";
import { THEMES } from "@/lib/themes";
import { fmtH, ALL_HOURS_24, CLOSE_HOURS } from "@/lib/admin-utils";
import type { PricingForm } from "@/lib/admin-types";

const MapPicker = dynamic(() => import("@/components/MapPicker"), {
  ssr: false,
  loading: () => <div className="rounded-xl border border-border bg-surface animate-pulse" style={{ height: 300 }} />,
});

async function extractQrFromImage(file: File): Promise<{ file: File; previewUrl: string } | null> {
  const jsQR = (await import("jsqr")).default;
  return new Promise((resolve) => {
    const img = new Image();
    const objUrl = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(objUrl);
      const canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(img, 0, 0);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const qr = jsQR(imageData.data, imageData.width, imageData.height);
      if (!qr) { resolve(null); return; }
      const { topLeftCorner: tl, topRightCorner: tr, bottomRightCorner: br, bottomLeftCorner: bl } = qr.location;
      const pad = Math.max(img.width, img.height) * 0.04;
      const x = Math.max(0, Math.min(tl.x, bl.x) - pad);
      const y = Math.max(0, Math.min(tl.y, tr.y) - pad);
      const w = Math.min(canvas.width, Math.max(tr.x, br.x) + pad) - x;
      const h = Math.min(canvas.height, Math.max(bl.y, br.y) + pad) - y;
      const crop = document.createElement("canvas");
      crop.width = w; crop.height = h;
      crop.getContext("2d")!.drawImage(canvas, x, y, w, h, 0, 0, w, h);
      const previewUrl = crop.toDataURL("image/png");
      crop.toBlob((blob) => {
        if (!blob) { resolve(null); return; }
        resolve({ file: new File([blob], "qr.png", { type: "image/png" }), previewUrl });
      }, "image/png");
    };
    img.onerror = () => resolve(null);
    img.src = objUrl;
  });
}

export default function SettingsPage() {
  const { me, location, loadLocation } = useLocationAdminContext();

  // Info edit state
  const [editInfo, setEditInfo] = useState<{ name: string; address: string; description: string; contact_email: string; contact_phone: string } | null>(null);
  const [editInfoSaving, setEditInfoSaving] = useState(false);
  const [editInfoError, setEditInfoError] = useState<string | null>(null);

  // Pricing state
  const [showPricing, setShowPricing] = useState(false);
  const [pricingForm, setPricingForm] = useState<PricingForm>({
    day_rate: "0", night_rate: "0", night_start_time: "18:00",
    open_hour: 0, close_hour: 24,
    weekend_night_start_time: "18:00", weekend_open_hour: 0, weekend_close_hour: 24,
  });
  const [pricingSaving, setPricingSaving] = useState(false);
  const [pricingError, setPricingError] = useState<string | null>(null);

  // QR state
  const [qrFile, setQrFile] = useState<File | null>(null);
  const [qrPreviewUrl, setQrPreviewUrl] = useState<string | null>(null);
  const [qrProcessing, setQrProcessing] = useState(false);
  const [qrAccountName, setQrAccountName] = useState("");
  const [qrAccountNumber, setQrAccountNumber] = useState("");
  const [qrUploading, setQrUploading] = useState(false);
  const [qrError, setQrError] = useState<string | null>(null);
  const qrFileRef = useRef<HTMLInputElement>(null);

  // Map state
  const [mapLat, setMapLat] = useState<number | null>(null);
  const [mapLng, setMapLng] = useState<number | null>(null);
  const [mapSaving, setMapSaving] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);

  // Logo state
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoUploading, setLogoUploading] = useState(false);
  const [logoError, setLogoError] = useState<string | null>(null);
  const logoFileRef = useRef<HTMLInputElement>(null);

  // Facility photo state
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoUploading, setPhotoUploading] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const photoFileRef = useRef<HTMLInputElement>(null);

  // Color state
  const [colorSaving, setColorSaving] = useState(false);
  const [colorError, setColorError] = useState<string | null>(null);
  const [selectedColor, setSelectedColor] = useState<string | null>(null);

  // Booking policy state
  const [requireDownpayment, setRequireDownpayment]     = useState(false);
  const [downpaymentMinHours, setDownpaymentMinHours]   = useState(3);
  const [noSplitRate, setNoSplitRate]                   = useState(false);
  const [allowHalfHour, setAllowHalfHour]               = useState(false);
  const [autoExpirePending, setAutoExpirePending]       = useState(false);
  const [pendingExpiryHours, setPendingExpiryHours]     = useState(5);
  const [policySaving, setPolicySaving]                 = useState(false);
  const [policyError, setPolicyError]                   = useState<string | null>(null);
  const [policySuccess, setPolicySuccess]               = useState(false);

  // Sync state from location once loaded
  React.useEffect(() => {
    if (!location) return;
    setPricingForm({
      day_rate: String(location.day_rate ?? 0),
      night_rate: String(location.night_rate ?? 0),
      night_start_time: (location.night_start_time ?? "18:00:00").slice(0, 5),
      open_hour: location.open_hour ?? 0,
      close_hour: location.close_hour ?? 24,
      weekend_night_start_time: (location.weekend_night_start_time ?? "18:00:00").slice(0, 5),
      weekend_open_hour: location.weekend_open_hour ?? 0,
      weekend_close_hour: location.weekend_close_hour ?? 24,
    });
    setMapLat(location.latitude ?? null);
    setMapLng(location.longitude ?? null);
    setSelectedColor(location.accent_color ?? null);
    setQrAccountName(location.payment_account_name ?? "");
    setQrAccountNumber(location.payment_account_number ?? "");
    setRequireDownpayment(location.require_downpayment ?? false);
    setDownpaymentMinHours(location.downpayment_min_hours ?? 3);
    setNoSplitRate(location.no_split_rate_booking ?? false);
    setAllowHalfHour(location.allow_half_hour_bookings ?? false);
    setAutoExpirePending(location.auto_expire_pending_payment ?? false);
    setPendingExpiryHours(location.pending_payment_expiry_hours ?? 5);
  }, [location]);

  async function onSavePolicies() {
    if (!location) return;
    setPolicySaving(true);
    setPolicyError(null);
    setPolicySuccess(false);
    try {
      const res = await fetch(`/api/admin/locations/${encodeURIComponent(location.id)}`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          require_downpayment: requireDownpayment,
          downpayment_min_hours: downpaymentMinHours,
          no_split_rate_booking: noSplitRate,
          allow_half_hour_bookings: allowHalfHour,
          auto_expire_pending_payment: autoExpirePending,
          pending_payment_expiry_hours: pendingExpiryHours,
        }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error ?? "Failed to save");
      }
      setPolicySuccess(true);
      setTimeout(() => setPolicySuccess(false), 2500);
      if (me?.location_id) loadLocation(me.location_id);
    } catch (err) {
      setPolicyError((err as Error).message);
    } finally {
      setPolicySaving(false);
    }
  }

  async function onSaveInfo(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!location || !editInfo) return;
    if (!editInfo.name.trim()) { setEditInfoError("Name is required."); return; }
    setEditInfoSaving(true);
    setEditInfoError(null);
    try {
      const res = await fetch(`/api/admin/locations/${encodeURIComponent(location.id)}`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: editInfo.name,
          address: editInfo.address,
          description: editInfo.description,
          contact_email: editInfo.contact_email,
          contact_phone: editInfo.contact_phone,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || "Failed to save");
      setEditInfo(null);
      if (me?.location_id) loadLocation(me.location_id);
    } catch (err) {
      setEditInfoError((err as Error).message);
    } finally {
      setEditInfoSaving(false);
    }
  }

  async function onSavePricing(e: React.FormEvent<HTMLFormElement>) {
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

  async function onUploadQr(e: React.FormEvent<HTMLFormElement>) {
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
      setQrPreviewUrl(null);
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

  async function onUploadLogo(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!location || !logoFile) return;
    setLogoUploading(true);
    setLogoError(null);
    try {
      const fd = new FormData();
      fd.append("file", logoFile);
      const res = await fetch(`/api/admin/locations/${encodeURIComponent(location.id)}/logo`, {
        method: "POST",
        body: fd,
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || "Upload failed");
      setLogoFile(null);
      if (logoFileRef.current) logoFileRef.current.value = "";
      if (me?.location_id) loadLocation(me.location_id);
    } catch (err) {
      setLogoError((err as Error).message);
    } finally {
      setLogoUploading(false);
    }
  }

  async function onRemoveLogo() {
    if (!location || !confirm("Remove logo?")) return;
    await fetch(`/api/admin/locations/${encodeURIComponent(location.id)}/logo`, { method: "DELETE" });
    if (me?.location_id) loadLocation(me.location_id);
  }

  async function onUploadPhoto(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!location || !photoFile) return;
    setPhotoUploading(true);
    setPhotoError(null);
    try {
      const fd = new FormData();
      fd.append("file", photoFile);
      const res = await fetch(`/api/admin/locations/${encodeURIComponent(location.id)}/photo`, {
        method: "POST",
        body: fd,
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || "Upload failed");
      setPhotoFile(null);
      if (photoFileRef.current) photoFileRef.current.value = "";
      if (me?.location_id) loadLocation(me.location_id);
    } catch (err) {
      setPhotoError((err as Error).message);
    } finally {
      setPhotoUploading(false);
    }
  }

  async function onRemovePhoto() {
    if (!location || !confirm("Remove facility photo?")) return;
    await fetch(`/api/admin/locations/${encodeURIComponent(location.id)}/photo`, { method: "DELETE" });
    if (me?.location_id) loadLocation(me.location_id);
  }

  async function onSaveColor() {
    if (!location || !selectedColor) return;
    setColorSaving(true);
    setColorError(null);
    try {
      const res = await fetch(`/api/admin/locations/${encodeURIComponent(location.id)}`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ accent_color: selectedColor }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || "Failed to save color");
      if (me?.location_id) loadLocation(me.location_id);
    } catch (err) {
      setColorError((err as Error).message);
    } finally {
      setColorSaving(false);
    }
  }

  async function onSaveCoordinates(e: React.FormEvent<HTMLFormElement>) {
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

  return (
    <>
      <main className="mx-auto max-w-4xl w-full px-4 py-6 sm:py-8 space-y-6">
        <SubscriptionBanner location={location} />

        {/* ── Settings section ── */}
        <div className="space-y-4">

          {/* Location info */}
          <div className="rounded-xl border border-border bg-background p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-sm font-bold text-foreground">Location info</h2>
                <div className="mt-2 space-y-0.5">
                  <p className="text-sm font-semibold text-foreground">{location?.name}</p>
                  {location?.address && <p className="text-xs text-muted">{location.address}</p>}
                  {location?.description && <p className="text-xs text-muted">{location.description}</p>}
                  {(location?.contact_email || location?.contact_phone) && (
                    <p className="text-xs text-muted">
                      {[location.contact_phone, location.contact_email].filter(Boolean).join(" · ")}
                    </p>
                  )}
                </div>
              </div>
              {location && (
                <button
                  onClick={() => {
                    setEditInfoError(null);
                    setEditInfo({
                      name: location.name,
                      address: location.address ?? "",
                      description: location.description ?? "",
                      contact_email: location.contact_email ?? "",
                      contact_phone: location.contact_phone ?? "",
                    });
                  }}
                  className="shrink-0 rounded-lg border border-border px-4 py-2 text-sm font-semibold text-foreground hover:bg-accent/10 hover:border-accent transition-colors"
                >
                  Edit
                </button>
              )}
            </div>
          </div>

          {/* Pricing */}
          <div className="rounded-xl border border-border bg-background p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-sm font-bold text-foreground">Pricing</h2>
                {location && (location.day_rate > 0 || location.night_rate > 0) ? (
                  <div className="mt-2 space-y-0.5">
                    <p className="text-xs text-muted">
                      Day rate: <span className="text-foreground font-semibold">₱{location.day_rate.toFixed(2)}/hr</span>
                      {" · "}
                      Night rate: <span className="text-foreground font-semibold">₱{location.night_rate.toFixed(2)}/hr</span>
                    </p>
                    <p className="text-xs text-muted">
                      Weekday hours: <span className="text-foreground font-medium">{fmtH(location.open_hour)} – {fmtH(location.close_hour)}</span>
                      {" · "}
                      Weekend hours: <span className="text-foreground font-medium">{fmtH(location.weekend_open_hour)} – {fmtH(location.weekend_close_hour)}</span>
                    </p>
                  </div>
                ) : (
                  <p className="text-xs text-muted mt-1">No rates set — booking is free.</p>
                )}
              </div>
              <button
                onClick={() => { setPricingError(null); setShowPricing(true); }}
                className="shrink-0 rounded-lg border border-border px-4 py-2 text-sm font-semibold text-foreground hover:bg-accent/10 hover:border-accent transition-colors"
              >
                Edit rates
              </button>
            </div>
          </div>

          {/* Payment QR */}
          <div className="rounded-xl border border-border bg-background p-5 space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-sm font-bold text-foreground">Payment QR</h2>
                <p className="text-xs text-muted mt-1">
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
              <div className="flex items-start gap-4 rounded-xl border border-border bg-surface p-4">
                <img
                  src={location.payment_qr_url}
                  alt="Payment QR"
                  className="w-24 h-24 object-contain rounded-lg border border-border shrink-0"
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

            <form onSubmit={onUploadQr} className="space-y-3 rounded-xl border border-border bg-surface p-4">
              <p className="text-xs font-semibold text-muted uppercase tracking-wide">
                {location?.payment_qr_url ? "Replace QR" : "Upload QR"}
              </p>
              <input
                ref={qrFileRef}
                type="file"
                accept="image/*"
                required
                onChange={async (e) => {
                  const file = e.target.files?.[0] ?? null;
                  if (!file) { setQrFile(null); setQrPreviewUrl(null); return; }
                  setQrProcessing(true);
                  setQrError(null);
                  setQrPreviewUrl(null);
                  const result = await extractQrFromImage(file);
                  setQrProcessing(false);
                  if (result) {
                    setQrFile(result.file);
                    setQrPreviewUrl(result.previewUrl);
                  } else {
                    setQrFile(null);
                    setQrPreviewUrl(null);
                    setQrError("No QR code detected. Try a clearer or closer photo.");
                    if (qrFileRef.current) qrFileRef.current.value = "";
                  }
                }}
                className="block w-full text-sm text-muted file:mr-3 file:rounded-lg file:border-0 file:bg-accent/10 file:text-accent file:font-semibold file:px-3 file:py-1.5 file:text-xs hover:file:bg-accent/20 transition-colors"
              />
              {qrProcessing && (
                <p className="text-xs text-muted">Detecting QR code…</p>
              )}
              {qrPreviewUrl && (
                <div className="flex items-center gap-3 rounded-lg border border-border bg-background p-3">
                  <img src={qrPreviewUrl} alt="QR preview" className="w-16 h-16 object-contain rounded border border-border" />
                  <div>
                    <p className="text-xs font-semibold text-foreground">QR detected</p>
                    <p className="text-xs text-muted">Cropped to QR code area</p>
                  </div>
                </div>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <input
                  type="text"
                  placeholder="Account name"
                  value={qrAccountName}
                  onChange={(e) => setQrAccountName(e.target.value)}
                  className="rounded-lg border border-border bg-background px-3 py-2 text-base sm:text-sm text-foreground focus:outline-none focus:border-accent"
                />
                <input
                  type="text"
                  placeholder="GCash / Maya number"
                  value={qrAccountNumber}
                  onChange={(e) => setQrAccountNumber(e.target.value)}
                  className="rounded-lg border border-border bg-background px-3 py-2 text-base sm:text-sm text-foreground focus:outline-none focus:border-accent"
                />
              </div>
              {qrError && <p className="text-xs text-accent font-semibold">{qrError}</p>}
              <button
                type="submit"
                disabled={qrUploading || qrProcessing || !qrFile}
                className="rounded-lg bg-accent text-background px-4 py-2 text-sm font-semibold hover:bg-muted transition-colors disabled:opacity-40"
              >
                {qrUploading ? "Uploading…" : "Save QR"}
              </button>
            </form>
          </div>

          {/* Map location */}
          <div className="rounded-xl border border-border bg-background p-5 space-y-4">
            <div>
              <h2 className="text-sm font-bold text-foreground">Map location</h2>
              <p className="text-xs text-muted mt-1">
                Pin your exact location so customers can find you on the booking page.
              </p>
            </div>
            <form onSubmit={onSaveCoordinates} className="space-y-3">
              <MapPicker lat={mapLat} lng={mapLng} onChange={(lat, lng) => { setMapLat(lat); setMapLng(lng); }} />
              <div className="flex flex-col sm:flex-row gap-2">
                <div className="flex-1">
                  <label className="block text-[11px] font-semibold text-muted uppercase tracking-wide mb-1">Latitude</label>
                  <input
                    type="number"
                    step="any"
                    value={mapLat ?? ""}
                    onChange={(e) => setMapLat(e.target.value ? Number(e.target.value) : null)}
                    placeholder="e.g. 14.5995"
                    className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-base sm:text-sm text-foreground placeholder:text-muted/60 focus:outline-none focus:border-accent"
                  />
                </div>
                <div className="flex-1">
                  <label className="block text-[11px] font-semibold text-muted uppercase tracking-wide mb-1">Longitude</label>
                  <input
                    type="number"
                    step="any"
                    value={mapLng ?? ""}
                    onChange={(e) => setMapLng(e.target.value ? Number(e.target.value) : null)}
                    placeholder="e.g. 120.9842"
                    className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-base sm:text-sm text-foreground placeholder:text-muted/60 focus:outline-none focus:border-accent"
                  />
                </div>
              </div>
              {mapLat !== null && mapLng !== null && (
                <a
                  href={`https://www.google.com/maps?q=${mapLat},${mapLng}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs font-semibold text-accent hover:underline"
                >
                  Verify on Google Maps ↗
                </a>
              )}
              {mapError && <p className="text-xs text-accent font-semibold">{mapError}</p>}
              <button
                type="submit"
                disabled={mapSaving || mapLat === null}
                className="rounded-lg bg-accent text-background px-4 py-2 text-sm font-semibold hover:bg-muted transition-colors disabled:opacity-40"
              >
                {mapSaving ? "Saving…" : "Save location"}
              </button>
            </form>
          </div>

          {/* Logo */}
          <div className="rounded-xl border border-border bg-background p-5 space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-sm font-bold text-foreground">Logo</h2>
                <p className="text-xs text-muted mt-1">
                  {location?.logo_url
                    ? "Your logo is shown on the booking page header."
                    : "Upload a logo to brand your booking page."}
                </p>
              </div>
              {location?.logo_url && (
                <button onClick={onRemoveLogo} className="shrink-0 text-xs font-semibold text-accent hover:underline">
                  Remove
                </button>
              )}
            </div>

            {location?.logo_url && (
              <div className="flex items-center rounded-xl border border-border bg-surface p-4">
                <img src={location.logo_url} alt="Logo" className="h-12 w-auto object-contain" />
              </div>
            )}

            <form onSubmit={onUploadLogo} className="space-y-3 rounded-xl border border-border bg-surface p-4">
              <p className="text-xs font-semibold text-muted uppercase tracking-wide">
                {location?.logo_url ? "Replace logo" : "Upload logo"}
              </p>
              <input
                ref={logoFileRef}
                type="file"
                accept="image/*"
                required
                onChange={(e) => setLogoFile(e.target.files?.[0] ?? null)}
                className="block w-full text-sm text-muted file:mr-3 file:rounded-lg file:border-0 file:bg-accent/10 file:text-accent file:font-semibold file:px-3 file:py-1.5 file:text-xs hover:file:bg-accent/20 transition-colors"
              />
              <p className="text-[11px] text-muted">PNG, JPG, SVG or WebP · max 5 MB. Use a transparent PNG for best results.</p>
              {logoError && <p className="text-xs text-accent font-semibold">{logoError}</p>}
              <button
                type="submit"
                disabled={logoUploading || !logoFile}
                className="rounded-lg bg-accent text-background px-4 py-2 text-sm font-semibold hover:bg-muted transition-colors disabled:opacity-40"
              >
                {logoUploading ? "Uploading…" : "Save logo"}
              </button>
            </form>
          </div>

          {/* Facility photo */}
          <div className="rounded-xl border border-border bg-background p-5 space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-sm font-bold text-foreground">Facility photo</h2>
                <p className="text-xs text-muted mt-1">
                  {location?.photo_url
                    ? "Shown as the cover image on the booking page."
                    : "Upload a photo of your courts to make the booking page more inviting."}
                </p>
              </div>
              {location?.photo_url && (
                <button onClick={onRemovePhoto} className="shrink-0 text-xs font-semibold text-accent hover:underline">
                  Remove
                </button>
              )}
            </div>

            {location?.photo_url && (
              <div className="rounded-xl overflow-hidden border border-border">
                <img src={location.photo_url} alt="Facility" className="w-full h-40 object-cover" />
              </div>
            )}

            <form onSubmit={onUploadPhoto} className="space-y-3 rounded-xl border border-border bg-surface p-4">
              <p className="text-xs font-semibold text-muted uppercase tracking-wide">
                {location?.photo_url ? "Replace photo" : "Upload photo"}
              </p>
              <input
                ref={photoFileRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                required
                onChange={(e) => { setPhotoFile(e.target.files?.[0] ?? null); setPhotoError(null); }}
                className="block w-full text-sm text-muted file:mr-3 file:rounded-lg file:border-0 file:bg-accent/10 file:text-accent file:font-semibold file:px-3 file:py-1.5 file:text-xs hover:file:bg-accent/20 transition-colors"
              />
              <p className="text-[11px] text-muted">JPEG, PNG, WebP or GIF · max 8 MB. Use a wide landscape photo for best results.</p>
              {photoError && <p className="text-xs text-accent font-semibold">{photoError}</p>}
              <button
                type="submit"
                disabled={photoUploading || !photoFile}
                className="rounded-lg bg-accent text-background px-4 py-2 text-sm font-semibold hover:bg-muted transition-colors disabled:opacity-40"
              >
                {photoUploading ? "Uploading…" : "Save photo"}
              </button>
            </form>
          </div>

          {/* Color scheme */}
          <div className="rounded-xl border border-border bg-background p-5 space-y-4">
            <div>
              <h2 className="text-sm font-bold text-foreground">Color scheme</h2>
              <p className="text-xs text-muted mt-1">
                Choose a theme for your booking page. Changes the background, text, and accent colors.
              </p>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {THEMES.map((theme) => (
                <button
                  key={theme.key}
                  type="button"
                  onClick={() => setSelectedColor(theme.key)}
                  className={`flex items-center gap-2 rounded-lg border-2 px-3 py-2.5 text-left transition-all ${
                    selectedColor === theme.key
                      ? "scale-[1.03] shadow-sm"
                      : "hover:scale-[1.02] opacity-80 hover:opacity-100"
                  }`}
                  style={{
                    backgroundColor: theme.vars.surface,
                    borderColor: selectedColor === theme.key ? theme.vars.accent : theme.vars.border,
                  }}
                >
                  <span className="w-3.5 h-3.5 rounded-full shrink-0 border border-white/40" style={{ backgroundColor: theme.vars.accent }} />
                  <span className="text-xs font-semibold" style={{ color: theme.vars.foreground }}>{theme.name}</span>
                </button>
              ))}
            </div>

            {selectedColor && (
              <div className="flex items-center gap-3">
                <div
                  className="w-5 h-5 rounded-full shrink-0 border border-border"
                  style={{ backgroundColor: THEMES.find((t) => t.key === selectedColor)?.vars.accent }}
                />
                <span className="text-xs text-foreground font-semibold">
                  {THEMES.find((t) => t.key === selectedColor)?.name}
                </span>
                {selectedColor !== location?.accent_color && (
                  <span className="text-[10px] text-muted uppercase tracking-widest">(unsaved)</span>
                )}
              </div>
            )}

            {colorError && <p className="text-xs text-accent font-semibold">{colorError}</p>}
            <button
              type="button"
              onClick={onSaveColor}
              disabled={colorSaving || !selectedColor || selectedColor === location?.accent_color}
              className="rounded-lg bg-accent text-background px-4 py-2 text-sm font-semibold hover:bg-muted transition-colors disabled:opacity-40"
            >
              {colorSaving ? "Saving…" : "Save color"}
            </button>
          </div>

          {/* Booking policies */}
          <div className="rounded-xl border border-border bg-background p-5 space-y-4">
            <div>
              <h2 className="text-sm font-bold text-foreground">Booking policies</h2>
              <p className="text-xs text-muted mt-1">Control how players can book courts at your location.</p>
            </div>
            <div className="space-y-4">
              {/* Down payment */}
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <p className="text-sm font-semibold text-foreground">Require 50% down payment for long bookings</p>
                  <p className="text-xs text-muted mt-0.5">Bookers pay 50% upfront. The down payment is non-refundable on cancellation.</p>
                  {requireDownpayment && (
                    <div className="flex items-center gap-2 mt-2">
                      <label className="text-xs text-muted font-semibold">Threshold:</label>
                      <input
                        type="number"
                        min={1}
                        max={12}
                        value={downpaymentMinHours}
                        onChange={(e) => setDownpaymentMinHours(Math.max(1, parseInt(e.target.value) || 3))}
                        className="w-16 rounded-lg border border-border bg-surface px-2 py-1 text-sm text-foreground focus:outline-none focus:border-accent text-center"
                      />
                      <span className="text-xs text-muted">hours</span>
                    </div>
                  )}
                </div>
                <button type="button" onClick={() => setRequireDownpayment((v) => !v)}
                  className={`relative w-11 h-6 rounded-full transition-colors shrink-0 mt-0.5 ${requireDownpayment ? "bg-accent" : "bg-border"}`}>
                  <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${requireDownpayment ? "translate-x-5" : "translate-x-0"}`} />
                </button>
              </div>
              {/* No split-rate */}
              <div className="flex items-start justify-between gap-4 border-t border-border pt-4">
                <div className="flex-1">
                  <p className="text-sm font-semibold text-foreground">Prevent bookings that span day/night rates</p>
                  <p className="text-xs text-muted mt-0.5">Block bookings that cross the day/night boundary (e.g. 4–6 PM when night starts at 5 PM). Players must book day and night separately.</p>
                </div>
                <button type="button" onClick={() => setNoSplitRate((v) => !v)}
                  className={`relative w-11 h-6 rounded-full transition-colors shrink-0 mt-0.5 ${noSplitRate ? "bg-accent" : "bg-border"}`}>
                  <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${noSplitRate ? "translate-x-5" : "translate-x-0"}`} />
                </button>
              </div>
              {/* 30-min bookings */}
              <div className="flex items-start justify-between gap-4 border-t border-border pt-4">
                <div className="flex-1">
                  <p className="text-sm font-semibold text-foreground">Allow 30-minute bookings</p>
                  <p className="text-xs text-muted mt-0.5">Show the availability grid in 30-minute slots so players can book half-hour increments.</p>
                </div>
                <button type="button" onClick={() => setAllowHalfHour((v) => !v)}
                  className={`relative w-11 h-6 rounded-full transition-colors shrink-0 mt-0.5 ${allowHalfHour ? "bg-accent" : "bg-border"}`}>
                  <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${allowHalfHour ? "translate-x-5" : "translate-x-0"}`} />
                </button>
              </div>
              {/* Auto-expire unpaid bookings */}
              <div className="flex items-start justify-between gap-4 border-t border-border pt-4">
                <div className="flex-1">
                  <p className="text-sm font-semibold text-foreground">Auto-expire unpaid bookings</p>
                  <p className="text-xs text-muted mt-0.5">Cancel bookings automatically if no payment receipt is uploaded within the time limit, freeing the slot.</p>
                  {autoExpirePending && (
                    <div className="flex items-center gap-2 mt-2">
                      <label className="text-xs text-muted font-semibold">After:</label>
                      <input
                        type="number"
                        min={1}
                        max={72}
                        value={pendingExpiryHours}
                        onChange={(e) => setPendingExpiryHours(Math.max(1, parseInt(e.target.value) || 5))}
                        className="w-16 rounded-lg border border-border bg-surface px-2 py-1 text-sm text-foreground focus:outline-none focus:border-accent text-center"
                      />
                      <span className="text-xs text-muted">hours</span>
                    </div>
                  )}
                </div>
                <button type="button" onClick={() => setAutoExpirePending((v) => !v)}
                  className={`relative w-11 h-6 rounded-full transition-colors shrink-0 mt-0.5 ${autoExpirePending ? "bg-accent" : "bg-border"}`}>
                  <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${autoExpirePending ? "translate-x-5" : "translate-x-0"}`} />
                </button>
              </div>
            </div>
            {policyError && <p className="text-xs text-red-600">{policyError}</p>}
            {policySuccess && <p className="text-xs text-green-600">Policies saved.</p>}
            <button type="button" onClick={onSavePolicies} disabled={policySaving}
              className="rounded-lg bg-accent text-background px-4 py-2 text-sm font-semibold hover:bg-muted transition-colors disabled:opacity-40">
              {policySaving ? "Saving…" : "Save policies"}
            </button>
          </div>

        </div>
      </main>

      {/* ── Pricing modal ── */}
      {showPricing && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm px-0 sm:px-4 py-0 sm:py-6"
          onClick={() => { if (!pricingSaving) setShowPricing(false); }}
        >
          <form
            onSubmit={onSavePricing}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl border border-border bg-background p-6 shadow-xl space-y-4"
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
                  className="w-full rounded-lg border border-border bg-background pl-7 pr-3 py-2.5 text-base sm:text-sm text-foreground focus:outline-none focus:border-accent"
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
                  className="w-full rounded-lg border border-border bg-background pl-7 pr-3 py-2.5 text-base sm:text-sm text-foreground focus:outline-none focus:border-accent"
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
                  className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-base sm:text-sm text-foreground focus:outline-none focus:border-accent"
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
                    className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-base sm:text-sm text-foreground focus:outline-none focus:border-accent"
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
                    className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-base sm:text-sm text-foreground focus:outline-none focus:border-accent"
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
                  className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-base sm:text-sm text-foreground focus:outline-none focus:border-accent"
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
                    className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-base sm:text-sm text-foreground focus:outline-none focus:border-accent"
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
                    className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-base sm:text-sm text-foreground focus:outline-none focus:border-accent"
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

      {/* ── Edit location info modal ── */}
      {editInfo && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm px-0 sm:px-4 py-0 sm:py-6"
          onClick={() => { if (!editInfoSaving) setEditInfo(null); }}
        >
          <form
            onSubmit={onSaveInfo}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl border border-border bg-background p-6 shadow-xl space-y-4"
          >
            <div>
              <div className="inline-block rounded-full bg-accent/15 text-accent px-3 py-0.5 text-[10px] font-semibold uppercase tracking-widest">
                Edit location
              </div>
              <h2 className="mt-2 text-lg font-bold text-foreground">Location details</h2>
            </div>

            <label className="block space-y-1">
              <span className="text-xs uppercase tracking-wide text-muted font-semibold">
                Name <span className="text-accent">*</span>
              </span>
              <input
                type="text"
                required
                autoFocus
                value={editInfo.name}
                onChange={(e) => setEditInfo({ ...editInfo, name: e.target.value })}
                className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-base sm:text-sm text-foreground focus:outline-none focus:border-accent"
              />
            </label>

            <label className="block space-y-1">
              <span className="text-xs uppercase tracking-wide text-muted font-semibold">Address</span>
              <input
                type="text"
                value={editInfo.address}
                onChange={(e) => setEditInfo({ ...editInfo, address: e.target.value })}
                placeholder="e.g. 123 Main St, Manila"
                className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-base sm:text-sm text-foreground focus:outline-none focus:border-accent"
              />
            </label>

            <label className="block space-y-1">
              <span className="text-xs uppercase tracking-wide text-muted font-semibold">Description</span>
              <textarea
                value={editInfo.description}
                onChange={(e) => setEditInfo({ ...editInfo, description: e.target.value })}
                rows={3}
                placeholder="Brief description shown to customers…"
                className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-base sm:text-sm text-foreground focus:outline-none focus:border-accent resize-none"
              />
            </label>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="block space-y-1">
                <span className="text-xs uppercase tracking-wide text-muted font-semibold">Contact email</span>
                <input
                  type="email"
                  value={editInfo.contact_email}
                  onChange={(e) => setEditInfo({ ...editInfo, contact_email: e.target.value })}
                  placeholder="support@yourvenue.com"
                  className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-base sm:text-sm text-foreground focus:outline-none focus:border-accent"
                />
              </label>
              <label className="block space-y-1">
                <span className="text-xs uppercase tracking-wide text-muted font-semibold">Contact phone</span>
                <input
                  type="tel"
                  value={editInfo.contact_phone}
                  onChange={(e) => setEditInfo({ ...editInfo, contact_phone: e.target.value })}
                  placeholder="09171234567"
                  className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-base sm:text-sm text-foreground focus:outline-none focus:border-accent"
                />
              </label>
            </div>
            <p className="text-[11px] text-muted -mt-1">Shown to customers so they can reach you about a booking.</p>

            {editInfoError && (
              <p className="text-sm text-accent font-semibold">{editInfoError}</p>
            )}

            <div className="flex gap-2 justify-end pt-1">
              <button
                type="button"
                disabled={editInfoSaving}
                onClick={() => setEditInfo(null)}
                className="rounded-lg border border-border px-4 py-2 text-sm font-semibold text-foreground hover:bg-accent/10 hover:border-accent transition-colors disabled:opacity-40"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={editInfoSaving}
                className="rounded-lg bg-accent text-background px-4 py-2 text-sm font-semibold hover:bg-muted transition-colors disabled:opacity-40"
              >
                {editInfoSaving ? "Saving…" : "Save"}
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
