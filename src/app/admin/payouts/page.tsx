"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, ChevronRight } from "lucide-react";
import { AdminNav } from "@/components/AdminNav";
import { weekStartIso, addDaysIso } from "@/lib/bookingValidation";

type LocationOption = { id: string; name: string };

type Payout = {
  id: string;
  date: string;
  start_time: string;
  end_time: string;
  booker_name: string;
  court_name: string | null;
  location_id: string | null;
  location_name: string | null;
  paid_amount: number;
  fee_percent: number;
  payout_amount: number;
  payout_status: "pending" | "disbursed" | "failed" | null;
  payout_disbursement_id: string | null;
  payout_disbursed_at: string | null;
};

type Totals = { disbursed: number; pending: number; failedCount: number; pendingCount: number };

type Group = {
  key: string;
  locationId: string | null;
  locationName: string;
  weekStart: string;
  items: Payout[];
  paidTotal: number;
  payoutTotal: number;
  pendingCount: number;
  pendingAmount: number;
  disbursedCount: number;
  failedCount: number;
};

const STATUS_STYLE: Record<string, string> = {
  pending: "bg-amber-100 text-amber-700",
  disbursed: "bg-green-100 text-green-700",
  failed: "bg-red-100 text-red-700",
};

function fmtPeso(n: number): string {
  return `₱${n.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function displayDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function fmtTime(t: string): string {
  const [h, m] = t.slice(0, 5).split(":").map(Number);
  const period = h < 12 ? "AM" : "PM";
  const hour = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${hour}:${String(m).padStart(2, "0")} ${period}`;
}

function weekRangeLabel(mondayIso: string): string {
  const [y, m, d] = mondayIso.split("-").map(Number);
  const monday = new Date(y, m - 1, d);
  const sunday = new Date(y, m - 1, d + 6);
  const monthShort = (date: Date) => date.toLocaleDateString("en-US", { month: "short" });
  // Built manually rather than via a single toLocaleDateString call — passing
  // { day, year } without { month } hits an Intl fallback that renders as
  // "2026 (day: 27)" instead of a clean date.
  if (monday.getMonth() === sunday.getMonth()) {
    return `${monthShort(monday)} ${monday.getDate()} – ${sunday.getDate()}, ${sunday.getFullYear()}`;
  }
  return `${monthShort(monday)} ${monday.getDate()} – ${monthShort(sunday)} ${sunday.getDate()}, ${sunday.getFullYear()}`;
}

function ReferenceDialog({ title, body, onConfirm, onClose }: {
  title: string;
  body: string;
  onConfirm: (referenceNumber: string) => void;
  onClose: () => void;
}) {
  const [referenceNumber, setReferenceNumber] = useState("");
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
          <h3 className="text-base font-bold text-foreground">{title}</h3>
          <p className="text-xs text-muted mt-1">{body}</p>
        </div>
        <div className="px-5 py-4">
          <label className="block text-[11px] font-semibold text-muted uppercase tracking-wide mb-1.5">
            Reference number <span className="text-accent">*</span>
          </label>
          <input
            type="text"
            autoFocus
            value={referenceNumber}
            onChange={(e) => setReferenceNumber(e.target.value)}
            placeholder="e.g. GCash transfer ref, bank trace number…"
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted/50 focus:outline-none focus:border-accent"
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
            onClick={() => onConfirm(referenceNumber)}
            disabled={!referenceNumber.trim()}
            className="flex-1 rounded-lg bg-violet-600 px-3 py-2 text-sm font-semibold text-white hover:bg-violet-700 transition-colors disabled:opacity-40"
          >
            Mark Disbursed
          </button>
        </div>
      </div>
    </div>
  );
}

const TODAY = new Date().toISOString().slice(0, 10);

const DISBURSE_ERRORS: Record<string, string> = {
  week_not_complete: "This booking's week isn't complete yet — refresh and try again later.",
  payout_destination_not_set: "This venue hasn't set up payout details yet.",
  reference_number_required: "A reference number is required.",
  not_eligible: "This booking is no longer eligible for disbursement.",
};

