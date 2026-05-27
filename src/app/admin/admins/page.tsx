"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AdminNav } from "@/components/AdminNav";

type AdminEntry = {
  id: string;
  username: string;
  role: "admin" | "location_admin";
  location_id: string | null;
  location_name: string | null;
  email: string | null;
  created_at: string;
  last_login_at: string | null;
};

type SuperAdminForm = { username: string; password: string; confirm: string; email: string };
const EMPTY_SUPER: SuperAdminForm = { username: "", password: "", confirm: "", email: "" };

export default function AdminAdminsPage() {
  const router = useRouter();
  const [admins, setAdmins] = useState<AdminEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [myId, setMyId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Create super admin modal
  const [showCreateAdmin, setShowCreateAdmin] = useState(false);
  const [adminForm, setAdminForm] = useState<SuperAdminForm>(EMPTY_SUPER);
  const [adminSaving, setAdminSaving] = useState(false);
  const [adminFormError, setAdminFormError] = useState<string | null>(null);
  const adminUsernameRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [meRes, adminsRes] = await Promise.all([
        fetch("/api/admin/me"),
        fetch("/api/admin/admins"),
      ]);
      if (meRes.status === 401 || adminsRes.status === 401) {
        router.replace("/admin/login");
        return;
      }
      if (adminsRes.status === 403) {
        router.replace("/admin/my-location");
        return;
      }
      const meJson = await meRes.json();
      const adminsJson = await adminsRes.json();
      setMyId(meJson.id);
      if (!adminsJson.admins) throw new Error(adminsJson.error || "Failed to load");
      setAdmins(adminsJson.admins);
    } catch (err) {
      setError((err as Error).message);
    }
  }, [router]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (showCreateAdmin) setTimeout(() => adminUsernameRef.current?.focus(), 50);
  }, [showCreateAdmin]);

  async function onCreateAdmin(e: FormEvent) {
    e.preventDefault();
    setAdminFormError(null);
    if (!adminForm.username.trim()) { setAdminFormError("Username is required."); return; }
    if (adminForm.password.length < 4) { setAdminFormError("Password must be at least 4 characters."); return; }
    if (adminForm.password !== adminForm.confirm) { setAdminFormError("Passwords do not match."); return; }

    setAdminSaving(true);
    try {
      const res = await fetch("/api/admin/admins", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ role: "admin", username: adminForm.username, password: adminForm.password, email: adminForm.email || undefined }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msgs: Record<string, string> = {
          username_taken: "That username is already taken.",
          password_too_short: "Password must be at least 4 characters.",
        };
        setAdminFormError(msgs[json.error] ?? json.error ?? "Failed to create");
        return;
      }
      setShowCreateAdmin(false);
      setAdminForm(EMPTY_SUPER);
      await load();
    } finally {
      setAdminSaving(false);
    }
  }

  async function onDelete(id: string, username: string) {
    if (!confirm(`Remove admin "${username}"? They will immediately lose access.`)) return;
    setDeletingId(id);
    try {
      const res = await fetch(`/api/admin/admins/${encodeURIComponent(id)}`, { method: "DELETE" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || "Delete failed");
      await load();
    } catch (err) {
      alert((err as Error).message);
    } finally {
      setDeletingId(null);
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
      <h1 className="text-2xl font-bold text-foreground">Admin accounts</h1>

      {error && (
        <p className="rounded-lg border border-accent/40 bg-accent/5 px-4 py-3 text-sm text-accent font-semibold">
          {error}
        </p>
      )}

      {/* Action cards */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-border bg-background/60 p-5 shadow-sm space-y-2">
          <h2 className="font-bold text-foreground text-sm">Location admin</h2>
          <p className="text-xs text-muted leading-relaxed">
            Can add courts and manage bookings for their assigned location only.
          </p>
          <Link
            href="/admin/register"
            className="inline-flex items-center gap-1.5 rounded-lg bg-accent text-background px-4 py-2 text-sm font-semibold hover:bg-muted transition-colors mt-1"
          >
            Register location admin →
          </Link>
        </div>

        <div className="rounded-xl border border-border bg-background/60 p-5 shadow-sm space-y-2">
          <h2 className="font-bold text-foreground text-sm">Super admin</h2>
          <p className="text-xs text-muted leading-relaxed">
            Full access: manage all locations, bookings, and admin accounts.
          </p>
          <button
            onClick={() => { setShowCreateAdmin(true); setAdminFormError(null); setAdminForm(EMPTY_SUPER); }}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border text-foreground px-4 py-2 text-sm font-semibold hover:bg-accent/10 hover:border-accent transition-colors mt-1"
          >
            Create super admin
          </button>
        </div>
      </div>

      {/* Admins table */}
      {admins === null && !error && <p className="text-sm text-muted">Loading…</p>}

      {admins !== null && admins.length === 0 && (
        <div className="rounded-xl border border-border bg-background/60 p-8 text-center">
          <p className="text-sm text-muted">No admin accounts yet.</p>
        </div>
      )}

      {admins !== null && admins.length > 0 && (
        <div className="overflow-hidden rounded-xl border border-border bg-background/60 shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-surface">
                <tr className="text-left">
                  <th className="px-4 py-3 text-xs uppercase tracking-wide text-muted font-semibold">Username</th>
                  <th className="px-4 py-3 text-xs uppercase tracking-wide text-muted font-semibold">Role</th>
                  <th className="px-4 py-3 text-xs uppercase tracking-wide text-muted font-semibold">Location</th>
                  <th className="px-4 py-3 text-xs uppercase tracking-wide text-muted font-semibold">Email</th>
                  <th className="px-4 py-3 text-xs uppercase tracking-wide text-muted font-semibold">Last login</th>
                  <th className="px-4 py-3 text-xs uppercase tracking-wide text-muted font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {admins.map((a, i) => (
                  <tr
                    key={a.id}
                    className={i === 0 ? "hover:bg-accent/5 transition-colors" : "border-t border-border hover:bg-accent/5 transition-colors"}
                  >
                    <td className="px-4 py-3 font-semibold text-foreground">
                      {a.username}
                      {a.id === myId && (
                        <span className="ml-2 text-[10px] font-semibold uppercase tracking-widest text-accent">(you)</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-widest ${
                        a.role === "admin" ? "bg-accent/15 text-accent" : "bg-border text-muted"
                      }`}>
                        {a.role === "admin" ? "Super admin" : "Location admin"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted">{a.location_name ?? "—"}</td>
                    <td className="px-4 py-3 text-muted text-xs">{a.email ?? "—"}</td>
                    <td className="px-4 py-3 text-muted text-xs">
                      {a.last_login_at ? new Date(a.last_login_at).toLocaleString() : "Never"}
                    </td>
                    <td className="px-4 py-3">
                      {a.id !== myId ? (
                        <button
                          onClick={() => onDelete(a.id, a.username)}
                          disabled={deletingId === a.id}
                          className="rounded-lg border border-accent/50 bg-accent/5 px-3 py-1.5 text-xs font-semibold text-accent hover:bg-accent hover:text-background transition-colors disabled:opacity-40"
                        >
                          {deletingId === a.id ? "Removing…" : "Remove"}
                        </button>
                      ) : (
                        <span className="text-xs text-muted">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Create super admin modal */}
      {showCreateAdmin && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 p-4"
          onClick={() => { if (!adminSaving) setShowCreateAdmin(false); }}
        >
          <form
            onSubmit={onCreateAdmin}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md space-y-4 rounded-xl border border-border bg-background p-6 shadow-lg"
          >
            <div>
              <div className="inline-block rounded-full bg-accent/15 text-accent px-3 py-0.5 text-[10px] font-semibold uppercase tracking-widest">
                New super admin
              </div>
              <h2 className="mt-2 text-lg font-bold text-foreground">Create admin account</h2>
              <p className="text-xs text-muted mt-1">
                Super admins have full access to all locations, bookings, and admin management.
              </p>
            </div>

            <label className="block space-y-1">
              <span className="text-xs uppercase tracking-wide text-muted font-semibold">
                Username <span className="text-accent">*</span>
              </span>
              <input
                ref={adminUsernameRef}
                type="text"
                required
                value={adminForm.username}
                onChange={(e) => setAdminForm({ ...adminForm, username: e.target.value })}
                placeholder="e.g. john_doe"
                className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground focus:outline-none focus:border-accent"
              />
            </label>

            <label className="block space-y-1">
              <span className="text-xs uppercase tracking-wide text-muted font-semibold">
                Notification email
              </span>
              <input
                type="email"
                value={adminForm.email}
                onChange={(e) => setAdminForm({ ...adminForm, email: e.target.value })}
                placeholder="e.g. admin@venue.com"
                className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground focus:outline-none focus:border-accent"
              />
              <p className="text-[11px] text-muted">Receives booking notifications.</p>
            </label>

            <label className="block space-y-1">
              <span className="text-xs uppercase tracking-wide text-muted font-semibold">
                Password <span className="text-accent">*</span>
              </span>
              <input
                type="password"
                required
                value={adminForm.password}
                onChange={(e) => setAdminForm({ ...adminForm, password: e.target.value })}
                autoComplete="new-password"
                className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground focus:outline-none focus:border-accent"
              />
            </label>

            <label className="block space-y-1">
              <span className="text-xs uppercase tracking-wide text-muted font-semibold">
                Confirm password <span className="text-accent">*</span>
              </span>
              <input
                type="password"
                required
                value={adminForm.confirm}
                onChange={(e) => setAdminForm({ ...adminForm, confirm: e.target.value })}
                autoComplete="new-password"
                className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground focus:outline-none focus:border-accent"
              />
            </label>

            {adminFormError && (
              <p className="text-sm text-accent font-semibold">{adminFormError}</p>
            )}

            <div className="flex gap-2 justify-end pt-1">
              <button
                type="button"
                disabled={adminSaving}
                onClick={() => setShowCreateAdmin(false)}
                className="rounded-lg border border-border px-4 py-2 text-sm font-semibold text-foreground hover:bg-accent/10 hover:border-accent transition-colors disabled:opacity-40"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={adminSaving}
                className="rounded-lg bg-accent text-background px-4 py-2 text-sm font-semibold hover:bg-muted transition-colors disabled:opacity-40"
              >
                {adminSaving ? "Creating…" : "Create account"}
              </button>
            </div>
          </form>
        </div>
      )}
    </main>
    </>
  );
}
