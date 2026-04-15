"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Logo } from "@/components/Logo";

type AdminSession = {
  id: string;
  code: string;
  state: {
    players?: unknown[];
    courtCount?: number;
    history?: unknown[];
  } | null;
  updated_at: string;
};

type PasswordModal = {
  code: string;
  password: string;
  confirm: string;
  saving: boolean;
  error: string | null;
};

export default function AdminDashboardPage() {
  const router = useRouter();
  const [sessions, setSessions] = useState<AdminSession[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [deletingCode, setDeletingCode] = useState<string | null>(null);
  const [passwordModal, setPasswordModal] = useState<PasswordModal | null>(
    null
  );

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch("/api/admin/sessions", { cache: "no-store" });
      if (res.status === 401) {
        router.replace("/admin/login");
        return;
      }
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to load sessions");
      setSessions(json.sessions);
    } catch (err) {
      setError((err as Error).message);
    }
  }, [router]);

  useEffect(() => {
    load();
  }, [load]);

  async function onDelete(code: string) {
    if (!confirm(`Delete session ${code}? This cannot be undone.`)) return;
    setDeletingCode(code);
    try {
      const res = await fetch(
        `/api/admin/sessions/${encodeURIComponent(code)}`,
        { method: "DELETE" }
      );
      if (res.status === 401) {
        router.replace("/admin/login");
        return;
      }
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || "Delete failed");
      await load();
    } catch (err) {
      alert((err as Error).message);
    } finally {
      setDeletingCode(null);
    }
  }

  async function onLogout() {
    await fetch("/api/admin/logout", { method: "POST" });
    router.replace("/admin/login");
  }

  function openPasswordModal(code: string) {
    setPasswordModal({
      code,
      password: "",
      confirm: "",
      saving: false,
      error: null,
    });
  }

  async function onSavePassword(e: FormEvent) {
    e.preventDefault();
    if (!passwordModal) return;
    const password = passwordModal.password.trim();
    if (password.length < 4) {
      setPasswordModal({
        ...passwordModal,
        error: "Password must be at least 4 characters.",
      });
      return;
    }
    if (password !== passwordModal.confirm.trim()) {
      setPasswordModal({
        ...passwordModal,
        error: "Passwords do not match.",
      });
      return;
    }
    setPasswordModal({ ...passwordModal, saving: true, error: null });
    try {
      const res = await fetch(
        `/api/admin/sessions/${encodeURIComponent(passwordModal.code)}`,
        {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ newPassword: password }),
        }
      );
      if (res.status === 401) {
        router.replace("/admin/login");
        return;
      }
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setPasswordModal({
          ...passwordModal,
          saving: false,
          error: json.error || "Failed to update password.",
        });
        return;
      }
      setPasswordModal(null);
      await load();
    } catch (err) {
      setPasswordModal({
        ...passwordModal,
        saving: false,
        error: (err as Error).message,
      });
    }
  }

  return (
    <main className="mx-auto max-w-5xl w-full px-4 py-10 space-y-8">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Logo size={44} />
          <div>
            <div className="inline-block rounded-full bg-accent/15 text-accent px-3 py-0.5 text-[10px] font-semibold uppercase tracking-widest">
              Admin
            </div>
            <h1 className="text-2xl font-bold text-foreground mt-1">
              Sessions
            </h1>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={load}
            className="rounded-lg border border-border px-4 py-2 text-sm font-semibold text-foreground hover:bg-accent/10 hover:border-accent transition-colors"
          >
            Refresh
          </button>
          <button
            onClick={onLogout}
            className="rounded-lg border border-border px-4 py-2 text-sm font-semibold text-foreground hover:bg-accent/10 hover:border-accent transition-colors"
          >
            Log out
          </button>
        </div>
      </header>

      {error && (
        <p className="rounded-lg border border-accent/40 bg-accent/5 px-4 py-3 text-sm text-accent font-semibold">
          {error}
        </p>
      )}

      {sessions === null && !error && (
        <p className="text-sm text-muted">Loading…</p>
      )}

      {sessions !== null && sessions.length === 0 && (
        <div className="rounded-xl border border-border bg-background/60 p-8 text-center shadow-sm">
          <p className="text-sm text-muted">
            No sessions yet. Once players create open plays they&apos;ll show up
            here.
          </p>
        </div>
      )}

      {sessions !== null && sessions.length > 0 && (
        <div className="overflow-hidden rounded-xl border border-border bg-background/60 shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-surface">
                <tr className="text-left">
                  <th className="px-4 py-3 text-xs uppercase tracking-wide text-muted font-semibold">
                    Code
                  </th>
                  <th className="px-4 py-3 text-xs uppercase tracking-wide text-muted font-semibold">
                    Players
                  </th>
                  <th className="px-4 py-3 text-xs uppercase tracking-wide text-muted font-semibold">
                    Courts
                  </th>
                  <th className="px-4 py-3 text-xs uppercase tracking-wide text-muted font-semibold">
                    Matches
                  </th>
                  <th className="px-4 py-3 text-xs uppercase tracking-wide text-muted font-semibold">
                    Last updated
                  </th>
                  <th className="px-4 py-3 text-xs uppercase tracking-wide text-muted font-semibold">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {sessions.map((s, i) => {
                  const playerCount = Array.isArray(s.state?.players)
                    ? s.state!.players!.length
                    : 0;
                  const courtCount =
                    typeof s.state?.courtCount === "number"
                      ? s.state!.courtCount
                      : 0;
                  const historyCount = Array.isArray(s.state?.history)
                    ? s.state!.history!.length
                    : 0;
                  return (
                    <tr
                      key={s.id}
                      className={
                        i === 0
                          ? "hover:bg-accent/5 transition-colors"
                          : "border-t border-border hover:bg-accent/5 transition-colors"
                      }
                    >
                      <td className="px-4 py-3 font-mono font-semibold tracking-wider text-foreground">
                        {s.code}
                      </td>
                      <td className="px-4 py-3 text-foreground">
                        {playerCount}
                      </td>
                      <td className="px-4 py-3 text-foreground">
                        {courtCount}
                      </td>
                      <td className="px-4 py-3 text-foreground">
                        {historyCount}
                      </td>
                      <td className="px-4 py-3 text-muted">
                        {new Date(s.updated_at).toLocaleString()}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-2">
                          <Link
                            href={`/${s.code}`}
                            target="_blank"
                            className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-accent/10 hover:border-accent transition-colors"
                          >
                            View
                          </Link>
                          <button
                            onClick={() => openPasswordModal(s.code)}
                            className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-accent/10 hover:border-accent transition-colors"
                          >
                            Change password
                          </button>
                          <button
                            onClick={() => onDelete(s.code)}
                            disabled={deletingCode === s.code}
                            className="rounded-lg border border-accent/50 bg-accent/5 px-3 py-1.5 text-xs font-semibold text-accent hover:bg-accent hover:text-background transition-colors disabled:opacity-40 disabled:hover:bg-accent/5 disabled:hover:text-accent"
                          >
                            {deletingCode === s.code ? "Deleting…" : "Delete"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {passwordModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 p-4"
          onClick={() => {
            if (!passwordModal.saving) setPasswordModal(null);
          }}
        >
          <form
            onSubmit={onSavePassword}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md space-y-4 rounded-xl border border-border bg-background p-6 shadow-lg"
          >
            <div>
              <div className="inline-block rounded-full bg-accent/15 text-accent px-3 py-0.5 text-[10px] font-semibold uppercase tracking-widest">
                Change password
              </div>
              <h2 className="mt-2 text-lg font-bold text-foreground">
                Session{" "}
                <span className="font-mono tracking-wider">
                  {passwordModal.code}
                </span>
              </h2>
              <p className="text-xs text-muted mt-1">
                Sets a new edit password for this session. The old password
                stops working immediately.
              </p>
            </div>
            <label className="block space-y-1">
              <span className="text-xs uppercase tracking-wide text-muted font-semibold">
                New password
              </span>
              <input
                type="password"
                value={passwordModal.password}
                onChange={(e) =>
                  setPasswordModal({
                    ...passwordModal,
                    password: e.target.value,
                    error: null,
                  })
                }
                autoFocus
                autoComplete="new-password"
                className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground focus:outline-none focus:border-accent"
              />
            </label>
            <label className="block space-y-1">
              <span className="text-xs uppercase tracking-wide text-muted font-semibold">
                Confirm password
              </span>
              <input
                type="password"
                value={passwordModal.confirm}
                onChange={(e) =>
                  setPasswordModal({
                    ...passwordModal,
                    confirm: e.target.value,
                    error: null,
                  })
                }
                autoComplete="new-password"
                className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground focus:outline-none focus:border-accent"
              />
            </label>
            {passwordModal.error && (
              <p className="text-sm text-accent font-semibold">
                {passwordModal.error}
              </p>
            )}
            <div className="flex gap-2 justify-end pt-2">
              <button
                type="button"
                disabled={passwordModal.saving}
                onClick={() => setPasswordModal(null)}
                className="rounded-lg border border-border px-4 py-2 text-sm font-semibold text-foreground hover:bg-accent/10 hover:border-accent transition-colors disabled:opacity-40"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={passwordModal.saving}
                className="rounded-lg bg-accent text-background px-4 py-2 text-sm font-semibold hover:bg-muted transition-colors disabled:opacity-40 disabled:hover:bg-accent"
              >
                {passwordModal.saving ? "Saving…" : "Save"}
              </button>
            </div>
          </form>
        </div>
      )}
    </main>
  );
}
