"use client";

import React, { useCallback, useEffect, useState } from "react";
import { Bell, KeyRound, User } from "lucide-react";

type AccountData = {
  email: string | null;
  notify_new_booking: boolean;
  notify_cancellation: boolean;
  username: string;
};

export default function LocationAdminAccountPage() {
  const [data, setData] = useState<AccountData | null>(null);
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");

  const [profileSaving, setProfileSaving] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [profileSuccess, setProfileSuccess] = useState(false);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState(false);

  const [notifyBooking, setNotifyBooking] = useState(true);
  const [notifyCancel, setNotifyCancel] = useState(true);
  const [notifSaving, setNotifSaving] = useState(false);
  const [notifSuccess, setNotifSuccess] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/me");
    if (!res.ok) return;
    const json = await res.json();
    setData(json);
    setUsername(json.username ?? "");
    setEmail(json.email ?? "");
    setNotifyBooking(json.notify_new_booking ?? true);
    setNotifyCancel(json.notify_cancellation ?? true);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function onSaveProfile(e: React.FormEvent) {
    e.preventDefault();
    setProfileSaving(true);
    setProfileError(null);
    setProfileSuccess(false);
    try {
      const res = await fetch("/api/admin/me", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ username: username.trim(), email: email.trim() || null }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msgs: Record<string, string> = { username_taken: "That username is already taken.", nothing_to_update: "Nothing changed." };
        throw new Error(msgs[json.error] ?? json.error ?? "Failed to save");
      }
      setProfileSuccess(true);
      await load();
    } catch (err) {
      setProfileError((err as Error).message);
    } finally {
      setProfileSaving(false);
    }
  }

  async function onChangePassword(e: React.FormEvent) {
    e.preventDefault();
    setPasswordError(null);
    setPasswordSuccess(false);
    if (newPassword !== confirmPassword) { setPasswordError("Passwords do not match."); return; }
    if (newPassword.length < 8) { setPasswordError("Password must be at least 8 characters."); return; }
    setPasswordSaving(true);
    try {
      const res = await fetch("/api/admin/me/password", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ current_password: currentPassword, new_password: newPassword }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msgs: Record<string, string> = { invalid_current_password: "Current password is incorrect.", password_too_short: "Password must be at least 8 characters." };
        throw new Error(msgs[json.error] ?? json.error ?? "Failed to update password");
      }
      setPasswordSuccess(true);
      setCurrentPassword(""); setNewPassword(""); setConfirmPassword("");
    } catch (err) {
      setPasswordError((err as Error).message);
    } finally {
      setPasswordSaving(false);
    }
  }

  async function onToggleNotif(key: "notify_new_booking" | "notify_cancellation", value: boolean) {
    setNotifSaving(true);
    setNotifSuccess(false);
    try {
      await fetch("/api/admin/me", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ [key]: value }),
      });
      setNotifSuccess(true);
      setTimeout(() => setNotifSuccess(false), 2000);
    } finally {
      setNotifSaving(false);
    }
  }

  if (!data) return null;

  return (
    <main className="max-w-2xl mx-auto px-4 py-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Account settings</h1>
        <p className="text-sm text-muted mt-1">Manage your profile, password, and notification preferences.</p>
      </div>

      {/* Profile */}
      <div className="rounded-xl border border-border bg-background p-6 space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-accent/15 flex items-center justify-center shrink-0">
            <User size={16} className="text-accent" />
          </div>
          <div>
            <h2 className="text-[15px] font-bold text-foreground">Profile</h2>
            <p className="text-xs text-muted">Update your username and email address.</p>
          </div>
        </div>
        <form onSubmit={onSaveProfile} className="space-y-3">
          <div>
            <label className="block text-[12px] font-semibold text-muted uppercase tracking-wide mb-1.5">Username</label>
            <input type="text" value={username} onChange={(e) => setUsername(e.target.value)} required
              className="w-full rounded-xl border border-border bg-surface px-4 py-2.5 text-[14px] text-foreground focus:outline-none focus:border-accent" />
          </div>
          <div>
            <label className="block text-[12px] font-semibold text-muted uppercase tracking-wide mb-1.5">
              Email <span className="normal-case font-normal">(optional — used for notifications)</span>
            </label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="your@email.com"
              className="w-full rounded-xl border border-border bg-surface px-4 py-2.5 text-[14px] text-foreground placeholder:text-muted/60 focus:outline-none focus:border-accent" />
          </div>
          {profileError && <p className="text-sm text-red-600">{profileError}</p>}
          {profileSuccess && <p className="text-sm text-green-600">Profile updated.</p>}
          <button type="submit" disabled={profileSaving}
            className="rounded-full bg-accent text-white px-5 py-2.5 text-[14px] font-semibold hover:opacity-90 transition-opacity disabled:opacity-50">
            {profileSaving ? "Saving…" : "Save profile"}
          </button>
        </form>
      </div>

      {/* Password */}
      <div className="rounded-xl border border-border bg-background p-6 space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-accent/15 flex items-center justify-center shrink-0">
            <KeyRound size={16} className="text-accent" />
          </div>
          <div>
            <h2 className="text-[15px] font-bold text-foreground">Password</h2>
            <p className="text-xs text-muted">Choose a strong password of at least 8 characters.</p>
          </div>
        </div>
        <form onSubmit={onChangePassword} className="space-y-3">
          <div>
            <label className="block text-[12px] font-semibold text-muted uppercase tracking-wide mb-1.5">Current password</label>
            <input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} required
              className="w-full rounded-xl border border-border bg-surface px-4 py-2.5 text-[14px] text-foreground focus:outline-none focus:border-accent" />
          </div>
          <div>
            <label className="block text-[12px] font-semibold text-muted uppercase tracking-wide mb-1.5">New password</label>
            <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required minLength={8}
              className="w-full rounded-xl border border-border bg-surface px-4 py-2.5 text-[14px] text-foreground focus:outline-none focus:border-accent" />
          </div>
          <div>
            <label className="block text-[12px] font-semibold text-muted uppercase tracking-wide mb-1.5">Confirm new password</label>
            <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required
              className="w-full rounded-xl border border-border bg-surface px-4 py-2.5 text-[14px] text-foreground focus:outline-none focus:border-accent" />
          </div>
          {passwordError && <p className="text-sm text-red-600">{passwordError}</p>}
          {passwordSuccess && <p className="text-sm text-green-600">Password updated successfully.</p>}
          <button type="submit" disabled={passwordSaving}
            className="rounded-full bg-accent text-white px-5 py-2.5 text-[14px] font-semibold hover:opacity-90 transition-opacity disabled:opacity-50">
            {passwordSaving ? "Updating…" : "Update password"}
          </button>
        </form>
      </div>

      {/* Notifications */}
      <div className="rounded-xl border border-border bg-background p-6 space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-accent/15 flex items-center justify-center shrink-0">
            <Bell size={16} className="text-accent" />
          </div>
          <div>
            <h2 className="text-[15px] font-bold text-foreground">Notifications</h2>
            <p className="text-xs text-muted">Choose which email notifications you receive. Requires an email address above.</p>
          </div>
        </div>
        <div className="space-y-3">
          {([
            { key: "notify_new_booking" as const, label: "New booking", description: "Get notified when a player books a court.", value: notifyBooking, set: setNotifyBooking },
            { key: "notify_cancellation" as const, label: "Cancellation", description: "Get notified when a booking is cancelled.", value: notifyCancel, set: setNotifyCancel },
          ]).map(({ key, label, description, value, set }) => (
            <div key={key} className="flex items-start justify-between gap-4 py-2 border-t border-border first:border-t-0 first:pt-0">
              <div>
                <p className="text-[14px] font-semibold text-foreground">{label}</p>
                <p className="text-[13px] text-muted">{description}</p>
              </div>
              <button
                type="button"
                disabled={notifSaving}
                onClick={async () => { const next = !value; set(next); await onToggleNotif(key, next); }}
                className={`relative w-11 h-6 rounded-full transition-colors shrink-0 mt-0.5 ${value ? "bg-accent" : "bg-border"}`}
              >
                <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${value ? "translate-x-5" : "translate-x-0"}`} />
              </button>
            </div>
          ))}
        </div>
        {notifSuccess && <p className="text-sm text-green-600">Preferences saved.</p>}
      </div>
    </main>
  );
}
