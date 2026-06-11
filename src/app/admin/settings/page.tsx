"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AdminNav } from "@/components/AdminNav";

type SiteSettings = {
  contact_email: string;
  contact_facebook: string;
  contact_instagram: string;
  contact_whatsapp: string;
};

export default function AdminSettingsPage() {
  const router = useRouter();
  const [form, setForm] = useState<SiteSettings>({
    contact_email: "",
    contact_facebook: "",
    contact_instagram: "",
    contact_whatsapp: "",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/site-settings");
    if (res.status === 401 || res.status === 403) { router.replace("/admin/login"); return; }
    const json = await res.json();
    setForm({
      contact_email:     json.contact_email     ?? "",
      contact_facebook:  json.contact_facebook  ?? "",
      contact_instagram: json.contact_instagram ?? "",
      contact_whatsapp:  json.contact_whatsapp  ?? "",
    });
    setLoading(false);
  }, [router]);

  useEffect(() => { load(); }, [load]);

  async function onLogout() {
    await fetch("/api/admin/logout", { method: "POST" });
    router.replace("/admin/login");
  }

  async function onSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(false);
    try {
      const res = await fetch("/api/admin/site-settings", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(form),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || "Failed to save");
      setSuccess(true);
      setTimeout(() => setSuccess(false), 2500);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <AdminNav onLogout={onLogout} />
      <main className="mx-auto max-w-2xl w-full px-4 py-6 sm:py-8 space-y-6">
        <div>
          <h1 className="text-base font-bold text-foreground">Site settings</h1>
          <p className="text-xs text-muted mt-0.5">
            Contact details shown in the footer so venue owners can reach you to register.
          </p>
        </div>

        {loading ? (
          <p className="text-sm text-muted">Loading…</p>
        ) : (
          <form onSubmit={onSave} className="rounded-xl border border-border bg-background p-5 space-y-4">
            <h2 className="text-sm font-bold text-foreground">Contact info</h2>
            <p className="text-xs text-muted -mt-2">
              Leave a field blank to hide it from the footer.
            </p>

            <label className="block space-y-1">
              <span className="text-xs uppercase tracking-wide text-muted font-semibold">Email</span>
              <input
                type="email"
                value={form.contact_email}
                onChange={(e) => setForm({ ...form, contact_email: e.target.value })}
                placeholder="hello@example.com"
                className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground focus:outline-none focus:border-accent"
              />
            </label>

            <label className="block space-y-1">
              <span className="text-xs uppercase tracking-wide text-muted font-semibold">Facebook page URL</span>
              <input
                type="url"
                value={form.contact_facebook}
                onChange={(e) => setForm({ ...form, contact_facebook: e.target.value })}
                placeholder="https://facebook.com/yourpage"
                className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground focus:outline-none focus:border-accent"
              />
            </label>

            <label className="block space-y-1">
              <span className="text-xs uppercase tracking-wide text-muted font-semibold">Instagram profile URL</span>
              <input
                type="url"
                value={form.contact_instagram}
                onChange={(e) => setForm({ ...form, contact_instagram: e.target.value })}
                placeholder="https://instagram.com/yourhandle"
                className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground focus:outline-none focus:border-accent"
              />
            </label>

            <label className="block space-y-1">
              <span className="text-xs uppercase tracking-wide text-muted font-semibold">WhatsApp number</span>
              <input
                type="text"
                value={form.contact_whatsapp}
                onChange={(e) => setForm({ ...form, contact_whatsapp: e.target.value })}
                placeholder="+639171234567"
                className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground focus:outline-none focus:border-accent"
              />
              <p className="text-[11px] text-muted">Include country code, e.g. +63 for Philippines.</p>
            </label>

            {error && <p className="text-sm text-accent font-semibold">{error}</p>}
            {success && <p className="text-sm text-green-600 font-semibold">Saved.</p>}

            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-accent text-background px-5 py-2.5 text-sm font-semibold hover:bg-muted transition-colors disabled:opacity-40"
            >
              {saving ? "Saving…" : "Save settings"}
            </button>
          </form>
        )}
      </main>
    </>
  );
}
