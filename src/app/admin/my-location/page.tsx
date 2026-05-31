"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import dynamic from "next/dynamic";
import { LayoutDashboard, CalendarDays, Circle, Settings, CalendarCheck2, TrendingUp, BarChart2, BarChart3, Wallet, CheckCircle2, Clock, XCircle, Menu, X, Megaphone, Plus, Pencil, Trash2, ToggleLeft, ToggleRight, ZoomIn } from "lucide-react";
import { Logo } from "@/components/Logo";
import type { Court, Booking, BookingStatus } from "@/lib/types";
import { THEMES, applyTheme, clearTheme } from "@/lib/themes";
import { TIME_SLOTS } from "@/lib/types";
import { getSubscriptionStatus } from "@/lib/subscription";

const MapPicker = dynamic(() => import("@/components/MapPicker"), {
  ssr: false,
  loading: () => <div className="rounded-xl border border-border bg-surface animate-pulse" style={{ height: 300 }} />,
});

type Tab = "dashboard" | "bookings" | "courts" | "announcements" | "settings";

type Me = { username: string; role: string; location_id: string | null };
type LocationInfo = {
  id: string;
  name: string;
  address: string | null;
  description: string | null;
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
  logo_url: string | null;
  accent_color: string | null;
  subscription_due_date: string | null;
  subscription_grace_days: number;
};

