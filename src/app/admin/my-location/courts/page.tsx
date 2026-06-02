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
  const [editCourt, setEditCourt] = useState<{ id: string; name: string; description: string } | null>(null);
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
              ))}
            </div>
          )}
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
