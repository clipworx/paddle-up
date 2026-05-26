"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AdminNav } from "@/components/AdminNav";
import type { Booking, Court } from "@/lib/types";

type BookingWithCourt = Booking & { court_name?: string };

function formatDate(d: Date): string {
  return d.toISOString().split("T")[0];
}

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

export default function AdminBookingsPage() {
  const router = useRouter();
  const today = formatDate(new Date());
  const [date, setDate] = useState(today);
  const [courts, setCourts] = useState<Court[]>([]);
  const [bookings, setBookings] = useState<BookingWithCourt[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);

  const loadCourts = useCallback(async () => {
    const res = await fetch("/api/courts");
    if (res.status === 401) { router.replace("/admin/login"); return; }
    const json = await res.json();
    setCourts(json.courts ?? []);
  }, [router]);

  const loadBookings = useCallback(async (d: string) => {
    setError(null);
    setBookings(null);
    try {
      const res = await fetch(`/api/bookings?date=${d}`);
      if (res.status === 401) { router.replace("/admin/login"); return; }
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to load bookings");
      setBookings(json.bookings ?? []);
    } catch (err) {
      setError((err as Error).message);
    }
  }, [router]);

  useEffect(() => { loadCourts(); }, [loadCourts]);
  useEffect(() => { loadBookings(date); }, [date, loadBookings]);

  function courtName(courtId: string): string {
    return courts.find((c) => c.id === courtId)?.name ?? courtId;
  }

  async function onCancel(id: string) {
    if (!confirm("Cancel this booking? The player will not be notified automatically.")) return;
    setCancellingId(id);
    try {
      const res = await fetch(`/api/admin/bookings/${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      if (res.status === 401) { router.replace("/admin/login"); return; }
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || "Cancel failed");
      await loadBookings(date);
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
      if (res.status === 401) { router.replace("/admin/login"); return; }
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || "Confirm failed");
      await loadBookings(date);
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

      {/* Date picker */}
      <div className="flex items-center gap-3">
        <button
          onClick={prevDay}
          className="rounded-lg border border-border px-3 py-2 text-sm font-semibold text-foreground hover:bg-accent/10 hover:border-accent transition-colors"
        >
          ‹
        </button>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:border-accent"
        />
        <span className="text-sm text-muted hidden sm:block">
          {displayDate(date)}
        </span>
        {date === today && (
          <span className="rounded-full bg-accent/15 text-accent px-2 py-0.5 text-[10px] font-semibold uppercase tracking-widest">
            Today
          </span>
        )}
        <button
          onClick={nextDay}
          className="rounded-lg border border-border px-3 py-2 text-sm font-semibold text-foreground hover:bg-accent/10 hover:border-accent transition-colors"
        >
          ›
        </button>
        <button
          onClick={() => loadBookings(date)}
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
          <p className="text-sm text-muted">
            No bookings for {displayDate(date)}.
          </p>
        </div>
      )}

      {bookings !== null && bookings.length > 0 && (
        <div className="overflow-hidden rounded-xl border border-border bg-background/60 shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-surface">
                <tr className="text-left">
                  <th className="px-4 py-3 text-xs uppercase tracking-wide text-muted font-semibold">Court</th>
                  <th className="px-4 py-3 text-xs uppercase tracking-wide text-muted font-semibold">Time</th>
                  <th className="px-4 py-3 text-xs uppercase tracking-wide text-muted font-semibold">Booker</th>
                  <th className="px-4 py-3 text-xs uppercase tracking-wide text-muted font-semibold">Email</th>
                  <th className="px-4 py-3 text-xs uppercase tracking-wide text-muted font-semibold">Players</th>
                  <th className="px-4 py-3 text-xs uppercase tracking-wide text-muted font-semibold">Notes</th>
                  <th className="px-4 py-3 text-xs uppercase tracking-wide text-muted font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {bookings.map((b, i) => (
                  <tr
                    key={b.id}
                    className={`${i === 0 ? "" : "border-t border-border"} ${b.status === "pending_payment" ? "bg-yellow-50/60" : "hover:bg-accent/5"} transition-colors`}
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
                    <td className="px-4 py-3 text-foreground">{b.booker_name}</td>
                    <td className="px-4 py-3 text-muted">{b.booker_email}</td>
                    <td className="px-4 py-3 text-foreground text-center">{b.player_count}</td>
                    <td className="px-4 py-3 text-muted max-w-45 truncate">{b.notes ?? "—"}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        {b.status === "pending_payment" && (
                          <button
                            onClick={() => onConfirm(b.id)}
                            disabled={confirmingId === b.id}
                            className="rounded-lg border border-green-400 bg-green-50 px-3 py-1.5 text-xs font-semibold text-green-700 hover:bg-green-500 hover:text-white transition-colors disabled:opacity-40"
                          >
                            {confirmingId === b.id ? "…" : "Confirm"}
                          </button>
                        )}
                        <button
                          onClick={() => onCancel(b.id)}
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
    </main>
    </>
  );
}