type Announcement = {
  id: string;
  title: string;
  body: string;
  image_url: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
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

type DashboardData = {
  stats: {
    today_bookings: number;
    yesterday_bookings: number;
    today_revenue: number;
    yesterday_revenue: number;
    week_revenue: number;
    prev_week_revenue: number;
    month_revenue: number;
    prev_month_revenue: number;
  };
  court_utilization: {
    id: string;
    name: string;
    is_active: boolean;
    booked_hours: number;
    total_hours: number;
    pct: number;
  }[];
  recent_activity: {
    id: string;
    court_name: string;
    booker_name: string;
    date: string;
    start_time: string;
    end_time: string;
    status: string;
    created_at: string;
  }[];
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

function fmtPeso(n: number): string {
  return "₱" + n.toLocaleString("en-PH", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

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

const STATUS_STYLES: Record<BookingStatus, string> = {
  confirmed: "bg-green-100 text-green-700",
  pending_payment: "bg-yellow-100 text-yellow-700",
  cancelled: "bg-gray-100 text-gray-500",
  refunded: "bg-blue-100 text-blue-600",
};
const STATUS_LABELS: Record<BookingStatus, string> = {
  confirmed: "Confirmed",
  pending_payment: "Pending",
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

function pctChange(curr: number, prev: number): string {
  if (prev === 0) return curr > 0 ? "+∞%" : "—";
  const p = Math.round(((curr - prev) / prev) * 100);
  return (p >= 0 ? "+" : "") + p + "%";
}

export default function MyLocationPage() {
  const router = useRouter();
  const today = formatDate(new Date(Date.now() - new Date().getTimezoneOffset() * 60000));
  const [activeTab, setActiveTab] = useState<Tab>("dashboard");
  const [me, setMe] = useState<Me | null>(null);
  const [location, setLocation] = useState<LocationInfo | null>(null);
  const [courts, setCourts] = useState<Court[] | null>(null);
  const [date, setDate] = useState(today);
  const [bookings, setBookings] = useState<Booking[] | null>(null);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [refundingId, setRefundingId] = useState<string | null>(null);
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [refundTarget, setRefundTarget] = useState<string | null>(null);
  const [showAddCourt, setShowAddCourt] = useState(false);
  const [newCourtName, setNewCourtName] = useState("");
  const [addingCourt, setAddingCourt] = useState(false);
  const [addCourtError, setAddCourtError] = useState<string | null>(null);
  const [deactivatingCourtId, setDeactivatingCourtId] = useState<string | null>(null);
  const [activatingCourtId, setActivatingCourtId] = useState<string | null>(null);
  const [editCourt, setEditCourt] = useState<{ id: string; name: string; description: string } | null>(null);
  const [editCourtSaving, setEditCourtSaving] = useState(false);
  const [editCourtError, setEditCourtError] = useState<string | null>(null);
  const [editInfo, setEditInfo] = useState<{ name: string; address: string; description: string } | null>(null);
  const [editInfoSaving, setEditInfoSaving] = useState(false);
  const [editInfoError, setEditInfoError] = useState<string | null>(null);
  const [showPricing, setShowPricing] = useState(false);
  const [pricingForm, setPricingForm] = useState<PricingForm>({ day_rate: "0", night_rate: "0", night_start_time: "18:00", open_hour: 0, close_hour: 24, weekend_night_start_time: "18:00", weekend_open_hour: 0, weekend_close_hour: 24 });
  const [pricingSaving, setPricingSaving] = useState(false);
  const [pricingError, setPricingError] = useState<string | null>(null);
  const [qrFile, setQrFile] = useState<File | null>(null);
  const [qrPreviewUrl, setQrPreviewUrl] = useState<string | null>(null);
  const [qrProcessing, setQrProcessing] = useState(false);
  const [qrAccountName, setQrAccountName] = useState("");
  const [qrAccountNumber, setQrAccountNumber] = useState("");
  const [qrUploading, setQrUploading] = useState(false);
  const [qrError, setQrError] = useState<string | null>(null);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [mapLat, setMapLat] = useState<number | null>(null);
  const [mapLng, setMapLng] = useState<number | null>(null);
  const [mapSaving, setMapSaving] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoUploading, setLogoUploading] = useState(false);
  const [logoError, setLogoError] = useState<string | null>(null);
  const [colorSaving, setColorSaving] = useState(false);
  const [colorError, setColorError] = useState<string | null>(null);
  const [selectedColor, setSelectedColor] = useState<string | null>(null);
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [dashboardLoading, setDashboardLoading] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [announcements, setAnnouncements] = useState<Announcement[] | null>(null);
  const [announcementsLoading, setAnnouncementsLoading] = useState(false);
  const [announcementForm, setAnnouncementForm] = useState<{ title: string; body: string } | null>(null);
  const [editingAnnouncement, setEditingAnnouncement] = useState<Announcement | null>(null);
  const [announcementSaving, setAnnouncementSaving] = useState(false);
  const [announcementError, setAnnouncementError] = useState<string | null>(null);
  const [deletingAnnouncementId, setDeletingAnnouncementId] = useState<string | null>(null);
  const [viewingImageUrl, setViewingImageUrl] = useState<string | null>(null);
  const [adminBookingForm, setAdminBookingForm] = useState<{
    court_id: string; date: string; start_hour: number; end_hour: number;
    booker_name: string; booker_phone: string; booker_email: string; notes: string;
  } | null>(null);
  const [adminBookingSubmitting, setAdminBookingSubmitting] = useState(false);
  const [adminBookingError, setAdminBookingError] = useState<string | null>(null);
  const [announcementImageFile, setAnnouncementImageFile] = useState<File | null>(null);
  const [announcementImagePreview, setAnnouncementImagePreview] = useState<string | null>(null);
  const announcementImageRef = useRef<HTMLInputElement>(null);
  const courtNameRef = useRef<HTMLInputElement>(null);
  const qrFileRef = useRef<HTMLInputElement>(null);
  const logoFileRef = useRef<HTMLInputElement>(null);

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
      setSelectedColor(loc.accent_color ?? null);
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
    const res = await fetch(`/api/admin/bookings?date=${d}`);
    if (res.status === 401 || res.status === 403) return;
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

  useEffect(() => {
    applyTheme(location?.accent_color ?? null);
    return () => clearTheme();
  }, [location?.accent_color]);

  useEffect(() => {
    if (activeTab !== "dashboard") return;
    setDashboardLoading(true);
    fetch("/api/admin/dashboard")
      .then((r) => r.json())
      .then((json) => { if (json.stats) setDashboardData(json); })
      .catch(() => {})
      .finally(() => setDashboardLoading(false));
  }, [activeTab]);

  const loadAnnouncements = useCallback(async () => {
    setAnnouncementsLoading(true);
    try {
      const res = await fetch("/api/admin/announcements");
      if (!res.ok) return;
      const json = await res.json();
      setAnnouncements(json.announcements ?? []);
    } finally {
      setAnnouncementsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === "announcements" && announcements === null) loadAnnouncements();
  }, [activeTab, announcements, loadAnnouncements]);

  const isPast = date < today;

  const myBookings = bookings?.filter(
    (b) => courts?.some((c) => c.id === b.court_id)
  ) ?? [];

  // Keep detail modal in sync after reload
  useEffect(() => {
    if (selectedBooking && bookings) {
      const updated = bookings.find((b) => b.id === selectedBooking.id);
      setSelectedBooking(updated ?? null);
    }
  }, [bookings]); // eslint-disable-line react-hooks/exhaustive-deps

  function courtName(courtId: string) {
    return courts?.find((c) => c.id === courtId)?.name ?? courtId;
  }

  async function onAddCourt(e: React.SubmitEvent<HTMLFormElement>) {
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

  async function onActivateCourt(id: string) {
    setActivatingCourtId(id);
    try {
      const res = await fetch(`/api/admin/courts/${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ is_active: true }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || "Failed to activate");
      if (me?.location_id) loadCourts(me.location_id);
    } catch (err) {
      alert((err as Error).message);
    } finally {
      setActivatingCourtId(null);
    }
  }

  async function onSaveInfo(e: React.SubmitEvent<HTMLFormElement>) {
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

  async function onSaveEditCourt(e: React.SubmitEvent<HTMLFormElement>) {
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
      if (me?.location_id) loadCourts(me.location_id);
    } catch (err) {
      setEditCourtError((err as Error).message);
    } finally {
      setEditCourtSaving(false);
    }
  }

  async function onCancelBooking(id: string) {
    if (!confirm("Cancel this booking?")) return;
    setCancellingId(id);
    try {
      const res = await fetch(`/api/admin/bookings/${encodeURIComponent(id)}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Cancel failed");
      loadBookings(date);
      setSelectedBooking(null);
    } catch (err) {
      alert((err as Error).message);
    } finally {
      setCancellingId(null);
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
      if (!res.ok) throw new Error("Refund failed");
      loadBookings(date);
      setSelectedBooking(null);
    } catch (err) {
      alert((err as Error).message);
    } finally {
      setRefundingId(null);
    }
  }

  async function onSavePricing(e: React.SubmitEvent<HTMLFormElement>) {
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

  async function onUploadQr(e: React.SubmitEvent<HTMLFormElement>) {
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

  async function onUploadLogo(e: React.SubmitEvent<HTMLFormElement>) {
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

  async function onSaveCoordinates(e: React.SubmitEvent<HTMLFormElement>) {
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

  type TabDef = { id: Tab; label: string; Icon: React.ComponentType<{ size?: number; className?: string }> };
  const TABS: TabDef[] = [
    { id: "dashboard",     label: "Dashboard",     Icon: LayoutDashboard },
    { id: "bookings",      label: "Bookings",      Icon: CalendarDays },
    { id: "courts",        label: "Courts",        Icon: Circle },
    { id: "announcements", label: "Announcements", Icon: Megaphone },
    { id: "settings",      label: "Settings",      Icon: Settings },
  ];

  const avatarInitial = (me?.username?.[0] ?? "A").toUpperCase();

  return (
    <div className="min-h-screen bg-surface">
      {/* ── Top nav (Rally AdminBar) ── */}
      <nav className="sticky top-0 z-40 bg-background/92 backdrop-blur-md border-b border-border">
        <div className="max-w-[1340px] mx-auto flex items-center gap-4 py-[11px] px-4 sm:px-[26px]">
          {/* Brand */}
          <Link
            href="/admin/my-location"
            className="flex items-center gap-[9px] font-extrabold text-[19px] tracking-tight text-foreground shrink-0"
          >
            <Logo size={26} />
            <span className="hidden sm:block">Paddle Up</span>
            <span className="font-mono text-[10px] font-bold tracking-[.12em] uppercase text-muted bg-surface px-[7px] py-[3px] rounded-full ml-0.5 hidden sm:block">
              Admin
            </span>
          </Link>

          {/* Tab nav — desktop */}
          <div className="hidden sm:flex items-center gap-0.5 ml-2 overflow-x-auto">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-[7px] px-[13px] py-[9px] rounded-full text-[13.5px] font-semibold whitespace-nowrap transition-all ${
                  activeTab === tab.id
                    ? "bg-accent/15 text-accent"
                    : "text-muted hover:text-foreground hover:bg-surface"
                }`}
              >
                <tab.Icon size={15} />
                {tab.label}
              </button>
            ))}
          </div>

          {/* Right side */}
          <div className="ml-auto flex items-center gap-2.5 shrink-0">
            <Link
              href="/book"
              target="_blank"
              className="text-[13.5px] font-semibold text-muted hover:text-foreground transition-colors hidden sm:block"
            >
              Booking page ↗
            </Link>
            <button
              onClick={onLogout}
              className="text-[13.5px] font-semibold text-muted hover:text-accent transition-colors hidden sm:block"
            >
              Log out
            </button>
            {/* Avatar */}
            <div className="w-[38px] h-[38px] rounded-full bg-accent flex items-center justify-center text-white font-bold text-[14px] shrink-0 select-none">
              {avatarInitial}
            </div>
            {/* Mobile burger */}
            <button
              onClick={() => setMenuOpen(true)}
              className="w-[42px] h-[42px] rounded-[12px] bg-background border border-border flex items-center justify-center text-foreground sm:hidden"
            >
              <Menu size={22} />
            </button>
          </div>
        </div>
      </nav>

      {/* ── Mobile drawer ── */}
      <div
        className={`fixed inset-0 z-50 bg-[rgba(15,20,15,.4)] transition-opacity duration-200 ${menuOpen ? "opacity-100" : "opacity-0 pointer-events-none"}`}
        onClick={() => setMenuOpen(false)}
      />
      <div
        className={`fixed top-0 right-0 h-full w-[min(82vw,330px)] bg-background z-[60] flex flex-col p-[18px] shadow-2xl transition-transform duration-300 ease-out ${menuOpen ? "translate-x-0" : "translate-x-full"}`}
      >
        <div className="flex items-center justify-between mb-[18px]">
          <div>
            <div className="font-extrabold text-[17px] tracking-tight text-foreground">{location?.name ?? "My Location"}</div>
            <div className="font-mono text-[10px] font-bold tracking-[.12em] uppercase text-muted mt-0.5">Admin console</div>
          </div>
          <button
            onClick={() => setMenuOpen(false)}
            className="w-[34px] h-[34px] rounded-full border border-border flex items-center justify-center text-muted hover:bg-surface"
          >
            <X size={18} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto space-y-0.5">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => { setActiveTab(tab.id); setMenuOpen(false); }}
              className={`flex items-center gap-3 w-full px-[14px] py-[14px] rounded-[14px] text-[15px] font-semibold transition-colors ${
                activeTab === tab.id ? "bg-accent/15 text-accent" : "text-foreground hover:bg-surface"
              }`}
            >
              <tab.Icon size={20} className={activeTab === tab.id ? "text-accent" : "text-muted"} />
              {tab.label}
            </button>
          ))}
        </div>
        <div className="pt-[14px] border-t border-border flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-[38px] h-[38px] rounded-full bg-accent flex items-center justify-center text-white font-bold text-[14px] shrink-0">
              {avatarInitial}
            </div>
            <span className="text-[13.5px] font-semibold text-foreground">{me?.username}</span>
          </div>
          <button onClick={onLogout} className="text-[13.5px] font-semibold text-muted hover:text-accent transition-colors">
            Log out
          </button>
        </div>
      </div>

      <main className="mx-auto max-w-4xl w-full px-4 py-8 space-y-6">

        {/* ── Subscription banner ── */}
        {location && (() => {
          const sub = getSubscriptionStatus(location.subscription_due_date, location.subscription_grace_days);
          if (sub.type === "expired") return (
            <div className="rounded-xl border border-red-300 bg-red-50 px-5 py-4">
              <p className="font-semibold text-red-800 text-sm">Subscription expired</p>
              <p className="text-sm text-red-700 mt-0.5">
                Customers can no longer book at your location. Contact the administrator to renew your subscription.
              </p>
            </div>
          );
          if (sub.type === "grace") return (
            <div className="rounded-xl border border-orange-300 bg-orange-50 px-5 py-4">
              <p className="font-semibold text-orange-800 text-sm">
                Subscription overdue · {sub.graceLeft} day{sub.graceLeft !== 1 ? "s" : ""} left
              </p>
              <p className="text-sm text-orange-700 mt-0.5">
                New bookings will be blocked in {sub.graceLeft} day{sub.graceLeft !== 1 ? "s" : ""}. Contact the administrator to renew.
              </p>
            </div>
          );
          if (sub.type === "due_soon") return (
            <div className="rounded-xl border border-yellow-300 bg-yellow-50 px-5 py-4">
              <p className="font-semibold text-yellow-800 text-sm">
                Subscription due in {sub.daysLeft} day{sub.daysLeft !== 1 ? "s" : ""}
              </p>
              <p className="text-sm text-yellow-700 mt-0.5">
                Contact the administrator to renew before your subscription expires.
              </p>
            </div>
          );
          return null;
        })()}

        {/* ── Dashboard tab ── */}
        {activeTab === "dashboard" && (
          <section className="space-y-5">
            {/* Page header */}
            <div className="flex items-end justify-between gap-4 flex-wrap mb-1">
              <div className="flex items-center gap-4">
                {location?.logo_url && (
                  <img
                    src={location.logo_url}
                    alt="Logo"
                    className="h-14 w-14 rounded-xl object-contain border border-border bg-surface shrink-0"
                  />
                )}
                <div>
                  <span className="font-mono text-[12px] font-bold tracking-[.2em] uppercase text-accent mb-2 block">
                    {new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
                  </span>
                  <h2 className="text-[30px] font-extrabold tracking-tight text-foreground leading-none">
                    {location?.name ?? "My Location"}
                  </h2>
                  {(location?.address || location?.description) && (
                    <p className="text-[14.5px] text-muted mt-1.5 max-w-[62ch]">
                      {location?.address}
                      {location?.address && location?.description ? " · " : ""}
                      {location?.description}
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* KPI cards */}
            {dashboardLoading ? (
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="rounded-[22px] border border-border bg-background p-5 animate-pulse h-[130px]" />
                ))}
              </div>
            ) : dashboardData ? (
              <>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">
                  {/* Today's bookings — solid badge */}
                  <div className="rounded-[22px] border border-border bg-background p-5 shadow-sm">
                    <div className="flex items-center justify-between">
                      <div className="w-[42px] h-[42px] rounded-[13px] bg-accent flex items-center justify-center shrink-0 shadow-[0_12px_28px_color-mix(in_srgb,var(--color-accent)_30%,transparent)]">
                        <CalendarCheck2 size={20} className="text-white" />
                      </div>
                      {(() => {
                        const delta = dashboardData.stats.today_bookings - dashboardData.stats.yesterday_bookings;
                        return (
                          <span className={`text-[12.5px] font-bold flex items-center gap-1 ${delta >= 0 ? "text-accent" : "text-red-500"}`}>
                            {delta >= 0 ? "↑" : "↓"} {Math.abs(delta)} vs yday
                          </span>
                        );
                      })()}
                    </div>
                    <p className="text-[13px] text-muted font-semibold mt-4">Today&apos;s bookings</p>
                    <p className="text-[30px] font-extrabold tracking-tight text-foreground leading-none mt-0.5">
                      {dashboardData.stats.today_bookings}
                    </p>
                  </div>

                  {/* Revenue today — soft badge */}
                  <div className="rounded-[22px] border border-border bg-background p-5 shadow-sm">
                    <div className="flex items-center justify-between">
                      <div className="w-[42px] h-[42px] rounded-[13px] bg-accent/15 flex items-center justify-center shrink-0">
                        <TrendingUp size={20} className="text-accent" />
                      </div>
                      {(() => {
                        const label = pctChange(dashboardData.stats.today_revenue, dashboardData.stats.yesterday_revenue);
                        const positive = dashboardData.stats.today_revenue >= dashboardData.stats.yesterday_revenue;
                        return (
                          <span className={`text-[12.5px] font-bold ${positive ? "text-accent" : "text-red-500"}`}>
                            {label} yday
                          </span>
                        );
                      })()}
                    </div>
                    <p className="text-[13px] text-muted font-semibold mt-4">Revenue · today</p>
                    <p className="text-[30px] font-extrabold tracking-tight text-foreground leading-none mt-0.5">
                      {fmtPeso(dashboardData.stats.today_revenue)}
                    </p>
                  </div>

                  {/* This week — soft badge */}
                  <div className="rounded-[22px] border border-border bg-background p-5 shadow-sm">
                    <div className="flex items-center justify-between">
                      <div className="w-[42px] h-[42px] rounded-[13px] bg-accent/15 flex items-center justify-center shrink-0">
                        <BarChart2 size={20} className="text-accent" />
                      </div>
                      {(() => {
                        const label = pctChange(dashboardData.stats.week_revenue, dashboardData.stats.prev_week_revenue);
                        const positive = dashboardData.stats.week_revenue >= dashboardData.stats.prev_week_revenue;
                        return (
                          <span className={`text-[12.5px] font-bold ${positive ? "text-accent" : "text-red-500"}`}>
                            {label} WoW
                          </span>
                        );
                      })()}
                    </div>
                    <p className="text-[13px] text-muted font-semibold mt-4">Revenue · this week</p>
                    <p className="text-[30px] font-extrabold tracking-tight text-foreground leading-none mt-0.5">
                      {fmtPeso(dashboardData.stats.week_revenue)}
                    </p>
                  </div>

                  {/* This month — soft badge */}
                  <div className="rounded-[22px] border border-border bg-background p-5 shadow-sm">
                    <div className="flex items-center justify-between">
                      <div className="w-[42px] h-[42px] rounded-[13px] bg-accent/15 flex items-center justify-center shrink-0">
                        <BarChart3 size={20} className="text-accent" />
                      </div>
                      {(() => {
                        const label = pctChange(dashboardData.stats.month_revenue, dashboardData.stats.prev_month_revenue);
                        const positive = dashboardData.stats.month_revenue >= dashboardData.stats.prev_month_revenue;
                        return (
                          <span className={`text-[12.5px] font-bold ${positive ? "text-accent" : "text-red-500"}`}>
                            {label} MoM
                          </span>
                        );
                      })()}
                    </div>
                    <p className="text-[13px] text-muted font-semibold mt-4">Revenue · this month</p>
                    <p className="text-[30px] font-extrabold tracking-tight text-foreground leading-none mt-0.5">
                      {fmtPeso(dashboardData.stats.month_revenue)}
                    </p>
                  </div>
                </div>

                {/* Utilization + activity — 1.5fr / 1fr */}
                <div className="grid grid-cols-1 lg:grid-cols-[1.5fr_1fr] gap-5">
                  {/* Court utilization */}
                  <div className="rounded-[22px] border border-border bg-background p-6 shadow-sm">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-[16px] font-bold text-foreground flex items-center gap-2.5">
                        <span className="w-[30px] h-[30px] rounded-[9px] bg-accent/15 text-accent inline-flex items-center justify-center shrink-0">
                          <BarChart2 size={16} />
                        </span>
                        Court utilization · today
                      </h3>
                      {dashboardData.court_utilization.length > 0 && (
                        <span className="text-[13px] font-bold text-accent">
                          {Math.round(
                            dashboardData.court_utilization.reduce((s, c) => s + c.pct, 0) /
                            dashboardData.court_utilization.length
                          )}% overall
                        </span>
                      )}
                    </div>

                    {dashboardData.court_utilization.length === 0 ? (
                      <p className="text-sm text-muted">No courts configured.</p>
                    ) : (
                      <div>
                        {dashboardData.court_utilization.map((court) => (
                          <div
                            key={court.id}
                            className={`flex items-center gap-3 py-[9px] border-b border-border/40 last:border-b-0 ${!court.is_active ? "opacity-40" : ""}`}
                          >
                            <span className="text-[13.5px] font-semibold text-foreground w-16 shrink-0 truncate">{court.name}</span>
                            <div className="flex-1 h-2.5 rounded-full bg-surface overflow-hidden">
                              <div className="h-full rounded-full bg-accent transition-all" style={{ width: `${court.pct}%` }} />
                            </div>
                            <span className="text-[13px] font-bold text-foreground w-10 text-right shrink-0">{court.pct}%</span>
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="flex gap-2.5 pt-5 mt-2 border-t border-border">
                      <button
                        onClick={() => setActiveTab("bookings")}
                        className="rounded-full border border-border px-4 py-2 text-[13px] font-semibold text-foreground hover:bg-accent/10 hover:border-accent transition-colors flex items-center gap-1.5"
                      >
                        <CalendarDays size={14} /> Open schedule
                      </button>
                      <button
                        onClick={() => setActiveTab("courts")}
                        className="rounded-full border border-border px-4 py-2 text-[13px] font-semibold text-foreground hover:bg-accent/10 hover:border-accent transition-colors flex items-center gap-1.5"
                      >
                        <Circle size={14} /> Manage courts
                      </button>
                    </div>
                  </div>

                  {/* Recent activity */}
                  <div className="rounded-[22px] border border-border bg-background p-6 shadow-sm">
                    <h3 className="text-[16px] font-bold text-foreground flex items-center gap-2.5 mb-4">
                      <span className="w-[30px] h-[30px] rounded-[9px] bg-accent/15 text-accent inline-flex items-center justify-center shrink-0">
                        <Clock size={16} />
                      </span>
                      Recent activity
                    </h3>
                    {dashboardData.recent_activity.length === 0 ? (
                      <p className="text-sm text-muted">No recent bookings.</p>
                    ) : (
                      <div>
                        {dashboardData.recent_activity.map((a) => {
                          const isConfirmed = a.status === "confirmed";
                          const isPendingPay = a.status === "pending_payment";
                          const isCancelled = a.status === "cancelled";
                          const FeedIcon = isConfirmed ? CalendarCheck2 : isPendingPay ? Clock : isCancelled ? XCircle : Wallet;
                          const icBg = isConfirmed ? "bg-accent/15" : isPendingPay ? "bg-[#fdf0db]" : isCancelled ? "bg-[#fde8e6]" : "bg-[#e3f0ff]";
                          const icFg = isConfirmed ? "text-accent" : isPendingPay ? "text-[#a96a14]" : isCancelled ? "text-[#b23b32]" : "text-[#2b7bd6]";
                          const what = isConfirmed ? "booked" : isPendingPay ? "payment pending" : isCancelled ? "cancelled" : "refunded";
                          return (
                            <div key={a.id} className="flex items-start gap-3.5 py-3.5 border-b border-surface last:border-b-0">
                              <div className={`w-[38px] h-[38px] rounded-[11px] ${icBg} flex items-center justify-center shrink-0`}>
                                <FeedIcon size={17} className={icFg} />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-[14px] leading-snug text-foreground">
                                  <b className="font-bold">{a.booker_name}</b> {what}
                                </p>
                                <p className="text-[12.5px] text-muted mt-0.5 truncate">
                                  {a.court_name} · {fmtTime(a.start_time)}–{fmtTime(a.end_time)}
                                </p>
                              </div>
                              <span className="text-[11.5px] text-muted/60 font-semibold whitespace-nowrap shrink-0 mt-0.5">
                                {timeAgo(a.created_at)}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              </>
            ) : (
              <p className="text-sm text-muted">Failed to load dashboard data.</p>
            )}
          </section>
        )}

        {/* ── Bookings tab ── */}
        {activeTab === "bookings" && (
          <section className="space-y-4">
            <div className="flex items-center gap-3 flex-wrap">
              <h2 className="text-base font-bold text-foreground flex-1">Bookings</h2>
              <button
                onClick={() => {
                  const activeCourts = courts?.filter((c) => c.is_active) ?? [];
                  setAdminBookingForm({
                    court_id: activeCourts[0]?.id ?? "",
                    date,
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
                {isPast && (
                  <span className="rounded-full bg-gray-100 text-gray-500 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-widest">
                    Past
                  </span>
                )}
              </div>
            </div>

            {bookings === null ? (
              <p className="text-sm text-muted">Loading…</p>
            ) : myBookings.length === 0 ? (
              <div className="rounded-xl border border-border bg-background p-8 text-center">
                <p className="text-sm text-muted">No bookings for {displayDate(date)}.</p>
              </div>
            ) : (
              <div className="overflow-hidden rounded-xl border border-border bg-background shadow-sm">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-surface">
                      <tr className="text-left">
                        <th className="px-4 py-3 text-xs uppercase tracking-wide text-muted font-semibold">Court</th>
                        <th className="px-4 py-3 text-xs uppercase tracking-wide text-muted font-semibold">Time</th>
                        <th className="px-4 py-3 text-xs uppercase tracking-wide text-muted font-semibold">Booker</th>
                        <th className="px-4 py-3 text-xs uppercase tracking-wide text-muted font-semibold">Status</th>
                        <th className="px-4 py-3 text-xs uppercase tracking-wide text-muted font-semibold">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {myBookings.map((b, i) => (
                        <tr
                          key={b.id}
                          className={[
                            i === 0 ? "" : "border-t border-border",
                            b.status === "cancelled" || b.status === "refunded" ? "opacity-50" : "hover:bg-accent/5",
                            "transition-colors",
                          ].join(" ")}
                        >
                          <td className="px-4 py-3 font-semibold text-foreground whitespace-nowrap">
                            {courtName(b.court_id)}
                          </td>
                          <td className="px-4 py-3 text-foreground whitespace-nowrap">
                            {fmtTime(b.start_time)} – {fmtTime(b.end_time)}
                          </td>
                          <td className="px-4 py-3">
                            <p className="font-medium text-foreground">{b.booker_name}</p>
                            <p className="text-xs text-muted">{b.booker_phone || "—"}</p>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex flex-col gap-1">
                              <StatusBadge status={b.status} />
                              {b.status === "refunded" && b.refund_reason && (
                                <span className="text-[11px] text-muted leading-snug max-w-[160px]">{b.refund_reason}</span>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex gap-2 flex-wrap">
                              <button
                                onClick={() => setSelectedBooking(b)}
                                className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-accent/10 hover:border-accent transition-colors"
                              >
                                View
                              </button>
                              {b.status === "pending_payment" && !isPast && (
                                <button
                                  onClick={() => onConfirmPayment(b.id)}
                                  disabled={confirmingId === b.id}
                                  className="rounded-lg border border-green-400 bg-green-50 px-3 py-1.5 text-xs font-semibold text-green-700 hover:bg-green-500 hover:text-white transition-colors disabled:opacity-40"
                                >
                                  {confirmingId === b.id ? "…" : "Confirm"}
                                </button>
                              )}
                              {b.status !== "cancelled" && b.status !== "refunded" && !isPast && (
                                <button
                                  onClick={() => onCancelBooking(b.id)}
                                  disabled={cancellingId === b.id}
                                  className="rounded-lg border border-accent/50 bg-accent/5 px-3 py-1.5 text-xs font-semibold text-accent hover:bg-accent hover:text-background transition-colors disabled:opacity-40"
                                >
                                  {cancellingId === b.id ? "…" : "Cancel"}
                                </button>
                              )}
                              {b.status !== "refunded" && isPast && (
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
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </section>
        )}

        {/* ── Courts tab ── */}
        {activeTab === "courts" && (
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-foreground">Courts</h2>
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
              <div className="rounded-xl border border-border bg-background p-8 text-center">
                <p className="text-sm text-muted">No courts yet. Add your first court above.</p>
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {courts.map((court) => (
                  <div
                    key={court.id}
                    className={`flex items-start justify-between rounded-xl border bg-background px-4 py-3 gap-3 ${
                      court.is_active ? "border-border" : "border-border opacity-50"
                    }`}
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-foreground text-sm">{court.name}</p>
                        {!court.is_active && (
                          <span className="rounded-full bg-surface text-muted px-2 py-0.5 text-[10px] font-semibold uppercase tracking-widest border border-border">
                            Inactive
                          </span>
                        )}
                      </div>
                      {court.description && (
                        <p className="text-xs text-muted mt-0.5 truncate">{court.description}</p>
                      )}
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <button
                        onClick={() => setEditCourt({ id: court.id, name: court.name, description: court.description ?? "" })}
                        className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-accent/10 hover:border-accent transition-colors"
                      >
                        Edit
                      </button>
                      {court.is_active ? (
                        <button
                          onClick={() => onDeactivateCourt(court.id, court.name)}
                          disabled={deactivatingCourtId === court.id}
                          className="rounded-lg border border-accent/50 bg-accent/5 px-3 py-1.5 text-xs font-semibold text-accent hover:bg-accent hover:text-background transition-colors disabled:opacity-40"
                        >
                          {deactivatingCourtId === court.id ? "…" : "Deactivate"}
                        </button>
                      ) : (
                        <button
                          onClick={() => onActivateCourt(court.id)}
                          disabled={activatingCourtId === court.id}
                          className="rounded-lg border border-green-400 bg-green-50 px-3 py-1.5 text-xs font-semibold text-green-700 hover:bg-green-500 hover:text-white transition-colors disabled:opacity-40"
                        >
                          {activatingCourtId === court.id ? "…" : "Activate"}
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {/* ── Announcements tab ── */}
        {activeTab === "announcements" && (
          <section className="space-y-5">
            {/* Header */}
            <div className="flex items-end justify-between gap-4 flex-wrap">
              <div>
                <span className="font-mono text-[12px] font-bold tracking-[.2em] uppercase text-accent mb-2 block">
                  {location?.name}
                </span>
                <h2 className="text-[30px] font-extrabold tracking-tight text-foreground leading-none">
                  Announcements
                </h2>
                <p className="text-[14.5px] text-muted mt-1.5">
                  Post updates about tournaments, maintenance, and court news for your players.
                </p>
              </div>
              <button
                onClick={() => {
                  setAnnouncementForm({ title: "", body: "" });
                  setEditingAnnouncement(null);
                  setAnnouncementError(null);
                  setAnnouncementImageFile(null);
                  setAnnouncementImagePreview(null);
                }}
                className="flex items-center gap-2 rounded-full bg-accent text-white px-5 py-[10px] text-[14px] font-semibold shadow-[0_12px_28px_color-mix(in_srgb,var(--color-accent)_30%,transparent)] hover:opacity-90 transition-opacity"
              >
                <Plus size={16} /> New announcement
              </button>
            </div>

            {/* List */}
            {announcementsLoading ? (
              <div className="space-y-3">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="rounded-[22px] border border-border bg-background h-28 animate-pulse" />
                ))}
              </div>
            ) : announcements === null ? (
              <p className="text-sm text-muted">Failed to load announcements.</p>
            ) : announcements.length === 0 ? (
              <div className="rounded-[22px] border border-dashed border-border bg-background/50 px-6 py-14 text-center">
                <div className="w-12 h-12 rounded-[14px] bg-accent/15 flex items-center justify-center mx-auto mb-4">
                  <Megaphone size={22} className="text-accent" />
                </div>
                <p className="font-semibold text-foreground text-[15px]">No announcements yet</p>
                <p className="text-sm text-muted mt-1">Create your first post to inform players about tournaments and events.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {announcements.map((a) => (
                  <div key={a.id} className="rounded-[22px] border border-border bg-background shadow-sm overflow-hidden">
                    {/* Banner image */}
                    {a.image_url && (
                      <div className="relative w-full h-44 bg-surface group/img">
                        <img
                          src={a.image_url}
                          alt={a.title}
                          onClick={() => setViewingImageUrl(a.image_url)}
                          className="w-full h-full object-cover cursor-zoom-in"
                        />
                        <button
                          title="View full image"
                          onClick={() => setViewingImageUrl(a.image_url)}
                          className="absolute bottom-2 left-2 w-7 h-7 rounded-full bg-black/50 text-white flex items-center justify-center opacity-0 group-hover/img:opacity-100 transition-opacity"
                        >
                          <ZoomIn size={13} />
                        </button>
                      </div>
                    )}
                    <div className="p-5 flex items-start justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <h3 className="text-[15px] font-bold text-foreground leading-tight">{a.title}</h3>
                          <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest ${a.is_active ? "bg-accent/15 text-accent" : "bg-border text-muted"}`}>
                            {a.is_active ? "Live" : "Hidden"}
                          </span>
                        </div>
                        {a.body && (
                          <p className="text-[13.5px] text-muted leading-relaxed line-clamp-3">{a.body}</p>
                        )}
                        <p className="font-mono text-[11px] text-muted/60 mt-2">
                          {new Date(a.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                          {a.updated_at !== a.created_at && " · edited"}
                        </p>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          title={a.is_active ? "Hide from players" : "Make live"}
                          onClick={async () => {
                            await fetch(`/api/admin/announcements/${a.id}`, {
                              method: "PATCH",
                              headers: { "content-type": "application/json" },
                              body: JSON.stringify({ is_active: !a.is_active }),
                            });
                            loadAnnouncements();
                          }}
                          className="w-9 h-9 rounded-xl flex items-center justify-center text-muted hover:bg-surface hover:text-foreground transition-colors"
                        >
                          {a.is_active ? <ToggleRight size={18} className="text-accent" /> : <ToggleLeft size={18} />}
                        </button>
                        <button
                          title="Edit"
                          onClick={() => {
                            setEditingAnnouncement(a);
                            setAnnouncementForm({ title: a.title, body: a.body });
                            setAnnouncementError(null);
                            setAnnouncementImageFile(null);
                            setAnnouncementImagePreview(a.image_url);
                          }}
                          className="w-9 h-9 rounded-xl flex items-center justify-center text-muted hover:bg-surface hover:text-foreground transition-colors"
                        >
                          <Pencil size={15} />
                        </button>
                        <button
                          title="Delete"
                          onClick={() => setDeletingAnnouncementId(a.id)}
                          className="w-9 h-9 rounded-xl flex items-center justify-center text-muted hover:bg-red-50 hover:text-red-500 transition-colors"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Create / Edit modal */}
            {announcementForm !== null && (
              <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm px-4 py-6">
                <div className="w-full max-w-lg rounded-[22px] border border-border bg-background shadow-xl overflow-hidden">
                  {/* Image preview at top of modal */}
                  {announcementImagePreview && (
                    <div className="relative w-full h-44 bg-surface group/prev">
                      <img
                        src={announcementImagePreview}
                        alt="Preview"
                        onClick={() => setViewingImageUrl(announcementImagePreview)}
                        className="w-full h-full object-cover cursor-zoom-in"
                      />
                      <button
                        title="View full image"
                        onClick={() => setViewingImageUrl(announcementImagePreview)}
                        className="absolute bottom-2 left-2 w-7 h-7 rounded-full bg-black/50 text-white flex items-center justify-center opacity-0 group-hover/prev:opacity-100 transition-opacity"
                      >
                        <ZoomIn size={13} />
                      </button>
                    </div>
                  )}

                  <div className="p-6 space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-[17px] font-bold text-foreground">
                        {editingAnnouncement ? "Edit announcement" : "New announcement"}
                      </h3>
                      <button
                        onClick={() => {
                          setAnnouncementForm(null);
                          setEditingAnnouncement(null);
                          setAnnouncementImageFile(null);
                          setAnnouncementImagePreview(null);
                        }}
                        className="w-9 h-9 rounded-full border border-border flex items-center justify-center text-muted hover:bg-surface"
                      >
                        <X size={16} />
                      </button>
                    </div>

                    <div className="space-y-3">
                      <div>
                        <label className="block text-[12px] font-semibold text-muted uppercase tracking-wide mb-1.5">Title</label>
                        <input
                          type="text"
                          value={announcementForm.title}
                          onChange={(e) => setAnnouncementForm((f) => f && ({ ...f, title: e.target.value }))}
                          placeholder="e.g. Summer Tournament Registration Open"
                          className="w-full rounded-xl border border-border bg-surface px-4 py-2.5 text-[14px] text-foreground placeholder:text-muted/60 focus:outline-none focus:border-accent"
                        />
                      </div>
                      <div>
                        <label className="block text-[12px] font-semibold text-muted uppercase tracking-wide mb-1.5">Body</label>
                        <textarea
                          rows={4}
                          value={announcementForm.body}
                          onChange={(e) => setAnnouncementForm((f) => f && ({ ...f, body: e.target.value }))}
                          placeholder="Write the full announcement here…"
                          className="w-full rounded-xl border border-border bg-surface px-4 py-2.5 text-[14px] text-foreground placeholder:text-muted/60 focus:outline-none focus:border-accent resize-none"
                        />
                      </div>

                      {/* Image picker */}
                      <div>
                        <label className="block text-[12px] font-semibold text-muted uppercase tracking-wide mb-1.5">Image</label>
                        <input
                          ref={announcementImageRef}
                          type="file"
                          accept="image/jpeg,image/png,image/webp,image/gif"
                          className="hidden"
                          onChange={(e) => {
                            const f = e.target.files?.[0];
                            if (!f) return;
                            setAnnouncementImageFile(f);
                            setAnnouncementImagePreview(URL.createObjectURL(f));
                          }}
                        />
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => announcementImageRef.current?.click()}
                            className="flex-1 rounded-xl border border-dashed border-border bg-surface px-4 py-3 text-[13.5px] font-semibold text-muted hover:border-accent hover:text-accent transition-colors flex items-center justify-center gap-2"
                          >
                            <Plus size={15} />
                            {announcementImagePreview ? "Replace image" : "Add image"}
                          </button>
                          {announcementImagePreview && (
                            <button
                              type="button"
                              onClick={() => { setAnnouncementImageFile(null); setAnnouncementImagePreview(null); }}
                              className="rounded-xl border border-dashed border-border bg-surface px-4 py-3 text-[13.5px] font-semibold text-red-500 hover:border-red-400 hover:bg-red-50 transition-colors flex items-center gap-2 shrink-0"
                            >
                              <Trash2 size={15} />
                              Remove
                            </button>
                          )}
                        </div>
                        {announcementImageFile && (
                          <p className="text-[12px] text-muted mt-1">{announcementImageFile.name} · {(announcementImageFile.size / 1024).toFixed(0)} KB</p>
                        )}
                      </div>

                      {announcementError && (
                        <p className="text-sm text-red-600">{announcementError}</p>
                      )}
                    </div>

                    <div className="flex gap-2.5 pt-1">
                      <button
                        onClick={() => {
                          setAnnouncementForm(null);
                          setEditingAnnouncement(null);
                          setAnnouncementImageFile(null);
                          setAnnouncementImagePreview(null);
                        }}
                        className="rounded-full border border-border px-5 py-2.5 text-[14px] font-semibold text-foreground hover:bg-surface transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        disabled={announcementSaving || !announcementForm.title.trim()}
                        onClick={async () => {
                          if (!announcementForm.title.trim()) return;
                          setAnnouncementSaving(true);
                          setAnnouncementError(null);
                          try {
                            // 1. Save text fields
                            const url = editingAnnouncement
                              ? `/api/admin/announcements/${editingAnnouncement.id}`
                              : "/api/admin/announcements";
                            const method = editingAnnouncement ? "PATCH" : "POST";
                            const res = await fetch(url, {
                              method,
                              headers: { "content-type": "application/json" },
                              body: JSON.stringify(announcementForm),
                            });
                            const json = await res.json().catch(() => ({}));
                            if (!res.ok) throw new Error(json.error || "Failed to save");

                            // 2. Upload image if a new file was chosen
                            if (announcementImageFile) {
                              const announcementId = editingAnnouncement?.id ?? json.announcement?.id;
                              if (announcementId) {
                                const fd = new FormData();
                                fd.append("file", announcementImageFile);
                                await fetch(`/api/admin/announcements/${announcementId}/image`, {
                                  method: "POST",
                                  body: fd,
                                });
                              }
                            }

                            setAnnouncementForm(null);
                            setEditingAnnouncement(null);
                            setAnnouncementImageFile(null);
                            setAnnouncementImagePreview(null);
                            setAnnouncements(null);
                            loadAnnouncements();
                          } catch (err) {
                            setAnnouncementError((err as Error).message);
                          } finally {
                            setAnnouncementSaving(false);
                          }
                        }}
                        className="flex-1 rounded-full bg-accent text-white px-5 py-2.5 text-[14px] font-semibold hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {announcementSaving ? "Saving…" : editingAnnouncement ? "Save changes" : "Post announcement"}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Image lightbox */}
            {viewingImageUrl && (
              <div
                className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
                onClick={() => setViewingImageUrl(null)}
              >
                <img
                  src={viewingImageUrl}
                  alt="Full size"
                  className="max-w-full max-h-full rounded-xl object-contain shadow-2xl"
                  onClick={(e) => e.stopPropagation()}
                />
                <button
                  onClick={() => setViewingImageUrl(null)}
                  className="absolute top-4 right-4 w-9 h-9 rounded-full bg-white/10 text-white flex items-center justify-center hover:bg-white/20 transition-colors"
                >
                  <X size={18} />
                </button>
              </div>
            )}

            {/* Delete confirm */}
            {deletingAnnouncementId && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4">
                <div className="w-full max-w-sm rounded-[22px] border border-border bg-background shadow-xl p-6 space-y-4">
                  <h3 className="text-[17px] font-bold text-foreground">Delete announcement?</h3>
                  <p className="text-[14px] text-muted">This will permanently remove the announcement and its image. Players will no longer see it.</p>
                  <div className="flex gap-2.5">
                    <button
                      onClick={() => setDeletingAnnouncementId(null)}
                      className="flex-1 rounded-full border border-border px-4 py-2.5 text-[14px] font-semibold text-foreground hover:bg-surface transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={async () => {
                        await fetch(`/api/admin/announcements/${deletingAnnouncementId}`, { method: "DELETE" });
                        setDeletingAnnouncementId(null);
                        setAnnouncements(null);
                        loadAnnouncements();
                      }}
                      className="flex-1 rounded-full bg-red-500 text-white px-4 py-2.5 text-[14px] font-semibold hover:bg-red-600 transition-colors"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            )}
          </section>
        )}

        {/* ── Settings tab ── */}
        {activeTab === "settings" && (
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
                    className={`flex items-center gap-2 rounded-lg border px-3 py-2.5 text-left transition-all ${
                      selectedColor === theme.key
                        ? "ring-2 ring-offset-1 ring-foreground scale-[1.02]"
                        : "hover:scale-[1.02]"
                    }`}
                    style={{
                      backgroundColor: theme.vars.background,
                      borderColor: theme.vars.border,
                      color: theme.vars.foreground,
                    }}
                  >
                    <span className="w-3.5 h-3.5 rounded-full shrink-0" style={{ backgroundColor: theme.vars.accent }} />
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

          </div>
        )}

      </main>

      {/* ── Pricing modal ── */}
      {showPricing && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 p-4"
          onClick={() => { if (!pricingSaving) setShowPricing(false); }}
        >
          <form
            onSubmit={onSavePricing}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm space-y-4 rounded-xl border border-border bg-background p-6 shadow-lg max-h-[90vh] overflow-y-auto"
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

      {/* ── Add court modal ── */}
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

      {/* ── Edit court modal ── */}
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

      {/* ── New booking modal ── */}
      {adminBookingForm && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm px-4 py-6"
          onClick={() => setAdminBookingForm(null)}
        >
          <div
            className="w-full max-w-lg rounded-[22px] border border-border bg-background shadow-xl overflow-hidden max-h-[90vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6 overflow-y-auto space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-[17px] font-bold text-foreground">New booking</h3>
                <button
                  onClick={() => setAdminBookingForm(null)}
                  className="w-9 h-9 rounded-full border border-border flex items-center justify-center text-muted hover:bg-surface"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="space-y-3">
                {/* Court */}
                <div>
                  <label className="block text-[12px] font-semibold text-muted uppercase tracking-wide mb-1.5">Court</label>
                  <select
                    value={adminBookingForm.court_id}
                    onChange={(e) => setAdminBookingForm((f) => f && ({ ...f, court_id: e.target.value }))}
                    className="w-full rounded-xl border border-border bg-surface px-4 py-2.5 text-[14px] text-foreground focus:outline-none focus:border-accent"
                  >
                    {(courts ?? []).filter((c) => c.is_active).map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>

                {/* Date */}
                <div>
                  <label className="block text-[12px] font-semibold text-muted uppercase tracking-wide mb-1.5">Date</label>
                  <input
                    type="date"
                    value={adminBookingForm.date}
                    onChange={(e) => setAdminBookingForm((f) => f && ({ ...f, date: e.target.value }))}
                    className="w-full rounded-xl border border-border bg-surface px-4 py-2.5 text-[14px] text-foreground focus:outline-none focus:border-accent"
                  />
                </div>

                {/* Time */}
                <div className="flex gap-3">
                  <div className="flex-1">
                    <label className="block text-[12px] font-semibold text-muted uppercase tracking-wide mb-1.5">Start time</label>
                    <select
                      value={adminBookingForm.start_hour}
                      onChange={(e) => {
                        const h = Number(e.target.value);
                        setAdminBookingForm((f) => f && ({ ...f, start_hour: h, end_hour: Math.max(f.end_hour, h + 1) }));
                      }}
                      className="w-full rounded-xl border border-border bg-surface px-4 py-2.5 text-[14px] text-foreground focus:outline-none focus:border-accent"
                    >
                      {TIME_SLOTS.slice(0, 23).map((s, i) => (
                        <option key={i} value={i}>{fmtTime(s.start + ":00")}</option>
                      ))}
                    </select>
                  </div>
                  <div className="flex-1">
                    <label className="block text-[12px] font-semibold text-muted uppercase tracking-wide mb-1.5">End time</label>
                    <select
                      value={adminBookingForm.end_hour}
                      onChange={(e) => setAdminBookingForm((f) => f && ({ ...f, end_hour: Number(e.target.value) }))}
                      className="w-full rounded-xl border border-border bg-surface px-4 py-2.5 text-[14px] text-foreground focus:outline-none focus:border-accent"
                    >
                      {TIME_SLOTS.slice(adminBookingForm.start_hour + 1).map((s, i) => {
                        const hour = adminBookingForm.start_hour + 1 + i;
                        return <option key={hour} value={hour}>{fmtTime(s.start + ":00")}</option>;
                      })}
                    </select>
                  </div>
                </div>

                {/* Booker */}
                <div>
                  <label className="block text-[12px] font-semibold text-muted uppercase tracking-wide mb-1.5">Name</label>
                  <input
                    type="text"
                    value={adminBookingForm.booker_name}
                    onChange={(e) => setAdminBookingForm((f) => f && ({ ...f, booker_name: e.target.value }))}
                    placeholder="Booker's full name"
                    className="w-full rounded-xl border border-border bg-surface px-4 py-2.5 text-[14px] text-foreground placeholder:text-muted/60 focus:outline-none focus:border-accent"
                  />
                </div>
                <div>
                  <label className="block text-[12px] font-semibold text-muted uppercase tracking-wide mb-1.5">Phone</label>
                  <input
                    type="tel"
                    value={adminBookingForm.booker_phone}
                    onChange={(e) => setAdminBookingForm((f) => f && ({ ...f, booker_phone: e.target.value }))}
                    placeholder="+63 9XX XXX XXXX"
                    className="w-full rounded-xl border border-border bg-surface px-4 py-2.5 text-[14px] text-foreground placeholder:text-muted/60 focus:outline-none focus:border-accent"
                  />
                </div>
                <div>
                  <label className="block text-[12px] font-semibold text-muted uppercase tracking-wide mb-1.5">Email <span className="normal-case font-normal">(optional)</span></label>
                  <input
                    type="email"
                    value={adminBookingForm.booker_email}
                    onChange={(e) => setAdminBookingForm((f) => f && ({ ...f, booker_email: e.target.value }))}
                    placeholder="email@example.com"
                    className="w-full rounded-xl border border-border bg-surface px-4 py-2.5 text-[14px] text-foreground placeholder:text-muted/60 focus:outline-none focus:border-accent"
                  />
                </div>
                <div>
                  <label className="block text-[12px] font-semibold text-muted uppercase tracking-wide mb-1.5">Notes <span className="normal-case font-normal">(optional)</span></label>
                  <textarea
                    rows={2}
                    value={adminBookingForm.notes}
                    onChange={(e) => setAdminBookingForm((f) => f && ({ ...f, notes: e.target.value }))}
                    placeholder="Any additional info…"
                    className="w-full rounded-xl border border-border bg-surface px-4 py-2.5 text-[14px] text-foreground placeholder:text-muted/60 focus:outline-none focus:border-accent resize-none"
                  />
                </div>

                {adminBookingError && (
                  <p className="text-sm text-red-600">{adminBookingError}</p>
                )}
              </div>

              <div className="flex gap-2.5 pt-1">
                <button
                  onClick={() => setAdminBookingForm(null)}
                  className="rounded-full border border-border px-5 py-2.5 text-[14px] font-semibold text-foreground hover:bg-surface transition-colors"
                >
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
                      loadBookings(adminBookingForm.date);
                      if (adminBookingForm.date !== date) setDate(adminBookingForm.date);
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
      {selectedBooking && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4"
          onClick={() => setSelectedBooking(null)}
        >
          <div
            className="w-full max-w-md rounded-xl border border-border bg-background shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-border px-5 py-4">
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-foreground">Booking Details</h2>
                <StatusBadge status={selectedBooking.status} />
              </div>
              <button onClick={() => setSelectedBooking(null)} className="text-muted hover:text-foreground text-lg leading-none">×</button>
            </div>
            <div className="px-5 py-4 space-y-3">
              {[
                { label: "Court", value: courtName(selectedBooking.court_id) },
                { label: "Date", value: displayDate(selectedBooking.date) },
                { label: "Time", value: `${fmtTime(selectedBooking.start_time)} – ${fmtTime(selectedBooking.end_time)}` },
              ].map(({ label, value }) => (
                <div key={label} className="flex gap-3">
                  <span className="w-24 shrink-0 text-xs text-muted font-semibold uppercase tracking-wide pt-0.5">{label}</span>
                  <span className="text-sm text-foreground">{value}</span>
                </div>
              ))}
              <div className="border-t border-border pt-3 space-y-3">
                {[
                  { label: "Booker", value: selectedBooking.booker_name },
                  { label: "Phone", value: selectedBooking.booker_phone || "—" },
                  { label: "Email", value: selectedBooking.booker_email ?? "—" },
                ].map(({ label, value }) => (
                  <div key={label} className="flex gap-3">
                    <span className="w-24 shrink-0 text-xs text-muted font-semibold uppercase tracking-wide pt-0.5">{label}</span>
                    <span className="text-sm text-foreground">{value}</span>
                  </div>
                ))}
              </div>
              <div className="border-t border-border pt-3 space-y-3">
                {[
                  { label: "Players", value: String(selectedBooking.player_count) },
                  { label: "Notes", value: selectedBooking.notes ?? "—" },
                ].map(({ label, value }) => (
                  <div key={label} className="flex gap-3">
                    <span className="w-24 shrink-0 text-xs text-muted font-semibold uppercase tracking-wide pt-0.5">{label}</span>
                    <span className="text-sm text-foreground">{value}</span>
                  </div>
                ))}
              </div>
              {selectedBooking.status === "refunded" && (
                <div className="border-t border-border pt-3 flex gap-3">
                  <span className="w-24 shrink-0 text-xs text-muted font-semibold uppercase tracking-wide pt-0.5">Refund reason</span>
                  <span className="text-sm text-foreground">{selectedBooking.refund_reason ?? "No reason provided"}</span>
                </div>
              )}
              <div className="border-t border-border pt-3 space-y-3">
                <div className="flex gap-3">
                  <span className="w-24 shrink-0 text-xs text-muted font-semibold uppercase tracking-wide pt-0.5">Booking ID</span>
                  <span className="text-xs font-mono text-foreground break-all">{selectedBooking.id}</span>
                </div>
              </div>
            </div>
            {selectedBooking.status !== "cancelled" && selectedBooking.status !== "refunded" && (
              <div className="flex gap-2 border-t border-border px-5 py-4">
                {selectedBooking.status === "pending_payment" && !isPast && (
                  <button
                    onClick={() => onConfirmPayment(selectedBooking.id)}
                    disabled={confirmingId === selectedBooking.id}
                    className="flex-1 rounded-lg border border-green-400 bg-green-50 px-3 py-2 text-sm font-semibold text-green-700 hover:bg-green-500 hover:text-white transition-colors disabled:opacity-40"
                  >
                    {confirmingId === selectedBooking.id ? "Confirming…" : "Confirm Payment"}
                  </button>
                )}
                {!isPast && (
                  <button
                    onClick={() => onCancelBooking(selectedBooking.id)}
                    disabled={cancellingId === selectedBooking.id}
                    className="flex-1 rounded-lg border border-accent/50 bg-accent/5 px-3 py-2 text-sm font-semibold text-accent hover:bg-accent hover:text-background transition-colors disabled:opacity-40"
                  >
                    {cancellingId === selectedBooking.id ? "Cancelling…" : "Cancel Booking"}
                  </button>
                )}
                {isPast && (
                  <button
                    onClick={() => { setSelectedBooking(null); setRefundTarget(selectedBooking.id); }}
                    disabled={refundingId === selectedBooking.id}
                    className="flex-1 rounded-lg border border-blue-400 bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-600 hover:text-white transition-colors disabled:opacity-40"
                  >
                    {refundingId === selectedBooking.id ? "Processing…" : "Mark as Refunded"}
                  </button>
                )}
              </div>
            )}
            {selectedBooking.status === "cancelled" && isPast && (
              <div className="flex gap-2 border-t border-border px-5 py-4">
                <button
                  onClick={() => { setSelectedBooking(null); setRefundTarget(selectedBooking.id); }}
                  disabled={refundingId === selectedBooking.id}
                  className="flex-1 rounded-lg border border-blue-400 bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-600 hover:text-white transition-colors disabled:opacity-40"
                >
                  {refundingId === selectedBooking.id ? "Processing…" : "Mark as Refunded"}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Refund reason dialog ── */}
      {refundTarget && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm px-4"
          onClick={() => setRefundTarget(null)}
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
                id="refund-reason-loc"
                placeholder="e.g. Court was unavailable, player requested cancellation…"
                rows={3}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted/50 focus:outline-none focus:border-accent resize-none"
              />
            </div>
            <div className="flex gap-2 border-t border-border px-5 py-4">
              <button
                onClick={() => setRefundTarget(null)}
                className="flex-1 rounded-lg border border-border px-3 py-2 text-sm font-semibold text-muted hover:bg-accent/5 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  const reason = (document.getElementById("refund-reason-loc") as HTMLTextAreaElement)?.value ?? "";
                  onRefundConfirm(reason);
                }}
                className="flex-1 rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700 transition-colors"
              >
                Mark Refunded
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Edit location info modal ── */}
      {editInfo && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 p-4"
          onClick={() => { if (!editInfoSaving) setEditInfo(null); }}
        >
          <form
            onSubmit={onSaveInfo}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md space-y-4 rounded-xl border border-border bg-background p-6 shadow-lg"
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
                className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground focus:outline-none focus:border-accent"
              />
            </label>

            <label className="block space-y-1">
              <span className="text-xs uppercase tracking-wide text-muted font-semibold">Address</span>
              <input
                type="text"
                value={editInfo.address}
                onChange={(e) => setEditInfo({ ...editInfo, address: e.target.value })}
                placeholder="e.g. 123 Main St, Manila"
                className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground focus:outline-none focus:border-accent"
              />
            </label>

            <label className="block space-y-1">
              <span className="text-xs uppercase tracking-wide text-muted font-semibold">Description</span>
              <textarea
                value={editInfo.description}
                onChange={(e) => setEditInfo({ ...editInfo, description: e.target.value })}
                rows={3}
                placeholder="Brief description shown to customers…"
                className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground focus:outline-none focus:border-accent resize-none"
              />
            </label>

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
    </div>
  );
}
