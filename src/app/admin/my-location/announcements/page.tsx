"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { Megaphone, Plus, Pencil, Trash2, ToggleLeft, ToggleRight, ZoomIn, X } from "lucide-react";
import { useLocationAdminContext } from "@/contexts/LocationAdminContext";
import { SubscriptionBanner } from "@/components/SubscriptionBanner";
import type { Announcement } from "@/lib/admin-types";

export default function AnnouncementsPage() {
  const { location } = useLocationAdminContext();
  const [announcements, setAnnouncements] = useState<Announcement[] | null>(null);
  const [announcementsLoading, setAnnouncementsLoading] = useState(false);
  const [announcementForm, setAnnouncementForm] = useState<{ title: string; body: string } | null>(null);
  const [editingAnnouncement, setEditingAnnouncement] = useState<Announcement | null>(null);
  const [announcementSaving, setAnnouncementSaving] = useState(false);
  const [announcementError, setAnnouncementError] = useState<string | null>(null);
  const [deletingAnnouncementId, setDeletingAnnouncementId] = useState<string | null>(null);
  const [viewingImageUrl, setViewingImageUrl] = useState<string | null>(null);
  const [announcementImageFile, setAnnouncementImageFile] = useState<File | null>(null);
  const [announcementImagePreview, setAnnouncementImagePreview] = useState<string | null>(null);
  const announcementImageRef = useRef<HTMLInputElement>(null);

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
    loadAnnouncements();
  }, [loadAnnouncements]);

  return (
    <main className="mx-auto max-w-4xl w-full px-4 py-6 sm:py-8 space-y-6">
        <SubscriptionBanner location={location} />

        {/* ── Announcements section ── */}
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
                        className="w-10 h-10 min-w-11 rounded-xl flex items-center justify-center text-muted hover:bg-surface hover:text-foreground transition-colors"
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
                        className="w-10 h-10 min-w-11 rounded-xl flex items-center justify-center text-muted hover:bg-surface hover:text-foreground transition-colors"
                      >
                        <Pencil size={15} />
                      </button>
                      <button
                        title="Delete"
                        onClick={() => setDeletingAnnouncementId(a.id)}
                        className="w-10 h-10 min-w-11 rounded-xl flex items-center justify-center text-muted hover:bg-red-50 hover:text-red-500 transition-colors"
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
            <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm px-0 sm:px-4 py-0 sm:py-6">
              <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl border border-border bg-background shadow-xl overflow-hidden">
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
                        className="w-full rounded-xl border border-border bg-surface px-4 py-2.5 text-base sm:text-[14px] text-foreground placeholder:text-muted/60 focus:outline-none focus:border-accent"
                      />
                    </div>
                    <div>
                      <label className="block text-[12px] font-semibold text-muted uppercase tracking-wide mb-1.5">Body</label>
                      <textarea
                        rows={4}
                        value={announcementForm.body}
                        onChange={(e) => setAnnouncementForm((f) => f && ({ ...f, body: e.target.value }))}
                        placeholder="Write the full announcement here…"
                        className="w-full rounded-xl border border-border bg-surface px-4 py-2.5 text-base sm:text-[14px] text-foreground placeholder:text-muted/60 focus:outline-none focus:border-accent resize-none"
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
            <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm px-0 sm:px-4 py-0 sm:py-6">
              <div className="w-full max-w-sm max-h-[90vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl border border-border bg-background shadow-xl p-6 space-y-4">
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
      </main>
  );
}
