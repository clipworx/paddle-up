"use client";

import { Suspense, useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Logo } from "@/components/Logo";

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(
          json.error === "invalid_credentials"
            ? "Invalid username or password."
            : json.error || "Login failed."
        );
        return;
      }
      const next = params.get("next") || "/admin";
      router.replace(next);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <form
      onSubmit={onSubmit}
      className="w-full max-w-md space-y-5 rounded-xl border border-border bg-background/60 p-6 shadow-sm"
    >
      <div className="flex flex-col items-center space-y-3 text-center">
        <Logo size={56} />
        <div className="inline-block rounded-full bg-accent/15 text-accent px-4 py-1 text-xs font-semibold uppercase tracking-widest">
          Admin
        </div>
        <h1 className="text-2xl font-bold text-foreground">Sign in</h1>
        <p className="text-xs text-muted">
          Access the session management panel.
        </p>
      </div>

      <label className="block space-y-1">
        <span className="text-xs uppercase tracking-wide text-muted font-semibold">
          Username
        </span>
        <input
          type="text"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          required
          autoFocus
          autoComplete="username"
          className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground focus:outline-none focus:border-accent"
        />
      </label>

      <label className="block space-y-1">
        <span className="text-xs uppercase tracking-wide text-muted font-semibold">
          Password
        </span>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          autoComplete="current-password"
          className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground focus:outline-none focus:border-accent"
        />
      </label>

      {error && <p className="text-sm text-accent font-semibold">{error}</p>}

      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-lg bg-accent text-background px-4 py-2.5 text-sm font-semibold hover:bg-muted transition-colors disabled:opacity-40 disabled:hover:bg-accent"
      >
        {loading ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}

export default function AdminLoginPage() {
  return (
    <main className="mx-auto max-w-3xl w-full min-h-screen flex items-center justify-center px-4 py-12">
      <Suspense fallback={null}>
        <LoginForm />
      </Suspense>
    </main>
  );
}
