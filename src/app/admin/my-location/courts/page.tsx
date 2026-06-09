"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { useLocationAdminContext } from "@/contexts/LocationAdminContext";
import { SubscriptionBanner } from "@/components/SubscriptionBanner";
import type { Court } from "@/lib/types";

export default function CourtsPage() {
  const { me, location } = useLocationAdminContext();
  const [courts, setCourts] = useState<Court[] | null>(null);
  const [showAddCourt, setShowAddCourt] = useState(false);
  const [newCourtName, setNewCourtName] = useState("");
  const [addingCourt, setAddingCourt] = useState(false);
  const [addCourtError, setAddCourtError] = useState<string | null>(null);
  const [deactivatingCourtId, setDeactivatingCourtId] = useState<string | null>(null);
  const [activatingCourtId, setActivatingCourtId] = useState<string | null>(null);
  const [editCourt, setEditCourt] = useState<{
    id: string;
    name: string;
    description: string;
    parent_court_id: string | null;
    custom_day_rate: string;
    custom_night_rate: string;
    custom_rate_unit: "hr" | "pax" | "flat";
  } | null>(null);
  const [editCourtSaving, setEditCourtSaving] = useState(false);
  const [editCourtError, setEditCourtError] = useState<string | null>(null);
  const courtNameRef = useRef<HTMLInputElement>(null);

  const loadCourts = useCallback(async (locationId: string) => {
    const res = await fetch(`/api/admin/locations`);
    const json = await res.json();
    const loc = (json.locations ?? []).find((l: { id: string; courts: Court[] }) => l.id === locationId);
    if (loc) setCourts(loc.courts ?? []);
  }, []);

  useEffect(() => {
    if (me?.location_id) loadCourts(me.location_id);
  }, [me, loadCourts]);

  useEffect(() => {
    if (showAddCourt) setTimeout(() => courtNameRef.current?.focus(), 50);
  }, [showAddCourt]);

  async function onAddCourt(e: React.FormEvent<HTMLFormElement>) {
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

  async function onSaveEditCourt(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!editCourt) return;
    setEditCourtSaving(true);
    setEditCourtError(null);
    try {
      const res = await fetch(`/api/admin/courts/${encodeURIComponent(editCourt.id)}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: editCourt.name,
          description: editCourt.description,
          parent_court_id: editCourt.parent_court_id,
          custom_day_rate:   editCourt.custom_day_rate   !== "" ? parseFloat(editCourt.custom_day_rate)   : null,
          custom_night_rate: editCourt.custom_night_rate !== "" ? parseFloat(editCourt.custom_night_rate) : null,
          custom_rate_unit:  editCourt.custom_rate_unit,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msgs: Record<string, string> = {
          parent_not_found: "The selected parent court was not found.",
          parent_different_location: "Parent court must be in the same location.",
          parent_cannot_be_child: "The selected parent is already a subdivision of another court.",
          court_has_children: "This court already has subdivisions and cannot itself be a subdivision.",
        };
        throw new Error(msgs[json.error] || json.error || "Failed to update court");
      }
      setEditCourt(null);
      if (me?.location_id) loadCourts(me.location_id);
    } catch (err) {
      setEditCourtError((err as Error).message);
    } finally {
      setEditCourtSaving(false);
    }
  }

  // Courts eligible to be a parent: active, no parent themselves, not the court being edited
  const parentCandidates = (courts ?? []).filter(
    (c) => c.is_active && c.parent_court_id === null && c.id !== editCourt?.id
  );

  // Map for quick name lookup
  const courtNameById = Object.fromEntries((courts ?? []).map((c) => [c.id, c.name]));

  // Which courts have children (are parents)
  const parentIds = new Set((courts ?? []).map((c) => c.parent_court_id).filter(Boolean));

  return (
    <>
      <main className="mx-auto max-w-4xl w-full px-4 py-6 sm:py-8 space-y-6">
        <SubscriptionBanner location={location} />

        {/* ── Courts section ── */}
        <section className="space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
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
              {courts.map((court) => {
                const isChild = !!court.parent_court_id;
                const isParent = parentIds.has(court.id);
                const childCount = (courts ?? []).filter((c) => c.parent_court_id === court.id).length;

                return (
                  <div
                    key={court.id}
                    className={`flex items-start justify-between rounded-xl border bg-background px-4 py-3 gap-3 ${
                      court.is_active ? "border-border" : "border-border opacity-50"
                    } ${isChild ? "ml-4 border-l-2 border-l-accent/40" : ""}`}
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold text-foreground text-sm">{court.name}</p>
                        {!court.is_active && (
                          <span className="rounded-full bg-surface text-muted px-2 py-0.5 text-[10px] font-semibold uppercase tracking-widest border border-border">
                            Inactive
                          </span>
                        )}
                        {isParent && (
                          <span className="rounded-full bg-accent/10 text-accent px-2 py-0.5 text-[10px] font-semibold uppercase tracking-widest">
                            {childCount} {childCount === 1 ? "subdivision" : "subdivisions"}
                          </span>
                        )}
                      </div>
                      {isChild && court.parent_court_id && (
                        <p className="text-[11px] text-muted mt-0.5">
                          Subdivision of {courtNameById[court.parent_court_id] ?? "—"}
                        </p>
                      )}
                      {court.description && (
                        <p className="text-xs text-muted mt-0.5 truncate">{court.description}</p>
                      )}
                      {(court.custom_day_rate != null || court.custom_night_rate != null) && (() => {
                        const u = court.custom_rate_unit ?? "hr";
                        const unitLabel = u === "pax" ? "/pax" : u === "flat" ? " flat" : "/hr";
                        return (
                          <p className="text-[11px] text-accent font-semibold mt-0.5">
                            Custom rate:{" "}
                            {u === "flat"
                              ? `₱${court.custom_day_rate} flat fee`
                              : [
                                  court.custom_day_rate != null && `₱${court.custom_day_rate}${unitLabel} day`,
                                  court.custom_night_rate != null && `₱${court.custom_night_rate}${unitLabel} night`,
                                ].filter(Boolean).join(" · ")
                            }
                          </p>
                        );
                      })()}
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <button
                        onClick={() => setEditCourt({
                          id: court.id,
                          name: court.name,
                          description: court.description ?? "",
                          parent_court_id: court.parent_court_id,
                          custom_day_rate: court.custom_day_rate != null ? String(court.custom_day_rate) : "",
                          custom_night_rate: court.custom_night_rate != null ? String(court.custom_night_rate) : "",
                          custom_rate_unit: court.custom_rate_unit ?? "hr",
                        })}
                        className="rounded-lg border border-border px-3 py-1.5 min-h-11 text-xs font-semibold text-foreground hover:bg-accent/10 hover:border-accent transition-colors"
                      >
                        Edit
                      </button>
                      {court.is_active ? (
                        <button
                          onClick={() => onDeactivateCourt(court.id, court.name)}
                          disabled={deactivatingCourtId === court.id}
                          className="rounded-lg border border-accent/50 bg-accent/5 px-3 py-1.5 min-h-11 text-xs font-semibold text-accent hover:bg-accent hover:text-background transition-colors disabled:opacity-40"
                        >
                          {deactivatingCourtId === court.id ? "…" : "Deactivate"}
                        </button>
                      ) : (
                        <button
                          onClick={() => onActivateCourt(court.id)}
                          disabled={activatingCourtId === court.id}
                          className="rounded-lg border border-green-400 bg-green-50 px-3 py-1.5 min-h-11 text-xs font-semibold text-green-700 hover:bg-green-500 hover:text-white transition-colors disabled:opacity-40"
                        >
                          {activatingCourtId === court.id ? "…" : "Activate"}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* ── Explanation ── */}
        <section className="rounded-xl border border-border bg-background/60 px-5 py-4">
          <h3 className="text-sm font-bold text-foreground mb-1">Shared spaces</h3>
          <p className="text-xs text-muted leading-relaxed">
            If a large court (e.g. a basketball court) can be split into smaller courts (e.g. 3 pickleball courts),
            mark the smaller courts as subdivisions of the larger one. Booking the full court will block all subdivisions,
            and booking any subdivision will block the full court.
          </p>
        </section>
      </main>

      {/* ── Add court modal ── */}
      {showAddCourt && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-foreground/40 px-0 sm:px-4"
          onClick={() => { if (!addingCourt) setShowAddCourt(false); }}
        >
          <form
            onSubmit={onAddCourt}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm space-y-4 rounded-t-2xl sm:rounded-2xl border border-border bg-background p-6 shadow-lg max-h-[90vh] overflow-y-auto"
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
                className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-[16px] sm:text-sm text-foreground focus:outline-none focus:border-accent"
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
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-foreground/40 px-0 sm:px-4"
          onClick={() => { if (!editCourtSaving) setEditCourt(null); }}
        >
          <form
            onSubmit={onSaveEditCourt}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm space-y-4 rounded-t-2xl sm:rounded-2xl border border-border bg-background p-6 shadow-lg max-h-[90vh] overflow-y-auto"
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
                className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-[16px] sm:text-sm text-foreground focus:outline-none focus:border-accent"
              />
            </label>

            <label className="block space-y-1">
              <span className="text-xs uppercase tracking-wide text-muted font-semibold">Description</span>
              <textarea
                value={editCourt.description}
                onChange={(e) => setEditCourt({ ...editCourt, description: e.target.value })}
                rows={3}
                placeholder="Optional notes about this court…"
                className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-[16px] sm:text-sm text-foreground focus:outline-none focus:border-accent resize-none"
              />
            </label>

            {/* Parent court selector */}
            <label className="block space-y-1">
              <span className="text-xs uppercase tracking-wide text-muted font-semibold">
                Shared space (parent court)
              </span>
              <select
                value={editCourt.parent_court_id ?? ""}
                onChange={(e) =>
                  setEditCourt({ ...editCourt, parent_court_id: e.target.value || null })
                }
                className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-[16px] sm:text-sm text-foreground focus:outline-none focus:border-accent"
              >
                <option value="">None (standalone court)</option>
                {parentCandidates.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
              <p className="text-[11px] text-muted">
                If this court shares physical space with a larger court, select that court as the parent. Booking the parent will block this court and vice versa.
              </p>
            </label>

            {/* Custom rates */}
            <div className="space-y-2">
              <span className="text-xs uppercase tracking-wide text-muted font-semibold block">
                Custom rates <span className="normal-case font-normal">(leave blank to use location default)</span>
              </span>

              {/* Rate unit */}
              <div>
                <span className="text-[11px] text-muted block mb-1">Pricing unit</span>
                <div className="flex gap-2">
                  {([
                    { value: "hr",   label: "/hr",   desc: "Per hour" },
                    { value: "pax",  label: "/pax",  desc: "Per person" },
                    { value: "flat", label: "Flat",  desc: "Fixed fee" },
                  ] as const).map(({ value, label, desc }) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setEditCourt({ ...editCourt, custom_rate_unit: value })}
                      className={`flex-1 rounded-lg border px-3 py-2 text-xs font-semibold transition-colors ${
                        editCourt.custom_rate_unit === value
                          ? "bg-accent/15 border-accent text-accent"
                          : "border-border text-muted hover:border-accent/50"
                      }`}
                    >
                      <span className="block text-[13px]">{label}</span>
                      <span className="block font-normal text-[10px] mt-0.5 opacity-70">{desc}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Rate inputs — hide night rate for flat since it's a single fee */}
              <div className={`flex gap-3 ${editCourt.custom_rate_unit === "flat" ? "" : ""}`}>
                <label className="flex-1 space-y-1">
                  <span className="text-[11px] text-muted">
                    {editCourt.custom_rate_unit === "flat" ? "Fee (₱)" : `Day rate (₱${editCourt.custom_rate_unit === "pax" ? "/pax" : "/hr"})`}
                  </span>
                  <input
                    type="number"
                    min={0}
                    step={0.01}
                    value={editCourt.custom_day_rate}
                    onChange={(e) => setEditCourt({ ...editCourt, custom_day_rate: e.target.value })}
                    placeholder={location ? String(location.day_rate) : "—"}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-[16px] sm:text-sm text-foreground placeholder:text-muted/50 focus:outline-none focus:border-accent"
                  />
                </label>
                {editCourt.custom_rate_unit !== "flat" && (
                  <label className="flex-1 space-y-1">
                    <span className="text-[11px] text-muted">
                      {`Night rate (₱${editCourt.custom_rate_unit === "pax" ? "/pax" : "/hr"})`}
                    </span>
                    <input
                      type="number"
                      min={0}
                      step={0.01}
                      value={editCourt.custom_night_rate}
                      onChange={(e) => setEditCourt({ ...editCourt, custom_night_rate: e.target.value })}
                      placeholder={location ? String(location.night_rate) : "—"}
                      className="w-full rounded-lg border border-border bg-background px-3 py-2 text-[16px] sm:text-sm text-foreground placeholder:text-muted/50 focus:outline-none focus:border-accent"
                    />
                  </label>
                )}
              </div>

              {(editCourt.custom_day_rate !== "" || editCourt.custom_night_rate !== "") && (
                <button
                  type="button"
                  onClick={() => setEditCourt({ ...editCourt, custom_day_rate: "", custom_night_rate: "", custom_rate_unit: "hr" })}
                  className="text-[11px] text-accent hover:underline"
                >
                  Clear — use location default
                </button>
              )}
            </div>

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