export default function PayoutsPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [locations, setLocations] = useState<LocationOption[]>([]);
  const [locationId, setLocationId] = useState("");
  const [status, setStatus] = useState("");
  const [payouts, setPayouts] = useState<Payout[] | null>(null);
  const [totals, setTotals] = useState<Totals | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [disbursingId, setDisbursingId] = useState<string | null>(null);
  const [disbursingGroup, setDisbursingGroup] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [singleTarget, setSingleTarget] = useState<string | null>(null);
  const [groupTarget, setGroupTarget] = useState<Group | null>(null);

  // Superadmin-only page — this reports on platform-held money.
  useEffect(() => {
    fetch("/api/admin/me")
      .then((r) => r.json())
      .then((j) => {
        if (j.role !== "admin") {
          router.replace(j.role === "location_admin" ? "/admin/my-location" : "/admin/login");
          return;
        }
        setReady(true);
      })
      .catch(() => router.replace("/admin/login"));
  }, [router]);

  useEffect(() => {
    if (!ready) return;
    fetch("/api/admin/locations")
      .then((r) => r.json())
      .then((j) => setLocations((j.locations ?? []).map((l: { id: string; name: string }) => ({ id: l.id, name: l.name }))))
      .catch(() => {});
  }, [ready]);

  const load = useCallback(async () => {
    setError(null);
    try {
      const params = new URLSearchParams();
      if (locationId) params.set("location_id", locationId);
      if (status) params.set("status", status);
      const res = await fetch(`/api/admin/payouts?${params}`);
      if (res.status === 401 || res.status === 403) { router.replace("/admin/login"); return; }
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to load payouts");
      setPayouts(json.payouts ?? []);
      setTotals(json.totals ?? null);
    } catch (err) {
      setError((err as Error).message);
    }
  }, [locationId, status, router]);

  useEffect(() => { if (ready) load(); }, [ready, load]);

  const groups = useMemo<Group[]>(() => {
    if (!payouts) return [];
    const map = new Map<string, Group>();
    for (const p of payouts) {
      const wk = weekStartIso(p.date);
      const key = `${p.location_id ?? "none"}__${wk}`;
      let g = map.get(key);
      if (!g) {
        g = {
          key,
          locationId: p.location_id,
          locationName: p.location_name ?? "—",
          weekStart: wk,
          items: [],
          paidTotal: 0,
          payoutTotal: 0,
          pendingCount: 0,
          pendingAmount: 0,
          disbursedCount: 0,
          failedCount: 0,
        };
        map.set(key, g);
      }
      g.items.push(p);
      g.paidTotal += p.paid_amount;
      g.payoutTotal += p.payout_amount;
      if (p.payout_status === "pending") { g.pendingCount++; g.pendingAmount += p.payout_amount; }
      if (p.payout_status === "disbursed") g.disbursedCount++;
      if (p.payout_status === "failed") g.failedCount++;
    }
    return [...map.values()].sort((a, b) =>
      b.weekStart.localeCompare(a.weekStart) || a.locationName.localeCompare(b.locationName)
    );
  }, [payouts]);

  function toggleGroup(key: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }

  async function onDisburseConfirm(referenceNumber: string) {
    if (!singleTarget) return;
    const id = singleTarget;
    setSingleTarget(null);
    setDisbursingId(id);
    try {
      const res = await fetch(`/api/admin/bookings/${encodeURIComponent(id)}/disburse`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reference_number: referenceNumber }),
      });
      if (res.status === 401 || res.status === 403) { router.replace("/admin/login"); return; }
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(DISBURSE_ERRORS[json.error] ?? json.error ?? "Disbursement failed");
      await load();
    } catch (err) {
      alert((err as Error).message);
    } finally {
      setDisbursingId(null);
    }
  }

  async function onDisburseGroupConfirm(referenceNumber: string) {
    if (!groupTarget) return;
    const group = groupTarget;
    setGroupTarget(null);
    setDisbursingGroup(group.key);
    const pendingIds = group.items.filter((p) => p.payout_status === "pending").map((p) => p.id);
    const failures: string[] = [];
    for (const id of pendingIds) {
      try {
        const res = await fetch(`/api/admin/bookings/${encodeURIComponent(id)}/disburse`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reference_number: referenceNumber }),
        });
        if (res.status === 401 || res.status === 403) { router.replace("/admin/login"); return; }
        if (!res.ok) failures.push(id);
      } catch {
        failures.push(id);
      }
    }
    await load();
    setDisbursingGroup(null);
    if (failures.length > 0) {
      alert(`${failures.length} of ${pendingIds.length} disbursements failed. Check individual bookings.`);
    }
  }

  function onLogout() {
    fetch("/api/admin/logout", { method: "POST" }).finally(() => router.replace("/admin/login"));
  }

  if (!ready) return null;

  return (
    <>
      <AdminNav onLogout={onLogout} />
      <main className="mx-auto max-w-5xl w-full px-4 py-10 space-y-8">
        <h1 className="text-2xl font-bold text-foreground">Payouts</h1>

        <div className="flex flex-wrap items-center gap-3">
          {locations.length > 0 && (
            <select
              value={locationId}
              onChange={(e) => setLocationId(e.target.value)}
              className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:border-accent"
            >
              <option value="">All locations</option>
              {locations.map((loc) => (
                <option key={loc.id} value={loc.id}>{loc.name}</option>
              ))}
            </select>
          )}
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:border-accent"
          >
            <option value="">All statuses</option>
            <option value="pending">Pending</option>
            <option value="disbursed">Disbursed</option>
            <option value="failed">Failed</option>
          </select>
          <button
            onClick={load}
            className="rounded-lg border border-border px-3 py-2 text-sm font-semibold text-foreground hover:bg-accent/10 hover:border-accent transition-colors ml-auto"
          >
            Refresh
          </button>
        </div>

        {totals && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="rounded-xl border border-border bg-background/60 p-4 shadow-sm">
              <p className="text-xs uppercase tracking-wide text-muted font-semibold">Disbursed</p>
              <p className="text-2xl font-bold text-foreground mt-1">{fmtPeso(totals.disbursed)}</p>
            </div>
            <div className="rounded-xl border border-border bg-background/60 p-4 shadow-sm">
              <p className="text-xs uppercase tracking-wide text-muted font-semibold">Pending payout</p>
              <p className="text-2xl font-bold text-foreground mt-1">{fmtPeso(totals.pending)}</p>
              <p className="text-xs text-muted mt-0.5">{totals.pendingCount} booking{totals.pendingCount === 1 ? "" : "s"}</p>
            </div>
            <div className="rounded-xl border border-border bg-background/60 p-4 shadow-sm">
              <p className="text-xs uppercase tracking-wide text-muted font-semibold">Failed</p>
              <p className="text-2xl font-bold text-foreground mt-1">{totals.failedCount}</p>
            </div>
          </div>
        )}

        {error && (
          <p className="rounded-lg border border-accent/40 bg-accent/5 px-4 py-3 text-sm text-accent font-semibold">{error}</p>
        )}

        {payouts === null && !error && <p className="text-sm text-muted">Loading…</p>}

        {payouts !== null && groups.length === 0 && (
          <div className="rounded-xl border border-border bg-background/60 p-8 text-center shadow-sm">
            <p className="text-sm text-muted">No Xendit payouts found.</p>
          </div>
        )}

        {groups.length > 0 && (
          <div className="space-y-3">
            {groups.map((g) => {
              const isOpen = expanded.has(g.key);
              const eligibleFrom = addDaysIso(g.weekStart, 7);
              const isEligible = TODAY >= eligibleFrom;
              return (
                <div key={g.key} className="overflow-hidden rounded-xl border border-border bg-background/60 shadow-sm">
                  <button
                    onClick={() => toggleGroup(g.key)}
                    className="w-full flex flex-wrap items-center gap-4 px-4 py-3.5 text-left hover:bg-accent/5 transition-colors"
                  >
                    {isOpen ? <ChevronDown size={16} className="text-muted shrink-0" /> : <ChevronRight size={16} className="text-muted shrink-0" />}
                    <div className="min-w-0">
                      <p className="font-semibold text-foreground">{g.locationName}</p>
                      <p className="text-xs text-muted">Week of {weekRangeLabel(g.weekStart)} · {g.items.length} booking{g.items.length === 1 ? "" : "s"}</p>
                    </div>
                    <div className="ml-auto flex items-center gap-5 text-right shrink-0">
                      <div>
                        <p className="text-[10px] uppercase tracking-wide text-muted font-semibold">Payout total</p>
                        <p className="font-semibold text-foreground">{fmtPeso(g.payoutTotal)}</p>
                      </div>
                      <div className="flex gap-1.5">
                        {g.pendingCount > 0 && <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${STATUS_STYLE.pending}`}>{g.pendingCount} pending</span>}
                        {g.disbursedCount > 0 && <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${STATUS_STYLE.disbursed}`}>{g.disbursedCount} disbursed</span>}
                        {g.failedCount > 0 && <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${STATUS_STYLE.failed}`}>{g.failedCount} failed</span>}
                      </div>
                    </div>
                  </button>

                  {isOpen && (
                    <div className="border-t border-border">
                      {g.pendingCount > 0 && (
                        <div className="flex justify-end items-center gap-2 px-4 py-2.5 border-b border-border bg-surface/50">
                          {!isEligible && (
                            <p className="text-xs text-muted">Available {displayDate(eligibleFrom)} (once this week is complete)</p>
                          )}
                          <button
                            onClick={() => setGroupTarget(g)}
                            disabled={disbursingGroup === g.key || !isEligible}
                            className="rounded-lg border border-violet-400 bg-violet-50 px-3 py-1.5 text-xs font-semibold text-violet-700 hover:bg-violet-600 hover:text-white transition-colors disabled:opacity-40 disabled:hover:bg-violet-50 disabled:hover:text-violet-700"
                          >
                            {disbursingGroup === g.key ? "Disbursing…" : `Disburse all pending (${fmtPeso(g.pendingAmount)})`}
                          </button>
                        </div>
                      )}
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead className="bg-surface">
                            <tr className="text-left">
                              <th className="px-4 py-2.5 text-xs uppercase tracking-wide text-muted font-semibold">Date / Time</th>
                              <th className="px-4 py-2.5 text-xs uppercase tracking-wide text-muted font-semibold">Booker</th>
                              <th className="px-4 py-2.5 text-xs uppercase tracking-wide text-muted font-semibold">Paid</th>
                              <th className="px-4 py-2.5 text-xs uppercase tracking-wide text-muted font-semibold">Fee</th>
                              <th className="px-4 py-2.5 text-xs uppercase tracking-wide text-muted font-semibold">Payout</th>
                              <th className="px-4 py-2.5 text-xs uppercase tracking-wide text-muted font-semibold">Status</th>
                              <th className="px-4 py-2.5 text-xs uppercase tracking-wide text-muted font-semibold">Action</th>
                            </tr>
                          </thead>
                          <tbody>
                            {g.items.map((p, i) => (
                              <tr key={p.id} className={i === 0 ? "" : "border-t border-border"}>
                                <td className="px-4 py-3 whitespace-nowrap">
                                  <p className="text-xs text-muted">{displayDate(p.date)}</p>
                                  <span className="text-foreground">{fmtTime(p.start_time)} – {fmtTime(p.end_time)}</span>
                                </td>
                                <td className="px-4 py-3">
                                  <p className="font-medium text-foreground">{p.booker_name}</p>
                                  <p className="text-xs text-muted">{p.court_name ?? "—"}</p>
                                </td>
                                <td className="px-4 py-3 whitespace-nowrap text-foreground">{fmtPeso(p.paid_amount)}</td>
                                <td className="px-4 py-3 whitespace-nowrap text-muted">{p.fee_percent}%</td>
                                <td className="px-4 py-3 whitespace-nowrap font-semibold text-foreground">{fmtPeso(p.payout_amount)}</td>
                                <td className="px-4 py-3 whitespace-nowrap">
                                  <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${STATUS_STYLE[p.payout_status ?? ""] ?? "bg-border text-muted"}`}>
                                    {p.payout_status ?? "—"}
                                  </span>
                                  {p.payout_disbursed_at && (
                                    <p className="text-xs text-muted mt-1">{new Date(p.payout_disbursed_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</p>
                                  )}
                                  {p.payout_disbursement_id && (
                                    <p className="text-xs font-mono text-muted mt-0.5">{p.payout_disbursement_id}</p>
                                  )}
                                </td>
                                <td className="px-4 py-3 whitespace-nowrap">
                                  {p.payout_status === "pending" && (
                                    isEligible ? (
                                      <button
                                        onClick={() => setSingleTarget(p.id)}
                                        disabled={disbursingId === p.id}
                                        className="rounded-lg border border-violet-400 bg-violet-50 px-3 py-1.5 text-xs font-semibold text-violet-700 hover:bg-violet-600 hover:text-white transition-colors disabled:opacity-40"
                                      >
                                        {disbursingId === p.id ? "Disbursing…" : "Disburse"}
                                      </button>
                                    ) : (
                                      <span className="text-xs text-muted">Available {displayDate(eligibleFrom)}</span>
                                    )
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </main>

      {singleTarget && (
        <ReferenceDialog
          title="Record payout"
          body="Send the payout to the venue yourself (bank/e-wallet transfer), then enter the transfer's reference number here as proof."
          onConfirm={onDisburseConfirm}
          onClose={() => setSingleTarget(null)}
        />
      )}

      {groupTarget && (
        <ReferenceDialog
          title="Record weekly payout"
          body={`Send ${fmtPeso(groupTarget.pendingAmount)} to ${groupTarget.locationName} yourself, then enter that transfer's reference number — it'll be recorded on all ${groupTarget.pendingCount} pending booking${groupTarget.pendingCount === 1 ? "" : "s"} in this group.`}
          onConfirm={onDisburseGroupConfirm}
          onClose={() => setGroupTarget(null)}
        />
      )}
    </>
  );
}
