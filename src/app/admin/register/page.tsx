"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Logo } from "@/components/Logo";
import type { Location } from "@/lib/types";

type Step = "form" | "success";

type FormState = {
  username: string;
  password: string;
  confirm: string;
  location_id: string;
  email: string;
};

const EMPTY: FormState = { username: "", password: "", confirm: "", location_id: "", email: "" };

export default function RegisterLocationAdminPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [locations, setLocations] = useState<Location[]>([]);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [step, setStep] = useState<Step>("form");
  const [createdUsername, setCreatedUsername] = useState("");
  const usernameRef = useRef<HTMLInputElement>(null);

  // Guard: super admin only
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

  // Load active locations
  useEffect(() => {
    if (!ready) return;
    fetch("/api/admin/locations")
      .then((r) => r.json())
      .then((j) =>
        setLocations((j.locations ?? []).filter((l: Location) => l.is_active))
      );
  }, [ready]);

  useEffect(() => {
    if (ready && step === "form") usernameRef.current?.focus();
  }, [ready, step]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (form.password.length < 4) {
      setError("Password must be at least 4 characters.");
      return;
    }
    if (form.password !== form.confirm) {
      setError("Passwords do not match.");
      return;
    }
    if (!form.location_id) {
      setError("Select a location.");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/admin/admins", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          role: "location_admin",
          username: form.username,
          password: form.password,
          location_id: form.location_id,
          email: form.email || undefined,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msgs: Record<string, string> = {
          username_taken: "That username is already taken.",
          password_too_short: "Password must be at least 4 characters.",
          location_required: "Select a location.",
          username_required: "Username is required.",
        };
        setError(msgs[json.error] ?? json.error ?? "Registration failed.");
        return;
      }
      setCreatedUsername(form.username);
      setStep("success");
    } finally {
      setSaving(false);
    }
  }

  if (!ready) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <p className="text-sm text-muted">Loading…</p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-lg w-full px-4 py-12 space-y-8">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/admin/admins">
          <Logo size={40} />
        </Link>
        <div>
          <div className="inline-block rounded-full bg-accent/15 text-accent px-3 py-0.5 text-[10px] font-semibold uppercase tracking-widest">
            Admin
          </div>
          <h1 className="text-xl font-bold text-foreground mt-0.5">
            Register location admin
          </h1>
        </div>
      </div>

      {step === "form" && (
        <form
          onSubmit={onSubmit}
          className="rounded-xl border border-border bg-background/60 p-6 shadow-sm space-y-5"
        >
          <p className="text-sm text-muted">
            Create a login account for a facility manager. They will be able to
            add courts and manage bookings for their assigned location only.
          </p>

          {/* Username */}
          <label className="block space-y-1">
            <span className="text-xs uppercase tracking-wide text-muted font-semibold">
              Username <span className="text-accent">*</span>
            </span>
            <input
              ref={usernameRef}
              type="text"
              required
              value={form.username}
              onChange={(e) => setForm({ ...form, username: e.target.value })}
              placeholder="e.g. downtown_manager"
              className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground focus:outline-none focus:border-accent"
            />
          </label>

          {/* Location */}
          <label className="block space-y-1">
            <span className="text-xs uppercase tracking-wide text-muted font-semibold">
              Assigned location <span className="text-accent">*</span>
            </span>
            {locations.length === 0 ? (
              <p className="text-sm text-accent">
                No active locations.{" "}
                <Link href="/admin/locations" className="underline">
                  Add one first.
                </Link>
              </p>
            ) : (
              <select
                required
                value={form.location_id}
                onChange={(e) => setForm({ ...form, location_id: e.target.value })}
                className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground focus:outline-none focus:border-accent"
              >
                <option value="">Select a location…</option>
                {locations.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                    {l.address ? ` — ${l.address}` : ""}
                  </option>
                ))}
              </select>
            )}
          </label>

          {/* Email */}
          <label className="block space-y-1">
            <span className="text-xs uppercase tracking-wide text-muted font-semibold">
              Notification email
            </span>
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              placeholder="e.g. manager@venue.com"
              className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground focus:outline-none focus:border-accent"
            />
            <p className="text-[11px] text-muted">Receives an email whenever a booking is made at this location.</p>
          </label>

          {/* Password */}
          <label className="block space-y-1">
            <span className="text-xs uppercase tracking-wide text-muted font-semibold">
              Password <span className="text-accent">*</span>
            </span>
            <input
              type="password"
              required
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              autoComplete="new-password"
              className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground focus:outline-none focus:border-accent"
            />
          </label>

          {/* Confirm */}
          <label className="block space-y-1">
            <span className="text-xs uppercase tracking-wide text-muted font-semibold">
              Confirm password <span className="text-accent">*</span>
            </span>
            <input
              type="password"
              required
              value={form.confirm}
              onChange={(e) => setForm({ ...form, confirm: e.target.value })}
              autoComplete="new-password"
              className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground focus:outline-none focus:border-accent"
            />
          </label>

          {error && (
            <p className="text-sm text-accent font-semibold">{error}</p>
          )}

          <div className="flex gap-3 pt-1">
            <Link
              href="/admin/admins"
              className="rounded-lg border border-border px-4 py-2 text-sm font-semibold text-foreground hover:bg-accent/10 hover:border-accent transition-colors"
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={saving || locations.length === 0}
              className="flex-1 rounded-lg bg-accent text-background px-4 py-2 text-sm font-semibold hover:bg-muted transition-colors disabled:opacity-40"
            >
              {saving ? "Creating account…" : "Create account"}
            </button>
          </div>
        </form>
      )}

      {step === "success" && (
        <div className="rounded-xl border border-green-300 bg-green-50 p-6 space-y-4">
          <div className="flex items-start gap-3">
            <span className="text-2xl">✓</span>
            <div>
              <h2 className="font-bold text-green-800 text-base">
                Account created
              </h2>
              <p className="text-sm text-green-700 mt-1">
                <span className="font-semibold">@{createdUsername}</span> can
                now log in and manage their location.
              </p>
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              onClick={() => {
                setForm(EMPTY);
                setError(null);
                setStep("form");
              }}
              className="rounded-lg bg-accent text-background px-4 py-2 text-sm font-semibold hover:bg-muted transition-colors"
            >
              Register another
            </button>
            <Link
              href="/admin/admins"
              className="rounded-lg border border-border px-4 py-2 text-sm font-semibold text-foreground hover:bg-accent/10 hover:border-accent transition-colors"
            >
              Back to admins
            </Link>
          </div>
        </div>
      )}
    </main>
  );
}
